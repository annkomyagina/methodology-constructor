import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type FieldValue = unknown;

interface ProjectState {
  values: Record<string, FieldValue>;
  setValue: (field: string, value: FieldValue) => void;
  reset: () => void;
  setAll: (values: Record<string, FieldValue>) => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      values: {},

      setValue: (field, value) =>
        set((state) => ({
          values: { ...state.values, [field]: value },
        })),

      setAll: (values) => set({ values }),

      reset: () => set({ values: {} }),
    }),
    {
      name: 'methodology-project-v1',
      version: 1,
    },
  ),
);