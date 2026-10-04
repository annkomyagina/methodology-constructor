import { useState } from 'react';
import { Button, Card, Input, Modal, Select, Space, Typography } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import type { FieldDef } from '../types/template';
import { useProjectStore } from '../store/projectStore';

const { Text } = Typography;
const { TextArea } = Input;

interface ClassifierOption {
  id: string;
  label: string;
  short_name: string;
  paragraph: string;
}

interface Props {
  name: string;
  def: FieldDef;
}

interface SelectedItem {
  kind: 'classifier' | 'custom';
  id?: string;
  label: string;
  paragraph: string;
}

export default function ClassifierParagraphs({ name, def }: Props) {
  const value = (useProjectStore((s) => s.values[name]) as SelectedItem[] | undefined) ?? [];
  const setValue = useProjectStore((s) => s.setValue);

  const [open, setOpen] = useState(false);
  const [customMode, setCustomMode] = useState(false);
  const [customText, setCustomText] = useState('');

  const options = (def.options as ClassifierOption[] | undefined) ?? [];

  const usedIds = new Set(value.filter((v) => v.kind === 'classifier').map((v) => v.id));

  const availableOptions = options
    .filter((o) => !usedIds.has(o.id))
    .map((o) => ({ value: o.id, label: o.label }));

  const addClassifier = (id: string) => {
    const opt = options.find((o) => o.id === id);
    if (!opt) return;
    setValue(name, [
      ...value,
      { kind: 'classifier', id: opt.id, label: opt.short_name, paragraph: opt.paragraph },
    ]);
    setOpen(false);
  };

  const addCustom = () => {
    if (!customText.trim()) return;
    setValue(name, [
      ...value,
      { kind: 'custom', label: 'Свой текст', paragraph: customText.trim() },
    ]);
    setCustomText('');
    setCustomMode(false);
    setOpen(false);
  };

  const remove = (index: number) => {
    setValue(name, value.filter((_, i) => i !== index));
  };

  return (
    <div style={{ marginTop: 12 }}>
      {value.map((item, i) => (
        <Card
          key={i}
          size="small"
          style={{ background: '#fafafa', marginBottom: 8 }}
          bodyStyle={{ padding: 12 }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text strong style={{ fontSize: 13 }}>
              {item.kind === 'classifier' ? `Классификатор: ${item.label}` : 'Свой абзац'}
            </Text>
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => remove(i)}
            />
          </div>
          <div style={{ fontSize: 13, color: '#444', lineHeight: 1.6 }}>
            {item.paragraph}
          </div>
        </Card>
      ))}

      <Button
        type="dashed"
        icon={<PlusOutlined />}
        onClick={() => setOpen(true)}
        block
      >
        {def.button_label ?? '+ Добавить классификатор или свой абзац'}
      </Button>

      <Modal
        title="Добавить классификатор или свой абзац"
        open={open}
        onCancel={() => {
          setOpen(false);
          setCustomMode(false);
          setCustomText('');
        }}
        footer={null}
        width={720}
      >
        {!customMode ? (
          <>
            <Text type="secondary">
              Выберите один из классификаторов. Готовый абзац вставится в раздел.
              Повторный выбор одного и того же классификатора запрещён.
            </Text>
            <Select
              style={{ width: '100%', marginTop: 12 }}
              placeholder="Начните вводить название..."
              showSearch
              optionFilterProp="label"
              options={availableOptions}
              onSelect={addClassifier}
              notFoundContent={availableOptions.length === 0 ? 'Все классификаторы уже добавлены' : undefined}
            />
            <div style={{ marginTop: 12, textAlign: 'center' }}>
              <Button type="link" onClick={() => setCustomMode(true)}>
                + Добавить свой текст
              </Button>
            </div>
          </>
        ) : (
          <>
            <Text type="secondary">
              Введите собственный абзац о классификаторе, справочнике или иной системе классификации.
            </Text>
            <TextArea
              rows={5}
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="Введите текст..."
              style={{ marginTop: 12 }}
            />
            <Space style={{ marginTop: 12 }}>
              <Button onClick={() => setCustomMode(false)}>Назад</Button>
              <Button type="primary" onClick={addCustom} disabled={!customText.trim()}>
                Добавить
              </Button>
            </Space>
          </>
        )}
      </Modal>
    </div>
  );
}