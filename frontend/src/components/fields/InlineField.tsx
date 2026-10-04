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
    <span style={{ display: 'inline-block', minWidth: 220 }}>
      <Input
        value={value ?? ''}
        placeholder={def.placeholder ?? ''}
        onChange={(e) => setValue(name, e.target.value)}
        status={def.required && !value ? 'warning' : undefined}
        suffix={
          def.hint ? (
            <Tooltip title={def.hint}>
              <QuestionCircleOutlined style={{ color: '#999' }} />
            </Tooltip>
          ) : null
        }
      />
    </span>
  );
}