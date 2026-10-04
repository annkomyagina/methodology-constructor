"""Точка входа backend-приложения конструктора методологии."""
import os
from pathlib import Path

import requests
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from app.template_loader import load_manifest, load_section, load_fpsr
from app.word_builder import build_document

# Загружаем .env из папки backend
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

app = FastAPI(
    title="Конструктор официальной статистической методологии",
    version="0.1.0",
)

# CORS: разрешаем фронту на localhost:5173 обращаться к API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict:
    """Проверка, что сервер жив."""
    return {"status": "ok"}


@app.get("/api/template")
def get_template() -> dict:
    """Вернуть манифест шаблона (список разделов и настройки)."""
    return load_manifest()


@app.get("/api/template/sections/{section_id}")
def get_section(section_id: str) -> dict:
    """Вернуть один раздел по id."""
    try:
        return load_section(section_id)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/fpsr")
def get_fpsr() -> dict:
    """Вернуть справочник ФПСР (для поиска на фронте)."""
    return load_fpsr()

@app.post("/api/export/docx")
def export_docx(payload: dict = Body(...)):
    """Сгенерировать Word-документ из значений проекта."""
    values = payload.get("values") or {}
    buf = build_document(values)
    return Response(
        content=buf.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": 'attachment; filename="methodology.docx"'},
    )

# =============================================================
# YandexGPT
# =============================================================

YANDEX_FOLDER_ID = os.getenv("YANDEX_FOLDER_ID", "")
YANDEX_API_KEY = os.getenv("YANDEX_API_KEY", "")
YANDEX_URL = "https://llm.api.cloud.yandex.net/foundationModels/v1/completion"


SYSTEM_PROMPT = """Ты — помощник методолога Росстата. Помогаешь готовить официальную статистическую методологию.

Правила:
- Отвечай по-русски, официальным, но ясным языком.
- Формулировки — в стиле нормативных документов.
- Никогда не выдумывай нормативные акты и ссылки.
- Давай краткие ответы: 3–8 предложений, если не просят иначе.
- Если данных недостаточно, задай один уточняющий вопрос.
- Не меняй документ сам — предлагай варианты, окончательное решение за пользователем.
"""


ACTION_PROMPTS = {
    "improve": (
        "Улучши формулировку ниже. Сохрани смысл, сделай язык более "
        "официальным и точным. Верни только улучшенный текст без пояснений."
    ),
    "explain": (
        "Объясни простыми словами, что требуется в этом разделе методологии "
        "и на что обратить внимание при заполнении. Без воды."
    ),
    "suggest": (
        "Предложи 1–2 варианта формулировки для указанного поля на основе "
        "контекста. Каждый вариант — отдельным абзацем."
    ),
    "check": (
        "Проверь текст на противоречия, неполноту и стилистические проблемы. "
        "Перечисли замечания списком, если они есть. Если всё в порядке — скажи об этом."
    ),
}


def _call_yandex_gpt(user_prompt: str, temperature: float = 0.3, max_tokens: int = 600) -> str:
    if not YANDEX_FOLDER_ID or not YANDEX_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="YandexGPT не настроен: отсутствуют YANDEX_FOLDER_ID или YANDEX_API_KEY в .env",
        )

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Api-Key {YANDEX_API_KEY}",
        "x-folder-id": YANDEX_FOLDER_ID,
    }

    payload = {
        "modelUri": f"gpt://{YANDEX_FOLDER_ID}/yandexgpt-lite/latest",
        "completionOptions": {
            "stream": False,
            "temperature": temperature,
            "maxTokens": max_tokens,
        },
        "messages": [
            {"role": "system", "text": SYSTEM_PROMPT},
            {"role": "user", "text": user_prompt},
        ],
    }

    try:
        r = requests.post(YANDEX_URL, headers=headers, json=payload, timeout=40)
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Ошибка сети: {e}")

    if r.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"YandexGPT ответил {r.status_code}: {r.text[:300]}",
        )

    data = r.json()
    try:
        return data["result"]["alternatives"][0]["message"]["text"]
    except (KeyError, IndexError):
        raise HTTPException(status_code=502, detail=f"Некорректный ответ: {r.text[:300]}")


@app.post("/api/ai/assist")
def ai_assist(payload: dict = Body(...)):
    """Универсальный ИИ-помощник.

    Ожидаемый JSON:
    {
      "action": "improve" | "explain" | "suggest" | "check",
      "section_title": "...",
      "section_description": "...",
      "field_label": "...",
      "field_hint": "...",
      "current_text": "...",
      "context": { ... }   // опционально: заполненные поля проекта
    }
    """
    action = payload.get("action", "improve")
    section_title = payload.get("section_title", "")
    section_description = payload.get("section_description", "")
    field_label = payload.get("field_label", "")
    field_hint = payload.get("field_hint", "")
    current_text = (payload.get("current_text") or "").strip()
    context = payload.get("context") or {}

    action_prompt = ACTION_PROMPTS.get(action, ACTION_PROMPTS["improve"])

    parts = [f"Раздел: {section_title}"]
    if section_description:
        parts.append(f"Описание раздела: {section_description}")
    if field_label:
        parts.append(f"Поле: {field_label}")
    if field_hint:
        parts.append(f"Подсказка к полю: {field_hint}")

    # Немного контекста — не весь документ, чтобы не раздувать промпт
    if isinstance(context, dict) and context:
        ctx_keys = list(context.keys())[:6]
        ctx_lines = []
        for k in ctx_keys:
            v = context[k]
            if isinstance(v, str) and v.strip():
                ctx_lines.append(f"- {k}: {v[:200]}")
        if ctx_lines:
            parts.append("Другие заполненные поля:\n" + "\n".join(ctx_lines))

    if current_text:
        parts.append(f"Текущий текст пользователя:\n\"\"\"\n{current_text}\n\"\"\"")

    parts.append(f"Задача: {action_prompt}")

    user_prompt = "\n\n".join(parts)
    answer = _call_yandex_gpt(user_prompt)
    return {"answer": answer}