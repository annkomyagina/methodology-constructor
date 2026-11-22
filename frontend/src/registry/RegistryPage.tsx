import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Button, Card, Col, Descriptions, Drawer, Empty, Form, Input, List, message,
  Modal, Radio, Row, Select, Space, Spin, Statistic, Table, Tag, Tooltip, Typography, Upload,
} from 'antd';
import type { TableColumnsType, UploadFile } from 'antd';
import {
  ArrowDownOutlined, BookOutlined, CheckCircleOutlined, ClearOutlined,
  CloudUploadOutlined, DownloadOutlined, EyeOutlined, FilePdfOutlined,
  FileWordOutlined, LinkOutlined, PlusOutlined, SearchOutlined,
} from '@ant-design/icons';
import {
  addRecord, exportUrl, getDocxPreview, getRecord, getRecords, getStats, originalUrl,
} from './api';
import type { RegistryDetail, RegistryDocument, RegistryQuery, RegistryRow, RegistryStats } from './api';
import './registry.css';

const { Text, Paragraph, Title } = Typography;
const DEFAULT_FILTERS: RegistryQuery = {
  q: '', complies_548: '', has_documents: '', authority: '', date_from: '', date_to: '', fpsr: '',
};

function formatDate(value?: string): string {
  if (!value) return '—';
  const parts = value.split('-');
  return parts.length === 3 ? parts.reverse().join('.') : value;
}

function formatBytes(value: number): string {
  return value < 1024 * 1024 ? `${Math.round(value / 1024)} КБ` : `${(value / 1024 / 1024).toFixed(1)} МБ`;
}

export default function RegistryPage() {
  const [stats, setStats] = useState<RegistryStats | null>(null);
  const [filters, setFilters] = useState<RegistryQuery>(DEFAULT_FILTERS);
  const [searchDraft, setSearchDraft] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [records, setRecords] = useState<RegistryRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selected, setSelected] = useState<RegistryDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [previewPdf, setPreviewPdf] = useState<RegistryDocument | null>(null);
  const [previewWord, setPreviewWord] = useState<{ title: string; text: string; note: string; truncated: boolean } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [form] = Form.useForm();

  const refreshStats = useCallback(() => {
    void getStats().then(setStats).catch((e: unknown) => message.error(String(e)));
  }, []);

  useEffect(() => { refreshStats(); }, [refreshStats]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters(current => current.q === searchDraft ? current : { ...current, q: searchDraft });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchDraft]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError('');
    getRecords(filters, page, pageSize, controller.signal)
      .then(result => { setRecords(result.items); setTotal(result.total); })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [filters, page, pageSize]);

  const updateFilter = (name: keyof RegistryQuery, value: string) => {
    setPage(1);
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const clearFilters = () => {
    setSearchDraft('');
    setFilters(DEFAULT_FILTERS);
    setPage(1);
  };

  const openRecord = async (id: string) => {
    setDetailLoading(true);
    setSelected(null);
    try {
      setSelected(await getRecord(id));
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error));
    } finally {
      setDetailLoading(false);
    }
  };

  const openDoc = async (doc: RegistryDocument) => {
    if (doc.title.toLowerCase().endsWith('.pdf')) {
      setPreviewPdf(doc);
      return;
    }
    setPreviewWord(null);
    setPreviewLoading(true);
    try {
      setPreviewWord(await getDocxPreview(doc.sha256));
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error));
    } finally {
      setPreviewLoading(false);
    }
  };

  const save = async () => {
    try {
      const values = await form.validateFields() as Record<string, unknown>;
      setSaving(true);
      const uploads: File[] = files.flatMap(item => item.originFileObj ? [item.originFileObj] : []);
      const created = await addRecord(values, uploads);
      message.success('Методология сохранена в реестре');
      setShowNew(false);
      form.resetFields();
      setFiles([]);
      clearFilters();
      refreshStats();
      await openRecord(created.osm_id);
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) return;
      message.error(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  const columns: TableColumnsType<RegistryRow> = useMemo(() => [
    {
      title: 'Наименование методологии', dataIndex: 'title', key: 'title', width: 460,
      render: (text: string, row: RegistryRow) => (
        <div className="registry-name-cell">
          <a onClick={() => { void openRecord(row.osm_id); }}>{text}</a>
          <Text type="secondary" className="registry-id">{row.osm_id}</Text>
        </div>
      ),
    },
    { title: 'Орган', dataIndex: 'authority', key: 'authority', width: 130, render: (value: string) => value || '—' },
    { title: 'Приказ', key: 'order', width: 160, render: (_: unknown, row: RegistryRow) => (
      <div><Text strong>№ {row.order_number || '—'}</Text><div><Text type="secondary">{formatDate(row.order_date)}</Text></div></div>
    ) },
    { title: '№548', dataIndex: 'complies_548', key: 'complies_548', width: 100,
      render: (v: number) => v ? <Tag color="green">Да</Tag> : <Tag>Нет</Tag> },
    { title: 'Документы', dataIndex: 'documents_count', key: 'documents_count', width: 130,
      render: (v: number) => v > 0 ? <Tag color="blue">{v} файл(ов)</Tag> : <Text type="secondary">Нет файлов</Text> },
    { title: '', key: 'view', width: 84, render: (_: unknown, row: RegistryRow) => (
      <Tooltip title="Открыть карточку"><Button type="text" icon={<EyeOutlined />} onClick={() => { void openRecord(row.osm_id); }} /></Tooltip>
    ) },
  // openRecord intentionally reflects the latest state; the table also rerenders on page transitions.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], []);

  const linkedDocs = selected?.documents ?? [];

  return (
    <main className="registry-page">
      <div className="registry-container">
        <div className="registry-heading">
          <div>
            <div className="registry-eyebrow"><BookOutlined /> Электронный реестр</div>
            <Title level={2} style={{ margin: '6px 0 4px' }}>Официальные статистические методологии</Title>
            <Paragraph type="secondary" style={{ marginBottom: 0 }}>
              Поиск методологий, реквизиты приказов и документы. Исходная выгрузка от 20 октября 2026 года.
            </Paragraph>
          </div>
          <Space wrap>
            <Button icon={<DownloadOutlined />} href={exportUrl(filters)}>Выгрузить CSV</Button>
            <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => setShowNew(true)}>Добавить ОСМ</Button>
          </Space>
        </div>

        <Row gutter={[14, 14]} className="registry-stats">
          <Col xs={12} md={6}><Card><Statistic title="Методологий" value={stats?.total ?? '—'} prefix={<BookOutlined />} /></Card></Col>
          <Col xs={12} md={6}><Card><Statistic title="№548 — Да" value={stats?.complies_yes ?? '—'} prefix={<CheckCircleOutlined />} /></Card></Col>
          <Col xs={12} md={6}><Card><Statistic title="ОСМ с документами" value={stats?.with_documents ?? '—'} prefix={<LinkOutlined />} /></Card></Col>
          <Col xs={12} md={6}><Card><Statistic title="Файлов в хранилище" value={stats?.files ?? '—'} prefix={<FilePdfOutlined />} /></Card></Col>
        </Row>

        <Card className="registry-filter-card" title={<span><SearchOutlined /> Поиск и фильтры</span>} extra={
          <Button type="link" icon={<ClearOutlined />} onClick={clearFilters}>Сбросить</Button>
        }>
          <Row gutter={[12, 12]}>
            <Col xs={24} lg={12}>
              <Input.Search size="large" value={searchDraft} allowClear
                onChange={e => { setPage(1); setSearchDraft(e.target.value); }}
                placeholder="Название ОСМ, номер или название приказа, ID" />
            </Col>
            <Col xs={12} sm={8} lg={4}>
              <Select size="large" value={filters.complies_548} style={{ width: '100%' }}
                onChange={v => updateFilter('complies_548', v)}
                options={[{ value: '', label: 'Признак №548: все' }, { value: 'yes', label: '№548: Да' }, { value: 'no', label: '№548: Нет' }]} />
            </Col>
            <Col xs={12} sm={8} lg={4}>
              <Select size="large" value={filters.has_documents} style={{ width: '100%' }}
                onChange={v => updateFilter('has_documents', v)}
                options={[{ value: '', label: 'Все документы' }, { value: 'yes', label: 'Есть файлы' }, { value: 'no', label: 'Без файлов' }]} />
            </Col>
            <Col xs={24} sm={8} lg={4}>
              <Select size="large" showSearch optionFilterProp="label" value={filters.authority} style={{ width: '100%' }}
                onChange={v => updateFilter('authority', v)}
                options={[{ value: '', label: 'Все органы' }, ...(stats?.authorities ?? []).map(name => ({ value: name, label: name }))]} />
            </Col>
          </Row>
          <Row gutter={[12, 12]} style={{ marginTop: 12 }} align="middle">
            <Col xs={24} sm={8} lg={6}><Input placeholder="Позиция ФПСР (например, 1.16.1)" value={filters.fpsr} onChange={e => updateFilter('fpsr', e.target.value)} /></Col>
            <Col xs={12} sm={8} lg={5}><Input type="date" aria-label="Дата приказа от" value={filters.date_from} onChange={e => updateFilter('date_from', e.target.value)} /></Col>
            <Col xs={12} sm={8} lg={5}><Input type="date" aria-label="Дата приказа до" value={filters.date_to} onChange={e => updateFilter('date_to', e.target.value)} /></Col>
            <Col xs={24} lg={8}><Text type="secondary">Показаны результаты из локальной учебной базы, включая записи без файлов.</Text></Col>
          </Row>
        </Card>

        <Card className="registry-table-card" title={<Space><span>Каталог ОСМ</span><Tag>{total} записей</Tag></Space>}>
          {loadError && <Alert type="error" showIcon message="Не удалось загрузить реестр" description={loadError} style={{ marginBottom: 16 }} />}
          <Table<RegistryRow> rowKey="osm_id" loading={loading} columns={columns} dataSource={records} scroll={{ x: 1020 }}
            locale={{ emptyText: <Empty description="Нет методологий по выбранным условиям" /> }}
            pagination={{ current: page, pageSize, total, showSizeChanger: true, pageSizeOptions: [15, 30, 50],
              showTotal: (n, range) => `${range[0]}–${range[1]} из ${n}`,
              onChange: (newPage, newSize) => { setPage(newPage); setPageSize(newSize); } }} />
        </Card>
        <Alert type="info" showIcon className="registry-disclaimer"
          message="О связях с документами"
          description="Для исходных документов связь с ОСМ установлена по реквизитам приказа; содержательная принадлежность файла конкретной методологии не подтверждена. Признак №548 сохранён из выгрузки и не является оценкой юридической силы акта." />
      </div>

      <Drawer title="Карточка методологии" width={Math.min(860, typeof window !== 'undefined' ? window.innerWidth - 20 : 860)}
        open={!!selected || detailLoading} onClose={() => { setSelected(null); setDetailLoading(false); }}>
        {detailLoading ? <Spin /> : selected && <>
          <Space wrap style={{ marginBottom: 14 }}>
            <Tag color={selected.complies_548 ? 'green' : 'default'}>Приказ №548: {selected.complies_548 ? 'Да' : 'Нет'}</Tag>
            <Tag>{selected.authority || 'Орган не указан'}</Tag>
            <Tag>{linkedDocs.length ? `${linkedDocs.length} файл(ов)` : 'Без документов'}</Tag>
          </Space>
          <Title level={4}>{selected.title}</Title>
          <Text type="secondary" copyable={{ text: selected.osm_id }}>{selected.osm_id}</Text>
          <Descriptions bordered column={1} size="small" style={{ marginTop: 24 }}>
            <Descriptions.Item label="№ методологии">{selected.methodology_number || '—'}</Descriptions.Item>
            <Descriptions.Item label="Приказ">№ {selected.order_number || '—'} от {formatDate(selected.order_date)}</Descriptions.Item>
            <Descriptions.Item label="Орган">{selected.authority || '—'}</Descriptions.Item>
            <Descriptions.Item label="Название приказа"><div style={{ overflowWrap: 'anywhere' }}>{selected.order_title || '—'}</div></Descriptions.Item>
            <Descriptions.Item label="Позиции ФПСР">{selected.fpsr_list.length ? selected.fpsr_list.map(code => <Tag key={code}>{code}</Tag>) : '—'}</Descriptions.Item>
            <Descriptions.Item label="Источник">{/^https?:\/\//i.test(selected.source_url || '') ? (
              <a href={selected.source_url} target="_blank" rel="noopener noreferrer">Открыть исходную ссылку <LinkOutlined /></a>
            ) : 'Не указан'}</Descriptions.Item>
            <Descriptions.Item label="Ожидаемые имена файлов">{selected.expected_file_names || '—'}</Descriptions.Item>
          </Descriptions>
          <Title level={5} style={{ marginTop: 24 }}>Связанные документы ({linkedDocs.length})</Title>
          {linkedDocs.length === 0 ? <Empty description="К этой методологии файлы не прикреплены" /> : (
            <List dataSource={linkedDocs} bordered renderItem={doc => (
              <List.Item actions={[
                <Button key="preview" type="link" onClick={() => { void openDoc(doc); }} icon={<EyeOutlined />}>Просмотр</Button>,
                <Button key="download" type="link" href={originalUrl(doc.sha256, true)} icon={<ArrowDownOutlined />}>Скачать</Button>,
              ]}>
                <List.Item.Meta avatar={doc.title.toLowerCase().endsWith('.pdf') ? <FilePdfOutlined style={{ fontSize: 24, color: '#c0392b' }} /> : <FileWordOutlined style={{ fontSize: 24, color: '#2f65a7' }} />}
                  title={<span style={{ overflowWrap: 'anywhere' }}>{doc.title}</span>}
                  description={<Space direction="vertical" size={2}>
                    <Text type="secondary">{formatBytes(doc.size_bytes)}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>{doc.connection_type}</Text>
                  </Space>} />
              </List.Item>
            )} />
          )}
          <Alert style={{ marginTop: 18 }} type="warning" showIcon
            message="Ограничение атрибуции документов"
            description="В исходной выборке привязка файла к ОСМ выполнена по приказу. Принадлежность его содержания конкретной ОСМ не проверена." />
        </>}
      </Drawer>

      <Modal title={<Space><FilePdfOutlined /> Предпросмотр PDF: {previewPdf?.title}</Space>}
        width="92vw" style={{ top: 24 }} open={!!previewPdf} onCancel={() => setPreviewPdf(null)}
        destroyOnHidden footer={previewPdf ? [<Button key="download" type="primary" href={originalUrl(previewPdf.sha256, true)} icon={<DownloadOutlined />}>Скачать оригинал</Button>] : null}>
        {previewPdf && <iframe title={previewPdf.title} src={originalUrl(previewPdf.sha256)} style={{ width: '100%', height: '72vh', border: '1px solid #e8e8e8' }} />}
      </Modal>
      <Modal title={previewWord?.title || 'Предпросмотр DOCX'} width={840}
        open={!!previewWord || previewLoading} onCancel={() => { setPreviewWord(null); setPreviewLoading(false); }} footer={null}>
        {previewLoading ? <Spin /> : previewWord && <>
          <Alert type="info" showIcon message={previewWord.note} style={{ marginBottom: 16 }} />
          <div className="registry-docx-preview">{previewWord.text || 'Текстовых абзацев не найдено. Скачайте оригинал для просмотра.'}</div>
          {previewWord.truncated && <Text type="secondary">Показаны первые 30 000 символов.</Text>}
        </>}
      </Modal>

      <Modal title="Добавить официальную статистическую методологию" open={showNew} width={780}
        onCancel={() => { if (!saving) { setShowNew(false); form.resetFields(); setFiles([]); } }}
        onOk={() => { void save(); }} okText="Сохранить в реестре" okButtonProps={{ loading: saving }} cancelText="Отмена"
        destroyOnHidden>
        <Paragraph type="secondary">Реквизиты будут сохранены в SQLite. Документы можно прикрепить сейчас или оставить запись без файлов.</Paragraph>
        <Form form={form} layout="vertical" initialValues={{ complies_548: 'no', authority: 'Росстат' }}>
          <Form.Item label="Полное наименование ОСМ" name="title" rules={[{ required: true, whitespace: true, message: 'Введите наименование' }]}>
            <Input.TextArea autoSize={{ minRows: 2, maxRows: 5 }} maxLength={2000} showCount placeholder="Официальная статистическая методология…" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}><Form.Item label="№ методологии (необязательно)" name="methodology_number"><Input maxLength={100} /></Form.Item></Col>
            <Col span={12}><Form.Item label="Признак соответствия приказу №548" name="complies_548" rules={[{ required: true }]}>
              <Radio.Group><Radio value="yes">Да</Radio><Radio value="no">Нет</Radio></Radio.Group>
            </Form.Item></Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}><Form.Item label="Номер приказа" name="order_number" rules={[{ required: true, whitespace: true, message: 'Укажите номер' }]}><Input maxLength={100} /></Form.Item></Col>
            <Col span={8}><Form.Item label="Дата приказа" name="order_date" rules={[{ required: true, message: 'Укажите дату' }]}><Input type="date" /></Form.Item></Col>
            <Col span={8}><Form.Item label="Орган" name="authority" rules={[{ required: true, whitespace: true, message: 'Укажите орган' }]}><Input maxLength={200} /></Form.Item></Col>
          </Row>
          <Form.Item label="Полное название приказа" name="order_title"><Input.TextArea rows={2} maxLength={3000} /></Form.Item>
          <Form.Item label="Позиции ФПСР" name="fpsr_positions" extra="Несколько кодов перечислите через точку с запятой, например: 1.16.1; 1.19.17">
            <Input maxLength={1000} placeholder="1.16.1; 1.19.17" /></Form.Item>
          <Form.Item label="Ссылка на источник" name="source_url" rules={[{ type: 'url', warningOnly: true, message: 'Ожидается ссылка https://...' }]}>
            <Input placeholder="https://..." maxLength={2000} /></Form.Item>
          <Form.Item label="Документы (PDF или DOCX, до 10 файлов по 25 МБ)">
            <Upload multiple accept=".pdf,.docx" beforeUpload={() => false} fileList={files}
              onChange={info => setFiles(info.fileList.slice(-10))}>
              <Button icon={<CloudUploadOutlined />}>Выбрать документы</Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>
    </main>
  );
}
