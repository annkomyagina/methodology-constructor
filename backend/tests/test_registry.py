"""Тесты реестра на временной копии базы, исходную учебную базу не меняют."""
import hashlib
import io
import shutil
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from docx import Document
from fastapi.testclient import TestClient

from app.main import app
from app import registry


class RegistryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.root = Path(cls.tmp.name)
        cls.db = cls.root / "osm_registry.sqlite"
        cls.docs = cls.root / "Документы_ОСМ"
        cls.docs.mkdir()
        shutil.copy2(registry.DB_PATH, cls.db)
        cls.patchers = [
            patch.object(registry, "DATA_ROOT", cls.root),
            patch.object(registry, "DB_PATH", cls.db),
            patch.object(registry, "DOCS_ROOT", cls.docs),
        ]
        for p in cls.patchers: p.start()
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        cls.client.close()
        for p in reversed(cls.patchers): p.stop()
        cls.tmp.cleanup()

    def test_01_initial_counts_and_filters(self):
        stats = self.client.get('/api/registry/stats').json()
        self.assertEqual({k: stats[k] for k in ('total','complies_yes','complies_no','with_documents','without_documents','files','links')},
                         {'total':447,'complies_yes':201,'complies_no':246,'with_documents':209,'without_documents':238,'files':68,'links':243})
        self.assertEqual(self.client.get('/api/registry/methodologies',params={'complies_548':'yes'}).json()['total'],201)
        self.assertEqual(self.client.get('/api/registry/methodologies',params={'has_documents':'no'}).json()['total'],238)
        self.assertEqual(self.client.get('/api/registry/methodologies',params={'has_documents':'yes'}).json()['total'],209)
        self.assertEqual(self.client.get('/api/registry/methodologies',params={'page':1,'page_size':2}).json()['items'].__len__(),2)
        self.assertEqual(self.client.get('/api/registry/methodologies',params={'q':'РОССТАТ'}).status_code,200)

    def test_02_detail_and_original_file(self):
        item = self.client.get('/api/registry/methodologies',params={'has_documents':'yes','page_size':1}).json()['items'][0]
        detail = self.client.get('/api/registry/methodologies/'+item['osm_id']).json()
        self.assertTrue(detail['documents'])
        doc = detail['documents'][0]
        # The source fixture was moved to a temporary root; copy one actual
        # original to the new root to test bytes without duplicating the lot.
        project_path = Path(__file__).resolve().parents[1] / 'data' / doc['archive_path']
        target = self.docs / Path(doc['archive_path']).name
        shutil.copy2(project_path, target)
        r = self.client.get(f"/api/registry/documents/{doc['sha256']}/file")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(hashlib.sha256(r.content).hexdigest(), doc['sha256'])
        self.assertEqual(self.client.get('/api/registry/methodologies/no-such-osm').status_code, 404)

    def test_03_export(self):
        r = self.client.get('/api/registry/export.csv',params={'has_documents':'no'})
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.content.startswith(b'\xef\xbb\xbf'))
        self.assertEqual(len(r.content.decode('utf-8-sig').splitlines()),239)

    def test_04_upload_create_persist_and_dedup(self):
        pdf = b'%PDF-1.4\n1 0 obj <<>> endobj\n%%EOF\n'
        word = Document()
        word.add_paragraph('Официальная статистическая методология — тестовый документ')
        stream = io.BytesIO()
        word.save(stream)
        docx = stream.getvalue()
        data = {
            'title':'Тестовая новая ОСМ','order_number':'7291','order_date':'2026-07-14',
            'authority':'Росстат','complies_548':'no','fpsr_positions':'1.2.3; 1.2.4',
        }
        response = self.client.post('/api/registry/methodologies',data=data,
            files=[('files',('a.pdf',pdf,'application/pdf')),('files',('b.docx',docx,'application/vnd.openxmlformats-officedocument.wordprocessingml.document'))])
        self.assertEqual(response.status_code,201,response.text)
        key = response.json()['osm_id']
        detail = self.client.get('/api/registry/methodologies/'+key).json()
        self.assertEqual(detail['fpsr_list'],['1.2.3','1.2.4'])
        self.assertEqual(len(detail['documents']),2)
        self.assertEqual(self.client.get('/api/registry/stats').json()['total'],448)
        self.assertEqual(self.client.get('/api/registry/stats').json()['files'],70)
        self.assertEqual(self.client.get('/api/registry/methodologies',params={'q':'ТЕСТОВАЯ НОВАЯ'}).json()['total'],1)
        sha_docx = hashlib.sha256(docx).hexdigest()
        preview = self.client.get(f'/api/registry/documents/{sha_docx}/preview')
        self.assertEqual(preview.status_code,200,preview.text)
        self.assertIn('тестовый документ',preview.json()['text'])
        self.assertEqual(self.client.get(f'/api/registry/documents/{sha_docx}/file?download=true').status_code,200)
        # Identical bytes uploaded under another filename share a single stored document.
        repeat = self.client.post('/api/registry/methodologies',data={**data,'title':'Другая новая ОСМ'},
                                  files=[('files',('another-name.pdf',pdf,'application/pdf'))])
        self.assertEqual(repeat.status_code,201,repeat.text)
        self.assertEqual(self.client.get('/api/registry/stats').json()['files'],70)
        self.assertEqual(len(list(self.docs.glob('*__another-name.pdf'))),0)
        self.assertEqual(self.client.get('/api/registry/stats').json()['total'],449)

    def test_05_invalid_file_does_not_create_record(self):
        before = self.client.get('/api/registry/stats').json()['total']
        data = {'title':'Неправильный файл','order_number':'23','order_date':'2026-01-02','authority':'Росстат','complies_548':'yes'}
        response = self.client.post('/api/registry/methodologies',data=data,
            files=[('files',('fake.pdf',b'not a real PDF','application/pdf'))])
        self.assertEqual(response.status_code,422,response.text)
        self.assertEqual(self.client.get('/api/registry/stats').json()['total'],before)


if __name__ == '__main__':
    unittest.main()
