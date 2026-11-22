import { Select, Radio, Space, Tooltip } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import type { FieldDef } from '../../types/template';
import { useProjectStore } from '../../store/projectStore';

interface Props {
  name: string;
  def: FieldDef;
}

const LONG_OPTION_THRESHOLD = 40;

export default function ChoiceText({ name, def }: Props) {
  const value =
    (useProjectStore((s) => s.values[name]) as string | undefined) ??
    def.default;
  const setValue = useProjectStore((s) => s.setValue);

  const options = def.options ?? [];
  if (options.length === 0) return null;

  const maxLen = Math.max(...options.map((option) => option.label.length));

  if (maxLen > LONG_OPTION_THRESHOLD) {
    return (
      <div style={{ margin: '8px 0' }}>
        <Radio.Group
          value={value as string}
          onChange={(e) => setValue(name, e.target.value)}
        >
          <Space direction="vertical">
            {options.map((option) => (
              <Radio key={option.value} value={option.value}>
                {option.label}
              </Radio>
            ))}
          </Space>
        </Radio.Group>
      </div>
    );
  }

  // Ant Design 6 использует flex для Select. Не переопределяем display на
  // inline-block: иначе стрелка переносится под выбранную формулировку.
  const width = Math.min(320, Math.max(170, maxLen * 9 + 52));

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        verticalAlign: 'middle',
        whiteSpace: 'nowrap',
        maxWidth: '100%',
      }}
    >
      <Select
        value={value as string}
        onChange={(nextValue) => setValue(name, nextValue)}
        options={options}
        style={{ width, maxWidth: '100%' }}
        size="small"
        popupMatchSelectWidth={false}
        aria-label={def.label || name}
      />
      {def.hint && (
        <Tooltip title={def.hint}>
          <QuestionCircleOutlined
            aria-label={`Подсказка: ${def.label || name}`}
            tabIndex={0}
            style={{ color: '#8c8c8c', fontSize: 14, cursor: 'help' }}
          />
        </Tooltip>
      )}
    </span>
  );
}
