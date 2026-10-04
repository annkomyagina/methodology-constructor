import { FpsrInline, FpsrReadonly } from './FpsrInline';
import type { Block, FieldDef } from '../types/template';
import InlineField from './fields/InlineField';
import BlockField from './fields/BlockField';
import ChoiceText from './fields/ChoiceText';

interface Props {
  block: Extract<Block, { type: 'paragraph' }>;
  fields: Record<string, FieldDef>;
}

export default function ParagraphBlock({ block, fields }: Props) {
  return (
    <p style={{ lineHeight: 1.8, marginBottom: 12 }}>
      {block.parts.map((part, i) => {
        if (part.type === 'text') {
          return <span key={i}>{part.text}</span>;
        }

        if (part.type === 'field') {
          const def = fields[part.field];
          if (!def) return <span key={i} style={{ color: 'red' }}>[поле {part.field} не найдено]</span>;

          // Многострочное поле внутри абзаца показываем отдельным блоком
          if (def.multiline || def.type === 'block') {
            return <BlockField key={i} name={part.field} def={def} />;
          }
          return <InlineField key={i} name={part.field} def={def} />;
        }

        if (part.type === 'choice_text') {
          const def = fields[part.field] ?? {
            label: part.field,
            type: 'choice_text',
            default: part.default,
            options: part.options,
          };
          return <ChoiceText key={i} name={part.field} def={def} />;
        }

        if (part.type === 'fpsr_reference') {
  const p = part as {
    field: string;
    mode?: string;
    grammar_case?: 'instrumental' | 'dative';
    suffix?: string;
    empty_text?: string;
  };

  if (p.mode === 'readonly') {
    return (
        <FpsrReadonly
            key={i}
            field={p.field}
            grammaticalCase={p.grammar_case ?? 'dative'}
            suffix={p.suffix ?? ' ФПСР'}
            emptyText={p.empty_text}
            />
        );
    }

    return <FpsrInline key={i} field={p.field} />;
}

        return null;
      })}
    </p>
  );
}