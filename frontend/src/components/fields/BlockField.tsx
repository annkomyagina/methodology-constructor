import { Input, Tooltip } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import type { FieldDef } from '../../types/template';
import { useProjectStore } from '../../store/projectStore';

interface Props {
  name: string;
  def: FieldDef;
}

const { TextArea } = Input;

export default function BlockField({ name, def }: Props) {
  const value = useProjectStore((s) => s.values[name]) as string | undefined;
  const setValue = useProjectStore((s) => s.setValue);

  return (
    <div style={{ marginTop: 8 }}>
      {def.hint && (
        <div style={{ marginBottom: 6, color: '#888', fontSize: 13 }}>
          <QuestionCircleOutlined /> {def.hint}
        </div>
      )}
      <TextArea
        value={value ?? ''}
        placeholder={def.placeholder ?? ''}
        rows={6}
        onChange={(e) => setValue(name, e.target.value)}
        status={def.required && !value ? 'warning' : undefined}
      />
    </div>
  );
}