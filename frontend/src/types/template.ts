// Типы для шаблона методологии.
// Описывают структуру JSON, которую отдаёт backend.

export interface SectionRef {
  id: string;
  number: string;
  title: string;
  file: string;
  required: boolean;
  status: string;
}

export interface Manifest {
  template_id: string;
  version: string;
  description: string;
  global_settings: {
    empty_required_field_output: string;
    default_word_font: string;
    default_word_font_size: number;
  };
  sections: SectionRef[];
}

// Описание одного поля
export interface FieldDef {
  label: string;
  type: string;
  placeholder?: string;
  required?: boolean;
  linked?: boolean;
  optional?: boolean;
  multiline?: boolean;
  hint?: string;
  source_comment?: string;
  ui_notes?: string;
  default?: unknown;
  options?: { value: string; label: string }[];
  row_fields?: Record<string, FieldDef>;
  min_items?: number;
  button_label?: string;
}

// Часть абзаца: либо текст, либо ссылка на поле
export type ParagraphPart =
  | { type: 'text'; text: string }
  | { type: 'field'; field: string }
  | { type: 'choice_text'; field: string; default?: string; options?: { value: string; label: string }[] }
  | { type: 'fpsr_reference'; field: string; mode?: string };

// Блок в разделе
export type Block =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; id?: string; parts: ParagraphPart[] }
  | { type: 'field_block'; field: string }
  | { type: 'repeatable_group'; id: string; field: string; [key: string]: unknown }
  | { type: 'formula_repeated_group'; id: string; field: string; [key: string]: unknown }
  | { type: 'classifier_paragraphs'; id: string; field: string; [key: string]: unknown }
  | { type: 'optional_group'; id: string; [key: string]: unknown }
  | { type: 'empty_state_output'; id: string; [key: string]: unknown };

// Полное описание раздела
export interface Section {
  section_id: string;
  number: string;
  title: string;
  description: string;
  required: boolean;
  status: string;
  fields: Record<string, FieldDef>;
  validation: {
    required: boolean;
    required_items: unknown[];
    optional_items: unknown[];
  };
  document_opening?: unknown;
  blocks: Block[];
}