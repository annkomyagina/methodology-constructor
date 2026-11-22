import { Input, Tooltip } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import type { FieldDef } from '../../types/template';
import { useProjectStore } from '../../store/projectStore';

interface Props {
  name: string;
  def: FieldDef;
}

export default function InlineField({ name, def }: Props) {
  const value = useProjectStore((s) => s.values[name]) as string | undefined;
  const setValue = useProjectStore((s) => s.setValue);

  return (
    <span
      style={{
        display: 'inline-flex',
        width: 'min(380px, 100%)',
        maxWidth: '100%',
        verticalAlign: 'middle',
      }}
    >
      <Input
        value={value ?? ''}
        placeholder={def.placeholder ?? ''}
        onChange={(event) => setValue(name, event.target.value)}
        status={def.required && !value ? 'warning' : undefined}
        aria-label={def.label || name}
        suffix={
          def.hint ? (
            <Tooltip title={def.hint}>
              <QuestionCircleOutlined
                aria-label={`Подсказка: ${def.label || name}`}
                tabIndex={0}
                style={{ color: '#8c8c8c', cursor: 'help' }}
              />
            </Tooltip>
          ) : null
        }
      />
    </span>
  );
}
