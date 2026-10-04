import ClassifierParagraphs from './ClassifierParagraphs';
import FormulaBlock from './FormulaBlock';
import OptionalGroup from './OptionalGroup';
import { Typography } from 'antd';
import type { Block, FieldDef } from '../types/template';
import ParagraphBlock from './ParagraphBlock';
import BlockField from './fields/BlockField';
import RepeatableGroup from './RepeatableGroup';

const { Title } = Typography;

interface Props {
  block: Block;
  fields: Record<string, FieldDef>;
}

export default function BlockRenderer({ block, fields }: Props) {
  if (block.type === 'heading') {
    return <Title level={2}>{block.text}</Title>;
  }

  if (block.type === 'paragraph') {
    return <ParagraphBlock block={block} fields={fields} />;
  }

  if (block.type === 'field_block') {
    const def = fields[block.field];
    if (!def) return null;
    return <BlockField name={block.field} def={def} />;
  }

  if (block.type === 'repeatable_group') {
    const def = fields[block.field];
    if (!def || !def.row_fields) return null;

    // Приводим row_fields к нужному виду
    const rowFields: Record<string, { label?: string; placeholder?: string; required?: boolean }> = {};
    Object.entries(def.row_fields).forEach(([k, v]) => {
      rowFields[k] = {
        label: v.label,
        placeholder: v.placeholder,
        required: v.required,
      };
    });

    // Для раздела V: показывать номер 5.2 у первой строки
    const b = block as Record<string, unknown>;
    const numberingRule = b.numbering_rule as { point_number?: string } | undefined;
    const lockFirstRow = Boolean(b.lock_first_row);
    const buttonLabel = (b.button_label as string) ?? def.button_label ?? '+ Добавить';

    return (
      <RepeatableGroup
        name={block.field}
        rowFields={rowFields}
        minRows={(b.min_rows as number) ?? 1}
        buttonLabel={buttonLabel}
        lockFirstRow={lockFirstRow}
        pointNumber={numberingRule?.point_number}
      />
    );
  }

  if (block.type === 'optional_group') {
  const b = block as Record<string, unknown>;
  const parts = (b.parts as { type: string; text?: string; field?: string }[]) ?? [];
  const fieldName = b.field as string;
  const fieldDef = fields[fieldName];

  return (
    <OptionalGroup
      key={b.id as string}
      blockId={b.id as string}
      controller={b.controller as string}
      field={fieldName}
      parts={parts}
      buttonLabel={b.button_label as string}
      fieldDef={fieldDef}
    />
  );
}

if (block.type === 'empty_state_output') {
  // Не отображаем в UI — используется только при генерации Word
  return null;
}

if (block.type === 'formula_repeated_group') {
  const def = fields[block.field];
  if (!def) return null;
  const b = block as Record<string, unknown>;
  return (
    <FormulaBlock
      name={block.field}
      def={def}
      sourceField={b.source as string | undefined}
      pointNumberStart={b.point_number_start as string | undefined}
      formulaNumberStart={b.formula_number_start as number | undefined}
    />
  );
}

if (block.type === 'classifier_paragraphs') {
  const def = fields[block.field];
  if (!def) return null;
  return <ClassifierParagraphs name={block.field} def={def} />;
}

  // Сюда попадут только те блоки, которые мы ещё не реализовали.
  // После обработки всех известных типов TypeScript сужает block до never,
  // поэтому приводим тип явно.
  const unknownBlock = block as { type?: string };

  return (
    <div
      style={{
        padding: 12,
        background: '#f0f0f0',
        borderRadius: 4,
        color: '#666',
        fontSize: 13,
        margin: '12px 0',
      }}
    >
      Блок типа «{unknownBlock.type ?? 'неизвестный'}» пока не реализован
    </div>
  );
}