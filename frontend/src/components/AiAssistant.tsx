import { useState } from 'react';
import { Button, Card, Input, Space, Spin, Typography, message } from 'antd';
import {
  BulbOutlined,
  CheckCircleOutlined,
  EditOutlined,
  QuestionCircleOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import { askAi, type AiAssistRequest } from '../api/client';
import { useProjectStore } from '../store/projectStore';
import type { Section } from '../types/template';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

interface Props {
  section: Section | null;
}

const ACTIONS: { key: AiAssistRequest['action']; label: string; icon: React.ReactNode }[] = [
  { key: 'explain', label: 'Объяснить', icon: <QuestionCircleOutlined /> },
  { key: 'improve', label: 'Улучшить', icon: <EditOutlined /> },
  { key: 'suggest', label: 'Предложить', icon: <BulbOutlined /> },
  { key: 'check', label: 'Проверить', icon: <CheckCircleOutlined /> },
];

export default function AiAssistant({ section }: Props) {
  const [userText, setUserText] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastAction, setLastAction] = useState<AiAssistRequest['action'] | null>(null);

  const ask = async (action: AiAssistRequest['action']) => {
    setLoading(true);
    setAnswer('');
    setLastAction(action);
    try {
      const values = useProjectStore.getState().values;

      // Собираем контекст: только небольшие строковые значения
      const context: Record<string, string> = {};
      Object.entries(values).forEach(([k, v]) => {
        if (typeof v === 'string' && v.trim()) {
          context[k] = v.length > 300 ? v.slice(0, 300) + '…' : v;
        }
      });

      const payload: AiAssistRequest = {
        action,
        section_title: section?.title ?? '',
        section_description: section?.description ?? '',
        current_text: userText || undefined,
        context,
      };

      const res = await askAi(payload);
      setAnswer(res.answer);
    } catch (e) {
      message.error(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      size="small"
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
      bodyStyle={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}
      title={
        <span>
          <RobotOutlined /> ИИ-помощник
        </span>
      }
    >
      <Text type="secondary" style={{ fontSize: 12 }}>
        Контекст: раздел <b>{section?.title ?? 'не выбран'}</b>
      </Text>

      <TextArea
        rows={4}
        placeholder="Выделите фрагмент или опишите, что нужно сделать. Если оставить пустым — ИИ будет работать по разделу и заполненным полям."
        value={userText}
        onChange={(e) => setUserText(e.target.value)}
      />

      <Space wrap>
        {ACTIONS.map((a) => (
          <Button
            key={a.key}
            size="small"
            icon={a.icon}
            onClick={() => ask(a.key)}
            disabled={loading}
          >
            {a.label}
          </Button>
        ))}
      </Space>

      {loading && (
        <div style={{ textAlign: 'center', padding: 20 }}>
          <Spin /> <Text type="secondary">ИИ думает...</Text>
        </div>
      )}

      {!loading && answer && (
        <div
          style={{
            background: '#f6ffed',
            border: '1px solid #b7eb8f',
            borderRadius: 6,
            padding: 10,
            flex: 1,
            overflowY: 'auto',
          }}
        >
          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
            Ответ ({ACTIONS.find((a) => a.key === lastAction)?.label}):
          </Text>
          <Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 0, fontSize: 13 }}>
            {answer}
          </Paragraph>
          <Space style={{ marginTop: 8 }}>
            <Button
              size="small"
              onClick={() => {
                navigator.clipboard.writeText(answer);
                message.success('Скопировано');
              }}
            >
              Скопировать
            </Button>
          </Space>
        </div>
      )}

      {!loading && !answer && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          Нажмите одну из кнопок выше, чтобы получить помощь.
        </Text>
      )}
    </Card>
  );
}