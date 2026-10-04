import { Select, Radio, Space } from 'antd';
import type { FieldDef } from '../../types/template';
import { useProjectStore } from '../../store/projectStore';

interface Props {
  name: string;
  def: FieldDef;
}

// Порог: если самый длинный вариант длиннее — переключаемся на радио
const LONG_OPTION_THRESHOLD = 40;

export default function ChoiceText({ name, def }: Props) {
  const value =
    (useProjectStore((s) => s.values[name]) as string | undefined) ??
    def.default;
  const setValue = useProjectStore((s) => s.setValue);

  const options = def.options ?? [];
  if (options.length === 0) return null;

  const maxLen = Math.max(...options.map((o) => o.label.length));
  const useRadio = maxLen > LONG_OPTION_THRESHOLD;

  // Длинные формулировки — радио-кнопки в столбик
  if (useRadio) {
    return (
      <div style={{ margin: '8px 0' }}>
        <Radio.Group
          value={value as string}
          onChange={(e) => setValue(name, e.target.value)}
        >
          <Space direction="vertical">
            {options.map((o) => (
              <Radio key={o.value} value={o.value}>
                {o.label}
              </Radio>
            ))}
          </Space>
        </Radio.Group>
      </div>
    );
  }

  // Короткие варианты — селект
  return (
    <Select
      value={value as string}
      onChange={(v) => setValue(name, v)}
      options={options}
      style={{ minWidth: 140, maxWidth: 320, display: 'inline-block' }}
      size="small"
      popupMatchSelectWidth={false}
    />
  );
}