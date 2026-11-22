"""Локальный учебный реестр ОСМ. Данные: SQLite из предоставленного набора.

Связи исходных документов с методологиями устанавливались по ПРИКАЗУ, а не по
проверке содержания документа. Для файлов, добавленных пользователем, хранится
отдельный тип связи. Модуль не предназначен для публичного размещения без
авторизации, контроля доступа и эксплуатационных мер безопасности.
"""
from __future__ import annotations

import csv
import hashlib
import io
import os
import re
import sqlite3
import uuid
import zipfile
from contextlib import contextmanager
from datetime import date
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, Response
from docx import Document

router = APIRouter(prefix="/api/registry", tags=["Реестр ОСМ"])
DATA_ROOT = Path(__file__).resolve().parents[1] / "data"
DB_PATH = Path(os.environ.get("OSM_DB_PATH", str(DATA_ROOT / "osm_registry.sqlite")))
DOCS_ROOT = Path(os.environ.get("OSM_DOCS_DIR", str(DATA_ROOT / "Документы_ОСМ")))
MAX_FILE_SIZE = 25 * 1024 * 1024
MAX_FILES = 10


@contextmanager
def database():
    if not DB_PATH.is_file():
        raise HTTPException(503, "База реестра не найдена. Проверьте backend/data/osm_registry.sqlite")
    db = sqlite3.connect(DB_PATH, timeout=15)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys=ON")
    db.create_function("FOLD", 1, lambda s: str(s or "").casefold())
    try:
        yield db
    finally:
        db.close()


def rows_to_dict(rows):
    return [dict(row) for row in rows]


@router.get("/stats")
def get_statistics():
    with database() as db:
        total, yes = db.execute("SELECT COUNT(*), SUM(complies_548) FROM osm").fetchone()
        with_docs = db.execute("SELECT COUNT(DISTINCT osm_id) FROM osm_documents").fetchone()[0]
        files = db.execute("SELECT COUNT(*) FROM documents").fetchone()[0]
        links = db.execute("SELECT COUNT(*) FROM osm_documents").fetchone()[0]
        orgs = [row[0] for row in db.execute("SELECT DISTINCT authority FROM osm WHERE TRIM(COALESCE(authority,'')) != '' ORDER BY authority")]
    return {
        "total": total, "complies_yes": yes or 0, "complies_no": total - (yes or 0),
        "with_documents": with_docs, "without_documents": total - with_docs,
        "files": files, "links": links, "authorities": orgs,
        "snapshot_date": "2026-10-20",
    }


def _list_query(
    q: str = "", complies_548: str = "", has_documents: str = "",
    authority: str = "", date_from: str = "", date_to: str = "", fpsr: str = "",
):
    conditions = []
    params: list[str | int] = []
    q = q.strip()
    if q:
        conditions.append("(INSTR(FOLD(o.title),FOLD(?)) > 0 OR INSTR(FOLD(COALESCE(o.order_number,'')),FOLD(?)) > 0 OR INSTR(FOLD(COALESCE(o.order_title,'')),FOLD(?)) > 0 OR INSTR(FOLD(o.osm_id),FOLD(?)) > 0)")
        params.extend([q] * 4)
    if complies_548 in ("yes", "no"):
        conditions.append("o.complies_548 = ?")
        params.append(1 if complies_548 == "yes" else 0)
    if has_documents in ("yes", "no"):
        conditions.append("EXISTS (SELECT 1 FROM osm_documents od WHERE od.osm_id=o.osm_id)" if has_documents == "yes"
                          else "NOT EXISTS (SELECT 1 FROM osm_documents od WHERE od.osm_id=o.osm_id)")
    if authority.strip():
        conditions.append("o.authority = ?")
        params.append(authority.strip())
    if date_from:
        try: date.fromisoformat(date_from)
        except ValueError: raise HTTPException(422, "Некорректная начальная дата")
        conditions.append("o.order_date >= ?")
        params.append(date_from)
    if date_to:
        try: date.fromisoformat(date_to)
        except ValueError: raise HTTPException(422, "Некорректная конечная дата")
        conditions.append("o.order_date <= ?")
        params.append(date_to)
    if fpsr.strip():
        conditions.append("INSTR(FOLD(COALESCE(o.fpsr_positions,'')),FOLD(?)) > 0")
        params.append(fpsr.strip())
    return (" WHERE " + " AND ".join(conditions)) if conditions else "", params


@router.get("/methodologies")
def list_methodologies(
    q: str = Query("", max_length=300),
    complies_548: str = Query("", pattern="^(|yes|no)$"),
    has_documents: str = Query("", pattern="^(|yes|no)$"),
    authority: str = Query("", max_length=200),
    date_from: str = "", date_to: str = "",
    fpsr: str = Query("", max_length=50),
    page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
):
    where, params = _list_query(q, complies_548, has_documents, authority, date_from, date_to, fpsr)
    with database() as db:
        total = db.execute("SELECT COUNT(*) FROM osm o" + where, params).fetchone()[0]
        rows = db.execute(
            "SELECT o.osm_id, o.title, o.methodology_number, o.order_number, o.order_date,"
            " o.authority, o.complies_548, o.fpsr_positions,"
            " (SELECT COUNT(*) FROM osm_documents od WHERE od.osm_id=o.osm_id) AS documents_count"
            " FROM osm o" + where + " ORDER BY o.order_date DESC, o.title COLLATE NOCASE ASC, o.osm_id ASC LIMIT ? OFFSET ?",
            [*params, page_size, (page-1)*page_size],
        ).fetchall()
    return {"items": rows_to_dict(rows), "total": total, "page": page, "page_size": page_size}


@router.get("/export.csv")
def export_csv(
    q: str = "", complies_548: str = Query("", pattern="^(|yes|no)$"),
    has_documents: str = Query("", pattern="^(|yes|no)$"),
    authority: str = "", date_from: str = "", date_to: str = "", fpsr: str = "",
):
    where, params = _list_query(q, complies_548, has_documents, authority, date_from, date_to, fpsr)
    with database() as db:
        results = db.execute(
            "SELECT o.osm_id, o.title, o.methodology_number, o.order_number, o.order_date, o.authority,"
            " o.complies_548, o.fpsr_positions, o.source_url,"
            " (SELECT COUNT(*) FROM osm_documents od WHERE od.osm_id=o.osm_id) AS files_count"
            " FROM osm o" + where + " ORDER BY o.order_date DESC, o.osm_id", params,
        ).fetchall()
    output = io.StringIO()
    output.write("\ufeff")
    writer = csv.writer(output, delimiter=";", lineterminator="\r\n")
    writer.writerow(["ID ОСМ", "Наименование ОСМ", "№ методологии", "№ приказа", "Дата приказа", "Орган", "Соответствует №548", "Позиции ФПСР", "Ссылка на источник", "Файлов"])
    for row in results:
        vals = list(row)
        vals[6] = "Да" if vals[6] else "Нет"
        # Защита от формул при открытии CSV в Excel.
        writer.writerow(["'" + str(x) if isinstance(x, str) and x.lstrip().startswith(("=", "+", "-", "@")) else x for x in vals])
    return Response(content=output.getvalue().encode("utf-8"), media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": 'attachment; filename="osm_registry.csv"'})


@router.get("/methodologies/{osm_id}")
def get_methodology(osm_id: str):
    with database() as db:
        row = db.execute("SELECT * FROM osm WHERE osm_id=?", (osm_id,)).fetchone()
        if row is None:
            raise HTTPException(404, "Методология не найдена")
        docs = db.execute(
            "SELECT d.sha256, d.title, d.size_bytes, d.archive_path, od.connection_type"
            " FROM documents d JOIN osm_documents od ON d.sha256=od.document_sha256"
            " WHERE od.osm_id=? ORDER BY d.title", (osm_id,)
        ).fetchall()
    return {**dict(row), "documents": rows_to_dict(docs),
            "fpsr_list": [v.strip() for v in (row["fpsr_positions"] or "").split(";") if v.strip()]}


def _get_file(sha256: str):
    if not re.fullmatch(r"[a-f0-9]{64}", sha256):
        raise HTTPException(404, "Документ не найден")
    with database() as db:
        doc = db.execute("SELECT * FROM documents WHERE sha256=?", (sha256,)).fetchone()
    if doc is None:
        raise HTTPException(404, "Документ не найден")
    path = (DATA_ROOT / doc["archive_path"]).resolve()
    if not path.is_relative_to(DOCS_ROOT.resolve()):
        raise HTTPException(500, "Неверный путь к документу")
    if not path.is_file():
        raise HTTPException(404, "Файл отсутствует на диске")
    return dict(doc), path


@router.get("/documents/{sha256}/file")
def get_document_file(sha256: str, download: bool = False):
    doc, path = _get_file(sha256)
    is_pdf = path.suffix.lower() == ".pdf"
    return FileResponse(
        path, media_type="application/pdf" if is_pdf else "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=doc["title"], content_disposition_type="attachment" if download or not is_pdf else "inline",
        headers={"X-Content-Type-Options": "nosniff"},
    )


@router.get("/documents/{sha256}/preview")
def preview_document(sha256: str):
    doc, path = _get_file(sha256)
    if path.suffix.lower() != ".docx":
        raise HTTPException(400, "Текстовый предпросмотр доступен только для DOCX")
    try:
        word = Document(path)
        lines = []
        total = 0
        for p in word.paragraphs:
            text = p.text.strip()
            if text:
                lines.append(text)
                total += len(text)
            if total > 30000:
                break
    except Exception:
        raise HTTPException(422, "Не удалось прочитать DOCX. Скачайте оригинал")
    return {"title": doc["title"], "text": "\n\n".join(lines)[:30000], "truncated": total > 30000,
            "note": "Текстовый предпросмотр не воспроизводит таблицы, формулы и исходное форматирование. Для точного просмотра скачайте DOCX."}


def _safe_name(original: str) -> str:
    name = Path(original.replace("\\", "/")).name
    name = re.sub(r"[^0-9A-Za-zА-Яа-яЁё ._()\-]", "_", name)
    ext = Path(name).suffix.lower()
    base = Path(name).stem.strip(" ._")[:85] or "document"
    if ext not in (".pdf", ".docx"):
        raise HTTPException(422, "Разрешены только файлы PDF и DOCX")
    return base + ext


def _store_file(upload: UploadFile, created_paths: list[Path]):
    clean = _safe_name(upload.filename or "")
    DOCS_ROOT.mkdir(parents=True, exist_ok=True)
    tmp = DOCS_ROOT / (".upload-" + uuid.uuid4().hex)
    sha = hashlib.sha256()
    size = 0
    try:
        with tmp.open("wb") as target:
            while chunk := upload.file.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_FILE_SIZE:
                    raise HTTPException(413, "Файл превышает ограничение 25 МБ")
                sha.update(chunk)
                target.write(chunk)
        if size == 0:
            raise HTTPException(422, "Нельзя загрузить пустой файл")
        if clean.endswith(".pdf"):
            with tmp.open("rb") as stream:
                if not stream.read(5) == b"%PDF-":
                    raise HTTPException(422, "Файл не является PDF")
        else:
            if not zipfile.is_zipfile(tmp):
                raise HTTPException(422, "Файл не является DOCX")
            try:
                with zipfile.ZipFile(tmp) as z:
                    names = z.namelist()
                    if ("word/document.xml" not in names or "[Content_Types].xml" not in names or
                        len(names) > 10000 or sum(i.file_size for i in z.infolist()) > 100 * 1024 * 1024):
                        raise HTTPException(422, "Недопустимая структура DOCX")
            except zipfile.BadZipFile:
                raise HTTPException(422, "Повреждённый файл DOCX")
        digest = sha.hexdigest()
        final_name = digest[:20] + "__" + clean
        final_path = DOCS_ROOT / final_name
        if final_path.exists():
            # Идентичное содержимое не загружаем повторно. При конфликте имени
            # с иными байтами выдаём ошибку, а не перезаписываем файл.
            if hashlib.sha256(final_path.read_bytes()).hexdigest() != digest:
                raise HTTPException(409, "Конфликт имени файла")
        else:
            tmp.replace(final_path)
            created_paths.append(final_path)
        return digest, clean, "Документы_ОСМ/" + final_name, size
    finally:
        tmp.unlink(missing_ok=True)


@router.post("/methodologies", status_code=201)
def create_methodology(
    title: Annotated[str, Form(min_length=1, max_length=2000)],
    order_number: Annotated[str, Form(min_length=1, max_length=100)],
    order_date: Annotated[date, Form()],
    authority: Annotated[str, Form(min_length=1, max_length=200)],
    complies_548: Annotated[str, Form(pattern="^(yes|no)$")],
    methodology_number: Annotated[str, Form(max_length=100)] = "",
    order_title: Annotated[str, Form(max_length=3000)] = "",
    fpsr_positions: Annotated[str, Form(max_length=1000)] = "",
    source_url: Annotated[str, Form(max_length=2000)] = "",
    files: Annotated[list[UploadFile] | None, File()] = None,
):
    title, order_number, authority = title.strip(), order_number.strip(), authority.strip()
    if not title or not order_number or not authority:
        raise HTTPException(422, "Наименование ОСМ, номер приказа и орган обязательны")
    if source_url and not source_url.strip().lower().startswith(("http://", "https://")):
        raise HTTPException(422, "Ссылка на источник должна начинаться с http:// или https://")
    if len(files or []) > MAX_FILES:
        raise HTTPException(422, "К одной ОСМ допускается не более 10 файлов")
    osm_id = "OSM-USER-" + uuid.uuid4().hex[:12].upper()
    created_paths: list[Path] = []
    try:
        with database() as db:
            with db:
                db.execute(
                    "INSERT INTO osm (osm_id,title,methodology_number,order_number,order_date,authority,order_title,complies_548,fpsr_positions,expected_file_names,source_url)"
                    " VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                    (osm_id,title,methodology_number.strip(),order_number,order_date.isoformat(),authority,order_title.strip(),int(complies_548 == "yes"),fpsr_positions.strip(),"",source_url.strip()),
                )
                for upload in files or []:
                    digest, clean, rel, size = _store_file(upload, created_paths)
                    previous = db.execute("SELECT archive_path FROM documents WHERE sha256=?", (digest,)).fetchone()
                    if previous is not None and previous["archive_path"] != rel:
                        # Один SHA-256 — один физический оригинал, даже если имя при
                        # новой загрузке отличается от имени уже известного файла.
                        extra_path = DOCS_ROOT / Path(rel).name
                        if extra_path in created_paths:
                            extra_path.unlink(missing_ok=True)
                            created_paths.remove(extra_path)
                    db.execute("INSERT OR IGNORE INTO documents(sha256,title,archive_path,size_bytes,linked_order_count,linked_orders_description) VALUES(?,?,?,?,?,?)",
                               (digest,clean,rel,size,1,f"№{order_number} от {order_date.isoformat()}"))
                    db.execute("INSERT OR IGNORE INTO osm_documents(osm_id,document_sha256,connection_type) VALUES(?,?,?)",
                               (osm_id,digest,"Добавлен пользователем для конкретной ОСМ"))
    except Exception:
        for path in created_paths:
            path.unlink(missing_ok=True)
        raise
    return {"osm_id": osm_id, "message": "Методология добавлена в реестр"}
