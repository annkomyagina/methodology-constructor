"""Разовый скрипт для проверки доступа к YandexGPT."""
import os
import requests

# === ВПИШИТЕ СВОИ ЗНАЧЕНИЯ ===
FOLDER_ID = "b1gsh8uv199o41f1ktts"          # ID каталога
API_KEY = "AQVNyR4r9F0JsJTROVVtrY5hHgOFGyWst_zz8hBD"           # секрет API-ключа
# =============================

url = "https://llm.api.cloud.yandex.net/foundationModels/v1/completion"

headers = {
    "Content-Type": "application/json",
    "Authorization": f"Api-Key {API_KEY}",
    "x-folder-id": FOLDER_ID,
}

payload = {
    "modelUri": f"gpt://{FOLDER_ID}/yandexgpt-lite/latest",
    "completionOptions": {
        "stream": False,
        "temperature": 0.3,
        "maxTokens": 100,
    },
    "messages": [
        {"role": "user", "text": "Привет! Ты работаешь?"},
    ],
}

response = requests.post(url, headers=headers, json=payload, timeout=30)

print("Статус:", response.status_code)
print("Ответ:")
print(response.text)