import { Button, Input, Switch, Typography } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import type { FieldDef } from '../types/template';
import { useProjectStore } from '../store/projectStore';

const { TextArea } = Input;
const { Text } = Typography;

interface Props {
  /** id блока, например "publication_emiss" */
  blockId: string;
  /** имя контроллера, например "publication_blocks.emiss" */
  controller: string;
  /** имя поля, например "publication_emiss_info" */
  field: string;
  /** тексты до и после поля */
  parts: { type: string; text?: string; field?: string }[];
  /** подпись кнопки, если блок выключен */
  buttonLabel?: string;
  /** определение поля из section.fields */
  fieldDef?: FieldDef;
}

export default function OptionalGroup({
  blockId,
  controller,
  field,
  parts,
  buttonLabel = '+ Включить блок',
  fieldDef,
}: Props) {
  const blocks =
    (useProjectStore((s) => s.values['publication_blocks']) as
      | Record<string, boolean>
      | undefined) ?? {};
  const fieldValue = useProjectStore((s) => s.values[field]) as string | undefined;
  const setValue = useProjectStore((s) => s.setValue);

  const key = controller.split('.').pop() ?? controller;
  const enabled = Boolean(blocks?.[key]);

  const toggle = (on: boolean) => {
    setValue('publication_blocks', { ...blocks, [key]: on });
    if (!on) setValue(field, '');
  };

  if (!enabled) {
    return (
      <div style={{ margin: '8px 0' }}>
        <Button size="small" onClick={() => toggle(true)}>
          {buttonLabel}
        </Button>
      </div>
    );
  }

  const isLong = fieldDef?.multiline;

  return (
    <div style={{ margin: '12px 0', padding: 12, background: '#fafafa', borderRadius: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text strong style={{ fontSize: 13 }}>
          {fieldDef?.label ?? blockId}
        </Text>
        <Button
          size="small"
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => toggle(false)}
        >
          Убрать
        </Button>
      </div>

      <div style={{ lineHeight: 1.8 }}>
        {parts.map((p, i) => {
          if (p.type === 'text') return <span key={i}>{p.text}</span>;
          if (p.type === 'field') {
            if (isLong) {
              return (
                <TextArea
                  key={i}
                  value={fieldValue ?? ''}
                  placeholder={fieldDef?.placeholder ?? ''}
                  rows={4}
                  onChange={(e) => setValue(field, e.target.value)}
                  style={{ marginTop: 4 }}
                />
              );
            }
            return (
              <Input
                key={i}
                value={fieldValue ?? ''}
                placeholder={fieldDef?.placeholder ?? ''}
                onChange={(e) => setValue(field, e.target.value)}
                style={{ minWidth: 300, maxWidth: 480, display: 'inline-block' }}
              />
            );
          }
          if (p.type === 'field_block') {
            return (
              <TextArea
                key={i}
                value={fieldValue ?? ''}
                placeholder={fieldDef?.placeholder ?? ''}
                rows={4}
                onChange={(e) => setValue(field, e.target.value)}
                style={{ marginTop: 4 }}
              />
            );
          }
          return null;
        })}
      </div>

      {fieldDef?.hint && (
        <div style={{ color: '#888', fontSize: 12, marginTop: 6 }}>
          {fieldDef.hint}
        </div>
      )}
    </div>
  );
}