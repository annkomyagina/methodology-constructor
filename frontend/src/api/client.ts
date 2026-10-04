import type { Manifest, Section } from '../types/template';

// Все запросы идут на /api/... — Vite проксирует на backend (см. vite.config.ts)
const BASE = '/api';

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ошибка ${response.status}: ${text}`);
  }
  return response.json() as Promise<T>;
}

export function getManifest(): Promise<Manifest> {
  return getJson<Manifest>(`${BASE}/template`);
}

export function getSection(sectionId: string): Promise<Section> {
  return getJson<Section>(`${BASE}/template/sections/${sectionId}`);
}

export interface AiAssistRequest {
  action: 'improve' | 'explain' | 'suggest' | 'check';
  section_title?: string;
  section_description?: string;
  field_label?: string;
  field_hint?: string;
  current_text?: string;
  context?: Record<string, unknown>;
}

export interface AiAssistResponse {
  answer: string;
}

export async function askAi(payload: AiAssistRequest): Promise<AiAssistResponse> {
  const res = await fetch('/api/ai/assist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ошибка ИИ (${res.status}): ${text}`);
  }
  return res.json();
}