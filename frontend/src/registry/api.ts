export interface RegistryStats {
  total: number;
  complies_yes: number;
  complies_no: number;
  with_documents: number;
  without_documents: number;
  files: number;
  links: number;
  authorities: string[];
  snapshot_date: string;
}

export interface RegistryRow {
  osm_id: string;
  title: string;
  methodology_number: string;
  order_number: string;
  order_date: string;
  authority: string;
  complies_548: number;
  fpsr_positions: string;
  documents_count: number;
}

export interface RegistryDocument {
  sha256: string;
  title: string;
  size_bytes: number;
  archive_path: string;
  connection_type: string;
}

export interface RegistryDetail extends Omit<RegistryRow, 'documents_count'> {
  order_title: string;
  expected_file_names: string;
  source_url: string;
  documents: RegistryDocument[];
  fpsr_list: string[];
}

export interface RegistryQuery {
  q: string;
  complies_548: string;
  has_documents: string;
  authority: string;
  date_from: string;
  date_to: string;
  fpsr: string;
}

const PREFIX = '/api/registry';

async function json<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    const content = await response.json().catch(() => ({})) as { detail?: unknown };
    const detail = typeof content.detail === 'string' ? content.detail : JSON.stringify(content.detail ?? {});
    throw new Error(`Ошибка ${response.status}: ${detail}`);
  }
  return response.json() as Promise<T>;
}

export function queryString(query: RegistryQuery): string {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value.trim()) params.set(key, value.trim());
  });
  return params.toString();
}

export function getStats(): Promise<RegistryStats> {
  return json(`${PREFIX}/stats`);
}

export function getRecords(query: RegistryQuery, page: number, pageSize: number, signal?: AbortSignal): Promise<{
  items: RegistryRow[]; total: number; page: number; page_size: number;
}> {
  const params = new URLSearchParams(queryString(query));
  params.set('page', String(page));
  params.set('page_size', String(pageSize));
  return json(`${PREFIX}/methodologies?${params}`, { signal });
}

export function getRecord(id: string): Promise<RegistryDetail> {
  return json(`${PREFIX}/methodologies/${encodeURIComponent(id)}`);
}

export function exportUrl(query: RegistryQuery): string {
  return `${PREFIX}/export.csv?${queryString(query)}`;
}

export function originalUrl(hash: string, download = false): string {
  return `${PREFIX}/documents/${hash}/file${download ? '?download=true' : ''}`;
}

export function getDocxPreview(hash: string): Promise<{ title: string; text: string; truncated: boolean; note: string }> {
  return json(`${PREFIX}/documents/${hash}/preview`);
}

export async function addRecord(values: Record<string, unknown>, uploads: File[]): Promise<{ osm_id: string }> {
  const form = new FormData();
  Object.entries(values).forEach(([key, value]) => {
    form.append(key, String(value ?? ''));
  });
  uploads.forEach(file => form.append('files', file, file.name));
  return json(`${PREFIX}/methodologies`, { method: 'POST', body: form });
}
