import { useEffect, useMemo } from 'react';
import {
  Button,
  Card,
  Input,
  Radio,
  Space,
  Tooltip,
  Typography,
} from 'antd';
import { DeleteOutlined, PlusOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import type { FieldDef } from '../types/template';
import { useProjectStore } from '../store/projectStore';

const { Text } = Typography;
const { TextArea } = Input;

interface CalcRow {
  symbol: string;
  formula_mode: 'site' | 'word';
  formula_input: string;
  formula: string;
  explanation: string;
}

interface Props {
  name: string;
  def: FieldDef;
  sourceField?: string;   // например "indicators"
  pointNumberStart?: string;   // например "6.2"
  formulaNumberStart?: number; // например 1
}

function emptyRow(): CalcRow {
  return {
    symbol: '',
    formula_mode: 'site',
    formula_input: '',
    formula: '',
    explanation: '',
  };
}

/**
 * Простая конвертация «человеческой» формулы в LaTeX-совместимый вид.
 * Не претендует на полноту — этого достаточно для типичных формул вида
 * X = (∑(C_i * W_i) / ∑W_i) * 100%
 */
function toLatex(input: string): string {
  if (!input.trim()) return '';
  let s = input;

  // Символы
  s = s.replace(/∑/g, '\\sum ');
  s = s.replace(/√\(/g, '\\sqrt{');
  s = s.replace(/√/g, '\\sqrt ');
  s = s.replace(/∫/g, '\\int ');

  // Умножение: · всегда, * — только между «не-буквами»
  s = s.replace(/·/g, '\\cdot ');
  s = s.replace(/(?<![A-Za-z0-9_])\*(?![A-Za-z0-9_])/g, '\\cdot ');

  // Фигурные скобки: если внутри кириллица — \text{}, иначе оставляем как есть
  s = s.replace(/\{([^{}]*)\}/g, (_m, inner: string) => {
    if (/[А-Яа-яЁё]/.test(inner)) {
      return `{\\text{${inner}}}`;
    }
    return `{${inner}}`;
  });

  // Индекс: _abc (одна или больше букв/цифр) → _{abc}
  // Многобуквенные индексы вроде NK, DH — берём целиком.
  s = s.replace(/_([A-Za-z0-9]+)/g, '_{$1}');

  // Верхний индекс: ^(...) → ^{...}
  s = s.replace(/\^\(([^)]*)\)/g, '^{$1}');
  // Верхний индекс: ^abc → ^{abc}
  s = s.replace(/\^([A-Za-z0-9]+)/g, '^{$1}');

  return s;
}

function KatexPreview({ math }: { math: string }) {
  const html = useMemo(() => {
    const latex = toLatex(math);
    if (!latex) return null;
    try {
      return katex.renderToString(latex, { throwOnError: false, displayMode: false });
    } catch {
      return null;
    }
  }, [math]);

  if (!html) {
    return (
      <span style={{ fontFamily: 'monospace', color: '#666' }}>
        {math || 'Предпросмотр появится после ввода формулы'}
      </span>
    );
  }
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function FormulaBlock({
  name,
  def,
  sourceField,
  pointNumberStart = '6.2',
  formulaNumberStart = 1,
}: Props) {
  const rows = (useProjectStore((s) => s.values[name]) as CalcRow[] | undefined) ?? [];
  const indicators = useProjectStore((s) => s.values[sourceField ?? '']) as
    | Record<string, string>[]
    | undefined;
  const setValue = useProjectStore((s) => s.setValue);

  // Автосинхронизация: количество расчётных блоков = количество показателей
  useEffect(() => {
    if (!sourceField) return;
    const indicatorsClean = (indicators ?? []).filter(
      (r) => (r?.name ?? '').trim() !== '',
    );
    const targetCount = indicatorsClean.length;

    if (targetCount === 0 && rows.length === 0) return;
    if (targetCount === 0) {
      setValue(name, []);
      return;
    }

    if (rows.length === targetCount) return;

    const next: CalcRow[] = Array.from({ length: targetCount }, (_, i) => rows[i] ?? emptyRow());
    setValue(name, next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicators]);

  const updateRow = (index: number, patch: Partial<CalcRow>) => {
    const next = rows.map((r, i) => (i === index ? { ...r, ...patch } : r));
    setValue(name, next);
  };

  const removeRow = (index: number) => {
    setValue(name, rows.filter((_, i) => i !== index));
  };

  const addRow = () => {
    setValue(name, [...rows, emptyRow()]);
  };

  const indicatorsClean = (indicators ?? []).filter((r) => (r?.name ?? '').trim() !== '');

  if (rows.length === 0) {
    return (
      <div
        style={{
          padding: 16,
          background: '#f5f5f5',
          border: '1px dashed #d9d9d9',
          borderRadius: 8,
          marginTop: 12,
          color: '#888',
        }}
      >
        Пока не заданы показатели в разделе IV. Заполните раздел «Основные показатели» —
        здесь автоматически появятся расчётные блоки.
        <div style={{ marginTop: 8 }}>
          <Button size="small" onClick={addRow}>+ Добавить блок вручную</Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 12 }}>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {rows.map((row, i) => {
          const indicatorName =
            indicatorsClean[i]?.name ?? 'наименование показателя';
          const okei = indicatorsClean[i]?.okei ?? '';
          const pointNumber = `${pointNumberStart.replace(/\.$/, '')}`;
          // 6.2, 6.3, 6.4, ... — нумеруем каждую строку отдельно
          const pointNum = (() => {
            const [major, minor] = pointNumberStart.split('.').map((x) => parseInt(x, 10));
            if (isNaN(major) || isNaN(minor)) return `${pointNumberStart}.${i + 1}`;
            return `${major}.${minor + i}.`;
          })();
          const formulaNumber = formulaNumberStart + i;

          return (
            <Card
              key={i}
              size="small"
              style={{ background: '#fafafa' }}
              bodyStyle={{ padding: 16 }}
            >
              <div style={{ lineHeight: 1.8, marginBottom: 12 }}>
                <Text>
                  {pointNum} Расчёт показателя «
                  <Text strong>{indicatorName}</Text>
                  {okei ? <>» (код по ОКЕИ — {okei})</> : '»'} осуществляется по формуле:
                </Text>
              </div>

              <div style={{ marginBottom: 12 }}>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                  Обозначение показателя в формуле
                </Text>
                <Input
                  value={row.symbol}
                  placeholder="например: Oy"
                  onChange={(e) => updateRow(i, { symbol: e.target.value })}
                  style={{ maxWidth: 240 }}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                  Режим формулы
                </Text>
                <Radio.Group
                  value={row.formula_mode}
                  onChange={(e) => updateRow(i, { formula_mode: e.target.value })}
                  size="small"
                >
                  <Radio.Button value="site">Сформировать на сайте</Radio.Button>
                  <Radio.Button value="word">Добавить в Word вручную</Radio.Button>
                </Radio.Group>
              </div>

              {row.formula_mode === 'site' && (
                <>
                  <div style={{ marginBottom: 8 }}>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                      Формула
                    </Text>
                    <TextArea
                      value={row.formula_input}
                      placeholder="Например: Oy = O_NK + O_DH"
                      rows={2}
                      onChange={(e) => updateRow(i, { formula_input: e.target.value })}
                    />
                  </div>
                  <div
                    style={{
                      padding: '8px 12px',
                      background: '#fff',
                      border: '1px solid #e8e8e8',
                      borderRadius: 6,
                      marginBottom: 12,
                      minHeight: 32,
                    }}
                  >
                    <Text type="secondary" style={{ fontSize: 11, marginRight: 8 }}>
                      Предпросмотр:
                    </Text>
                    <KatexPreview math={row.formula_input} />
                  </div>
                </>
              )}

              {row.formula_mode === 'word' && (
                <div
                  style={{
                    padding: 8,
                    background: '#fffbe6',
                    border: '1px solid #ffe58f',
                    borderRadius: 4,
                    color: '#874d00',
                    fontSize: 12,
                    marginBottom: 12,
                  }}
                >
                  В Word будет вставлена пометка «Требует заполнение в Word». Формулу
                  добавите в документе через <b>Вставка → Уравнение</b> (или Alt + =).
                </div>
              )}

              <div style={{ marginBottom: 8 }}>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                  <Tooltip title="Расшифруйте обозначения, использованные в формуле">
                    <QuestionCircleOutlined /> Расшифровка обозначений
                  </Tooltip>
                </Text>
                <TextArea
                  value={row.explanation}
                  placeholder="Одна строка на обозначение, например:&#10;Oy — выпуск товаров и услуг;&#10;O_NK — выпуск сектора «Нефинансовые корпорации»;&#10;O_DH — выпуск сектора «Домашние хозяйства»"
                  rows={4}
                  onChange={(e) => updateRow(i, { explanation: e.target.value })}
                />
              </div>

              <div style={{ textAlign: 'right' }}>
                <Button
                  size="small"
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => removeRow(i)}
                >
                  Удалить блок
                </Button>
              </div>
            </Card>
          );
        })}

        <Button type="dashed" icon={<PlusOutlined />} onClick={addRow} block>
          + Добавить расчётный блок
        </Button>
      </Space>
    </div>
  );
}