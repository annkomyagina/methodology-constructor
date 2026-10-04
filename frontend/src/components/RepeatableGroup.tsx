import { Button, Card, Input, Space, Typography } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import type { FieldDef } from '../types/template';
import { useProjectStore } from '../store/projectStore';

const { Text } = Typography;

interface RowFieldDef {
  label?: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  hint?: string;
}

interface Props {
  /** Имя поля в хранилище, например "indicators" */
  name: string;
  /** Схема строки: { name: {...}, okei: {...} } */
  rowFields: Record<string, RowFieldDef>;
  /** Минимум строк (обычно 1) */
  minRows?: number;
  /** Метка кнопки "добавить" */
  buttonLabel?: string;
  /** Название блока для отображения сверху */
  title?: string;
  /** Подсказка сверху */
  hint?: string;
  /** Заблокировать удаление первой строки (для раздела V) */
  lockFirstRow?: boolean;
  /** Показывать номер пункта только у первой строки (для раздела V) */
  pointNumber?: string;
}

type Row = Record<string, string>;

export default function RepeatableGroup({
  name,
  rowFields,
  minRows = 1,
  buttonLabel = '+ Добавить',
  title,
  hint,
  lockFirstRow = false,
  pointNumber,
}: Props) {
  const rows = (useProjectStore((s) => s.values[name]) as Row[] | undefined) ?? [];
  const setValue = useProjectStore((s) => s.setValue);

  // Инициализация массива при первом рендере
  if (rows.length === 0 && minRows > 0) {
    const initial: Row[] = Array.from({ length: minRows }, () => {
      const row: Row = {};
      Object.keys(rowFields).forEach((k) => (row[k] = ''));
      return row;
    });
    setValue(name, initial);
    return null;
  }

  const updateRow = (index: number, field: string, value: string) => {
    const next = rows.map((r, i) => (i === index ? { ...r, [field]: value } : r));
    setValue(name, next);
  };

  const addRow = () => {
    const empty: Row = {};
    Object.keys(rowFields).forEach((k) => (empty[k] = ''));
    setValue(name, [...rows, empty]);
  };

  const removeRow = (index: number) => {
    if (lockFirstRow && index === 0) return;
    if (rows.length <= minRows) return;
    setValue(name, rows.filter((_, i) => i !== index));
  };

  return (
    <div style={{ marginTop: 12 }}>
      {title && <Text strong style={{ display: 'block', marginBottom: 4 }}>{title}</Text>}
      {hint && (
        <div style={{ color: '#888', fontSize: 13, marginBottom: 8 }}>
          {hint}
        </div>
      )}

      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        {rows.map((row, i) => {
          const showNumber = pointNumber && i === 0;
          return (
            <Card
              key={i}
              size="small"
              style={{ background: '#fafafa' }}
              bodyStyle={{ padding: 12 }}
            >
              <Space align="start" style={{ width: '100%', flexWrap: 'wrap' }} size="middle">
                {showNumber && (
                  <Text strong style={{ minWidth: 40 }}>{pointNumber}</Text>
                )}
                {Object.entries(rowFields).map(([fieldName, fieldDef]) => (
                  <div key={fieldName}>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                      {fieldDef.label ?? fieldName}
                    </Text>
                    <Input
                      value={row[fieldName] ?? ''}
                      placeholder={fieldDef.placeholder ?? ''}
                      onChange={(e) => updateRow(i, fieldName, e.target.value)}
                      style={{ minWidth: 220 }}
                    />
                  </div>
                ))}
                {!(lockFirstRow && i === 0) && rows.length > minRows && (
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => removeRow(i)}
                    style={{ marginTop: 20 }}
                  />
                )}
              </Space>
            </Card>
          );
        })}

        <Button type="dashed" icon={<PlusOutlined />} onClick={addRow} block>
          {buttonLabel}
        </Button>
      </Space>
    </div>
  );
}