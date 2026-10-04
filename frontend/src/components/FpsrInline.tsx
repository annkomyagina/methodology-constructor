import { useEffect, useMemo, useState } from 'react';
import {
  AutoComplete,
  Button,
  Input,
  Modal,
  Space,
  Tag,
  Typography,
} from 'antd';
import { EditOutlined } from '@ant-design/icons';
import { useProjectStore } from '../store/projectStore';

const { Text, Paragraph } = Typography;

interface FpsrItem {
  number: string;
  title: string;
}

interface FpsrCatalog {
  version: string;
  items_count: number;
  items: FpsrItem[];
}

type FpsrRow = { position: string; title: string };

// --- Кэш справочника на уровне модуля ---
let fpsrCache: FpsrCatalog | null = null;
let fpsrPromise: Promise<FpsrCatalog> | null = null;

function loadFpsr(): Promise<FpsrCatalog> {
  if (fpsrCache) return Promise.resolve(fpsrCache);
  if (!fpsrPromise) {
    fpsrPromise = fetch('/api/fpsr')
      .then((r) => {
        if (!r.ok) throw new Error(`Не удалось загрузить ФПСР (${r.status})`);
        return r.json();
      })
      .then((data: FpsrCatalog) => {
        fpsrCache = data;
        return data;
      });
  }
  return fpsrPromise;
}

// --- Формирование фразы ---
function formatFpsrPhrase(
  rows: FpsrRow[],
  grammaticalCase: 'instrumental' | 'dative' = 'instrumental',
  suffix = '',
): string {
  const numbers = rows.map((r) => r.position.trim()).filter(Boolean);
  if (numbers.length === 0) return '';
  const joined = numbers.join(', ');
  let phrase: string;
  if (grammaticalCase === 'instrumental') {
    phrase = numbers.length === 1 ? `позицией ${joined}` : `позициями ${joined}`;
  } else {
    phrase = numbers.length === 1 ? `позиции ${joined}` : `позициям ${joined}`;
  }
  return phrase + suffix;
}

// --- Утилита: убрать пустые строки ---
function normalizeRows(rows: FpsrRow[]): FpsrRow[] {
  return rows.filter((r) => r.position.trim() !== '');
}

// =============================================================
// Основной компонент — инлайн-редактор
// =============================================================
interface InlineProps {
  field: string;
}

export function FpsrInline({ field }: InlineProps) {
  const rows = (useProjectStore((s) => s.values[field]) as FpsrRow[] | undefined) ?? [];
  const setValue = useProjectStore((s) => s.setValue);

  const [open, setOpen] = useState(false);
  const [catalog, setCatalog] = useState<FpsrCatalog | null>(null);
  const [search, setSearch] = useState('');

  const cleanRows = normalizeRows(rows);
  const phrase = formatFpsrPhrase(cleanRows);

  useEffect(() => {
    if (open && !catalog) {
      loadFpsr().then(setCatalog).catch(() => setCatalog(null));
    }
  }, [open, catalog]);

  const options = useMemo(() => {
    if (!catalog || !search.trim()) return [];
    const q = search.trim().toLowerCase();
    return catalog.items
      .filter(
        (it) =>
          it.number.toLowerCase().includes(q) ||
          it.title.toLowerCase().includes(q),
      )
      .slice(0, 30)
      .map((it) => ({
        value: it.number,
        title: it.title,
        label: (
          <div>
            <div style={{ fontWeight: 500 }}>{it.number}</div>
            <div style={{ fontSize: 12, color: '#666' }}>
              {it.title.length > 140 ? it.title.slice(0, 140) + '…' : it.title}
            </div>
          </div>
        ),
      }));
  }, [catalog, search]);

  const addRow = (position: string, title: string) => {
    if (cleanRows.some((r) => r.position === position)) return;
    setValue(field, [...cleanRows, { position, title }]);
  };

  const removeRow = (position: string) => {
    setValue(
      field,
      cleanRows.filter((r) => r.position !== position),
    );
  };

  return (
    <>
      <span style={{ color: phrase ? 'inherit' : '#999' }}>
        {phrase || 'позицией ФПСР (не указана)'}
      </span>
      <Button
        type="link"
        size="small"
        icon={<EditOutlined />}
        onClick={() => setOpen(true)}
        style={{ padding: '0 4px' }}
      />

      <Modal
        title="Позиции Федерального плана статистических работ"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => setOpen(false)}
        okText="Готово"
        cancelText="Закрыть"
        width={720}
      >
        <Paragraph type="secondary">
          Введите номер или часть названия позиции ФПСР. Выбранные позиции
          сохранятся и будут автоматически подставлены в пункт 7.2.
        </Paragraph>

        <AutoComplete
          value={search}
          onChange={setSearch}
          onSelect={(value) => {
            const found = options.find((o) => o.value === value);
            if (found) addRow(found.value, found.title);
            setSearch('');
          }}
          options={options}
          style={{ width: '100%' }}
          popupMatchSelectWidth={560}
        >
          <Input.Search
            placeholder="Например: 1.2.2 или валовой внутренний продукт"
            loading={!catalog && open}
          />
        </AutoComplete>

        <div style={{ marginTop: 16 }}>
          <Text strong>Выбранные позиции:</Text>
          <div style={{ marginTop: 8 }}>
            {cleanRows.length === 0 && (
              <Text type="secondary">Пока ничего не выбрано</Text>
            )}
            <Space direction="vertical" style={{ width: '100%' }}>
              {cleanRows.map((r) => (
                <Tag
                  key={r.position}
                  closable
                  onClose={() => removeRow(r.position)}
                  style={{ whiteSpace: 'normal', padding: '4px 8px', fontSize: 13 }}
                >
                  <b>{r.position}</b> {r.title}
                </Tag>
              ))}
            </Space>
          </div>
        </div>
      </Modal>
    </>
  );
}

// =============================================================
// Readonly-версия (используется в пункте 7.2)
// =============================================================
interface ReadonlyProps {
  field: string;
  grammaticalCase?: 'instrumental' | 'dative';
  suffix?: string;
  emptyText?: string;
}

export function FpsrReadonly({
  field,
  grammaticalCase = 'dative',
  suffix = ' ФПСР',
  emptyText = 'позиции ФПСР, не заполненной в пункте 1.3',
}: ReadonlyProps) {
  const rows = (useProjectStore((s) => s.values[field]) as FpsrRow[] | undefined) ?? [];
  const phrase = formatFpsrPhrase(normalizeRows(rows), grammaticalCase, suffix);

  if (!phrase) {
    return <span style={{ color: '#999' }}>{emptyText}</span>;
  }
  return <span>{phrase}</span>;
}