"""Загрузчик JSON-шаблонов методологии."""
import json
from pathlib import Path
from typing import Any

# app/template_loader.py -> родитель = app/ -> родитель = backend/ -> data/
DATA_DIR = Path(__file__).resolve().parent.parent / "data"
SECTIONS_DIR = DATA_DIR / "sections"


def _read_json(path: Path) -> Any:
    """Прочитать JSON-файл в UTF-8."""
    if not path.exists():
        raise FileNotFoundError(f"Файл не найден: {path}")
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def load_manifest() -> dict:
    """Прочитать template_manifest.json."""
    return _read_json(DATA_DIR / "template_manifest.json")


def load_section(section_id: str) -> dict:
    """Прочитать раздел по его id, например section_01_general.

    Список id берётся из manifest.sections[].id.
    """
    manifest = load_manifest()
    for section in manifest.get("sections", []):
        if section["id"] == section_id:
            # В manifest указан путь вида "sections/section_01_general.json".
            filename = Path(section["file"]).name
            return _read_json(SECTIONS_DIR / filename)
    raise KeyError(f"Раздел с id={section_id} не найден в манифесте")


def load_fpsr() -> dict:
    """Прочитать справочник ФПСР."""
    return _read_json(DATA_DIR / "fpsr_catalog.json")