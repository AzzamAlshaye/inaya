import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AppData, Item, LogEntry, Preset, Settings, Task } from '../types';
import { createInitialData, loadData, saveData } from '../lib/storage';
import { addInterval } from '../lib/dates';
import { uid } from '../lib/id';
import { DEFAULT_PRESETS } from '../data/presets';

export interface Store {
  data: AppData;
  /** Replace state; returns the previous snapshot so callers can offer Undo. */
  restore: (snapshot: AppData) => void;
  addItem: (item: Omit<Item, 'id' | 'createdAt'>, tasks: Omit<Task, 'id' | 'itemId' | 'history'>[]) => Item;
  updateItem: (id: string, patch: Partial<Item>) => void;
  deleteItem: (id: string) => AppData;
  saveTask: (task: Omit<Task, 'id' | 'history'> & { id?: string }) => Task;
  deleteTask: (id: string) => AppData;
  markDone: (taskId: string, entry: Omit<LogEntry, 'id'>) => { previous: AppData; task: Task };
  deleteLogEntry: (taskId: string, entryId: string) => AppData;
  savePreset: (preset: Omit<Preset, 'id'> & { id?: string }) => Preset;
  deletePreset: (id: string) => AppData;
  resetBuiltInPresets: () => void;
  updateSettings: (patch: Partial<Settings>) => void;
  replaceAll: (data: AppData) => void;
  eraseAll: () => void;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const [data, setData] = useState<AppData | null>(null);
  const dataRef = useRef<AppData | null>(null);

  useEffect(() => {
    loadData().then((d) => {
      dataRef.current = d;
      setData(d);
    });
  }, []);

  const commit = useCallback((next: AppData) => {
    const prev = dataRef.current!;
    dataRef.current = next;
    setData(next);
    saveData(next).catch((e) => console.error('Save failed', e));
    return prev;
  }, []);

  const update = useCallback(
    (fn: (d: AppData) => AppData) => commit(fn(dataRef.current!)),
    [commit],
  );

  const store = useMemo<Store | null>(() => {
    if (!data) return null;
    return {
      data,
      restore: (snapshot) => commit(snapshot),
      addItem: (itemInput, tasks) => {
        const item: Item = { ...itemInput, id: uid(), createdAt: new Date().toISOString() };
        update((d) => ({
          ...d,
          items: [...d.items, item],
          tasks: [...d.tasks, ...tasks.map((t) => ({ ...t, id: uid(), itemId: item.id, history: [] }))],
        }));
        return item;
      },
      updateItem: (id, patch) =>
        update((d) => ({ ...d, items: d.items.map((i) => (i.id === id ? { ...i, ...patch, id } : i)) })),
      deleteItem: (id) =>
        update((d) => ({
          ...d,
          items: d.items.filter((i) => i.id !== id),
          tasks: d.tasks.filter((t) => t.itemId !== id),
        })),
      saveTask: (input) => {
        const existing = input.id ? dataRef.current!.tasks.find((t) => t.id === input.id) : undefined;
        const task: Task = existing
          ? { ...existing, ...input, id: existing.id }
          : { ...input, id: uid(), history: [] };
        update((d) => ({
          ...d,
          tasks: existing ? d.tasks.map((t) => (t.id === task.id ? task : t)) : [...d.tasks, task],
        }));
        return task;
      },
      deleteTask: (id) => update((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== id) })),
      markDone: (taskId, entry) => {
        let updated!: Task;
        const previous = update((d) => ({
          ...d,
          tasks: d.tasks.map((t) => {
            if (t.id !== taskId) return t;
            updated = {
              ...t,
              history: [{ ...entry, id: uid() }, ...t.history].sort((a, b) => b.date.localeCompare(a.date)),
              nextDue: addInterval(entry.date, t.every, t.unit),
            };
            return updated;
          }),
        }));
        return { previous, task: updated };
      },
      deleteLogEntry: (taskId, entryId) =>
        update((d) => ({
          ...d,
          tasks: d.tasks.map((t) =>
            t.id === taskId ? { ...t, history: t.history.filter((h) => h.id !== entryId) } : t,
          ),
        })),
      savePreset: (input) => {
        const preset: Preset = { ...input, id: input.id ?? uid() };
        update((d) => ({
          ...d,
          presets: d.presets.some((p) => p.id === preset.id)
            ? d.presets.map((p) => (p.id === preset.id ? preset : p))
            : [...d.presets, preset],
        }));
        return preset;
      },
      deletePreset: (id) => update((d) => ({ ...d, presets: d.presets.filter((p) => p.id !== id) })),
      resetBuiltInPresets: () =>
        update((d) => ({
          ...d,
          presets: [
            ...structuredClone(DEFAULT_PRESETS),
            ...d.presets.filter((p) => !DEFAULT_PRESETS.some((dp) => dp.id === p.id)),
          ],
        })),
      updateSettings: (patch) => update((d) => ({ ...d, settings: { ...d.settings, ...patch } })),
      replaceAll: (next) => commit(next),
      eraseAll: () => commit({ ...createInitialData(), settings: dataRef.current!.settings }),
    };
  }, [data, commit, update]);

  if (!store) return <>{fallback}</>;
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
