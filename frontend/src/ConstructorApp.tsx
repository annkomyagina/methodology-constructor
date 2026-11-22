import { useEffect, useState } from 'react';
import {
  Layout,
  Menu,
  Spin,
  Alert,
  Typography,
  Empty,
  Button,
  Popconfirm,
  message,
  Modal,
  Tag,
  Drawer,
} from 'antd';
import {
  DownloadOutlined,
  CheckCircleTwoTone,
  ExclamationCircleTwoTone,
  MinusCircleTwoTone,
  RobotOutlined,
} from '@ant-design/icons';
import { getSection } from './api/client';
import type { Section } from './types/template';
import BlockRenderer from './components/BlockRenderer';
import AiAssistant from './components/AiAssistant';
import { useProjectStore } from './store/projectStore';
import { useValidation as useVal } from './hooks/useValidation';
import { useIsNarrow } from './hooks/useWindowWidth';

const { Header, Sider, Content } = Layout;
const { Title, Paragraph } = Typography;

export default function App() {
  const { manifest, results } = useVal();
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [section, setSection] = useState<Section | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);

  const isNarrow = useIsNarrow();

  useEffect(() => {
    if (!activeSectionId) return;
    setLoading(true);
    setError(null);
    getSection(activeSectionId)
      .then((s) => {
        setSection(s);
        const defaults: Record<string, unknown> = {};
        Object.entries(s.fields ?? {}).forEach(([name, def]) => {
          if (def.default !== undefined && def.default !== null) {
            defaults[name] = def.default;
          }
        });
        const current = useProjectStore.getState().values;
        Object.entries(defaults).forEach(([k, v]) => {
          if (current[k] === undefined) {
            useProjectStore.getState().setValue(k, v);
          }
        });
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [activeSectionId]);

  const renderStatusIcon = (sectionId: string) => {
    const r = results[sectionId];
    if (!r) return null;
    if (r.status === 'complete') return <CheckCircleTwoTone twoToneColor="#52c41a" />;
    if (r.status === 'problems') return <ExclamationCircleTwoTone twoToneColor="#faad14" />;
    return <MinusCircleTwoTone twoToneColor="#d9d9d9" />;
  };

  const totalSections = manifest?.sections.length ?? 0;
  const completedSections = Object.values(results).filter((r) => r.status === 'complete').length;

  const handleDownload = async () => {
    const incomplete = Object.entries(results)
      .filter(([, r]) => r.status !== 'complete')
      .map(([id, r]) => {
        const s = manifest?.sections.find((x) => x.id === id);
        return { title: s?.title ?? id, missing: r.missing };
      });

    const proceed = async () => {
      try {
        const values = useProjectStore.getState().values;
        const res = await fetch('/api/export/docx', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ values }),
        });
        if (!res.ok) {
          message.error('Ошибка генерации: ' + (await res.text()));
          return;
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'methodology.docx';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        message.success('Word-документ сформирован');
      } catch (e) {
        message.error('Ошибка: ' + String(e));
      }
    };

    if (incomplete.length === 0) {
      void proceed();
      return;
    }

    Modal.confirm({
      title: 'Не все разделы заполнены',
      width: '90%',
      style: { maxWidth: 640 },
      content: (
        <div>
          <Paragraph type="secondary">
            В документе будут пропущены или останутся пустыми следующие пункты:
          </Paragraph>
          {incomplete.map((s) => (
            <div key={s.title} style={{ marginBottom: 8 }}>
              <b>{s.title}</b>
              {s.missing.length > 0 && (
                <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                  {s.missing.map((m, i) => (
                    <Tag
                      key={i}
                      color="warning"
                      style={{
                        whiteSpace: 'normal',
                        wordBreak: 'break-word',
                        maxWidth: '100%',
                        display: 'inline-block',
                        height: 'auto',
                        lineHeight: 1.5,
                        padding: '4px 8px',
                        marginBottom: 4,
                        marginInlineEnd: 4,
                      }}
                    >
                      {m}
                    </Tag>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ),
      okText: 'Всё равно скачать',
      cancelText: 'Вернуться к заполнению',
      onOk: proceed,
    });
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
  style={{
    background: '#001529',
    paddingLeft: 24,
    paddingRight: 24,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    height: 'auto',
    minHeight: 64,
    flexWrap: 'wrap',
    paddingTop: 8,
    paddingBottom: 8,
  }}
>
  <Title
    level={4}
    style={{
      color: 'white',
      margin: 0,
      flex: '1 1 200px',
      minWidth: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      lineHeight: 1.3,
    }}
    ellipsis={{ rows: 1, tooltip: 'Конструктор официальной статистической методологии' }}
  >
    Конструктор официальной статистической методологии
  </Title>
  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Tag color={completedSections === totalSections ? 'green' : 'orange'}>
            Заполнено: {completedSections} / {totalSections}
          </Tag>
          <Button icon={<RobotOutlined />} onClick={() => setAiOpen(true)}>
            ИИ-помощник
          </Button>
          <Button
  icon={<DownloadOutlined />}
  onClick={() => {
    const values = useProjectStore.getState().values;
    const blob = new Blob(
      [JSON.stringify({ values }, null, 2)],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'example_project.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }}
>
  Скачать проект
</Button>
          <Button type="primary" icon={<DownloadOutlined />} onClick={handleDownload}>
            Скачать Word
          </Button>
          <Popconfirm
            title="Сбросить проект?"
            description="Все введённые данные будут удалены."
            okText="Да, сбросить"
            cancelText="Отмена"
            onConfirm={() => useProjectStore.getState().reset()}
          >
            <Button danger>Сбросить проект</Button>
          </Popconfirm>
        </div>
      </Header>

      <Layout>
        <Sider width={340} style={{ background: '#fff' }}>
          {manifest ? (
            <Menu
              mode="inline"
              style={{ height: '100%', borderRight: 0 }}
              selectedKeys={activeSectionId ? [activeSectionId] : []}
              onClick={(e) => setActiveSectionId(e.key)}
              items={manifest.sections.map((s) => ({
                key: s.id,
                label: (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                    <span style={{ flex: 1, minWidth: 0 }}>{s.title}</span>
                    <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                      {renderStatusIcon(s.id)}
                    </span>
                  </span>
                ),
              }))}
            />
          ) : (
            <div style={{ padding: 16 }}>
              <Spin />
            </div>
          )}
        </Sider>

        <Content style={{ padding: 24, background: '#f5f5f5', overflowY: 'auto', minWidth: 0 }}>
          {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} />}
          {!activeSectionId && (
            <Empty description="Выберите раздел слева" style={{ marginTop: 80 }} />
          )}
          {loading && <Spin />}
          {!loading && section && (
            <div style={{ background: '#fff', padding: 24, borderRadius: 8 }}>
              <Paragraph type="secondary">{section.description}</Paragraph>
              {section.blocks.map((block, i) => (
                <BlockRenderer key={i} block={block} fields={section.fields} />
              ))}
            </div>
          )}
        </Content>

        {!isNarrow && !aiOpen && (
          <Sider
            width={360}
            style={{ background: '#f0f2f5', padding: 12, overflowY: 'auto' }}
            theme="light"
          >
            <AiAssistant section={section} />
          </Sider>
        )}
      </Layout>

      <Drawer
        title="ИИ-помощник"
        placement="right"
        width={Math.min(420, window.innerWidth - 40)}
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        styles={{ body: { padding: 12 } }}
      >
        <AiAssistant section={section} />
      </Drawer>
    </Layout>
  );
}