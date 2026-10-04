import { useEffect, useState } from 'react';
import { getManifest, getSection } from '../api/client';
import { validateSection, type SectionValidation } from '../utils/validation';
import { useProjectStore } from '../store/projectStore';
import type { Manifest, Section } from '../types/template';

interface ValidationState {
  manifest: Manifest | null;
  sections: Record<string, Section>;
  results: Record<string, SectionValidation>;
  loading: boolean;
}

export function useValidation(): ValidationState {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [sections, setSections] = useState<Record<string, Section>>({});
  const [results, setResults] = useState<Record<string, SectionValidation>>({});
  const [loading, setLoading] = useState(true);

  const values = useProjectStore((s) => s.values);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const m = await getManifest();
        if (cancelled) return;
        setManifest(m);

        const loaded: Record<string, Section> = {};
        for (const s of m.sections) {
          loaded[s.id] = await getSection(s.id);
        }
        if (cancelled) return;
        setSections(loaded);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const next: Record<string, SectionValidation> = {};
    for (const [id, section] of Object.entries(sections)) {
      next[id] = validateSection(section, values as Record<string, unknown>);
    }
    setResults(next);
  }, [sections, values]);

  return { manifest, sections, results, loading };
}