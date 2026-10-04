import type { Section } from '../types/template';

export type SectionStatus = 'empty' | 'in_progress' | 'complete' | 'problems';

export interface SectionValidation {
  status: SectionStatus;
  filled: number;      // сколько обязательных пунктов заполнено
  total: number;       // сколько всего обязательных
  missing: string[];   // подписи незаполненных
}

function isNonEmptyString(v: unknown): boolean {
  return typeof v === 'string' && v.trim() !== '';
}

function isFpsrFilled(v: unknown): boolean {
  if (!Array.isArray(v)) return false;
  return v.some(
    (row) =>
      row &&
      typeof row === 'object' &&
      isNonEmptyString((row as Record<string, unknown>).position),
  );
}

function isRepeatedGroupFilled(v: unknown, requiredFields: string[]): boolean {
  if (!Array.isArray(v)) return false;
  return v.some((row) => {
    if (!row || typeof row !== 'object') return false;
    const r = row as Record<string, unknown>;
    return requiredFields.every((f) => isNonEmptyString(r[f]));
  });
}

function isFormulaGroupFilled(v: unknown): boolean {
  if (!Array.isArray(v)) return false;
  return v.some((row) => {
    if (!row || typeof row !== 'object') return false;
    const r = row as Record<string, unknown>;
    const mode = r.formula_mode;
    const formulaOk =
      mode === 'word' ? true : isNonEmptyString(r.formula_input);
    return (
      isNonEmptyString(r.symbol) &&
      formulaOk &&
      isNonEmptyString(r.explanation)
    );
  });
}

function isPublicationBlocksFilled(v: unknown): boolean {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return o.emiss === true || o.rosstat === true || o.additional === true;
}

function isClassifierFilled(v: unknown): boolean {
  if (!Array.isArray(v)) return false;
  return v.some(
    (row) =>
      row &&
      typeof row === 'object' &&
      isNonEmptyString((row as Record<string, unknown>).paragraph),
  );
}

/** Проверка одного пункта required_items. */
function checkRequiredItem(
  item: unknown,
  values: Record<string, unknown>,
  section: Section,
): { ok: boolean; label: string } {
  // Строка — просто имя поля
  if (typeof item === 'string') {
    const value = values[item];

    // Особые случаи
    if (item === 'fpsr_positions') {
      return { ok: isFpsrFilled(value), label: 'Позиции ФПСР' };
    }
    if (item === 'publication_blocks') {
      return { ok: isPublicationBlocksFilled(value), label: 'Способы размещения информации' };
    }

    // Обычное поле
    if (Array.isArray(value) || (value && typeof value === 'object')) {
      return { ok: true, label: section.fields?.[item]?.label ?? item };
    }
    return {
      ok: isNonEmptyString(value),
      label: section.fields?.[item]?.label ?? item,
    };
  }

  // Объект — сложное правило
  if (item && typeof item === 'object') {
    const o = item as Record<string, unknown>;
    const type = o.type as string | undefined;
    const id = o.id as string | undefined;
    const label = (o.label as string) ?? id ?? '';

    if (type === 'repeated_group' && id) {
      const requiredFields =
        (o.required_fields_per_row as string[]) ??
        (() => {
          const def = section.fields?.[id];
          const rowFields = def?.row_fields ?? {};
          return Object.entries(rowFields)
            .filter(([, v]) => (v as { required?: boolean }).required)
            .map(([k]) => k);
        })();
      return { ok: isRepeatedGroupFilled(values[id], requiredFields), label };
    }

    if (type === 'formula_repeated_group' && id) {
      return { ok: isFormulaGroupFilled(values[id]), label };
    }
  }

  return { ok: true, label: '' };
}

export function validateSection(
  section: Section,
  values: Record<string, unknown>,
): SectionValidation {
  const required = (section.validation?.required_items as unknown[]) ?? [];
  const optional = (section.validation?.optional_items as unknown[]) ?? [];

  // classifier_paragraphs иногда в required, но не как объект — проверим по имени
  const items = [...required];

  // Спец-случай: в разделе VI required_items содержит "classifier_paragraphs"
  const checked = items.map((it) => {
    if (it === 'classifier_paragraphs') {
      return {
        ok: isClassifierFilled(values['classifier_paragraphs']),
        label: 'Классификаторы',
      };
    }
    return checkRequiredItem(it, values, section);
  });

  const filled = checked.filter((c) => c.ok).length;
  const total = checked.length;
  const missing = checked.filter((c) => !c.ok).map((c) => c.label);

  // Есть ли хоть какие-то данные вообще
  const hasAnyData = Object.values(values).some((v) => {
    if (v === undefined || v === null) return false;
    if (typeof v === 'string') return v.trim() !== '';
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'object') return Object.keys(v as object).length > 0;
    return false;
  });

  let status: SectionStatus;
  if (filled === total && total > 0) status = 'complete';
  else if (filled > 0) status = 'problems';
  else status = hasAnyData ? 'in_progress' : 'empty';

  // опциональные не влияют на статус
  void optional;

  return { status, filled, total, missing };
}