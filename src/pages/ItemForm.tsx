import { useId, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useStore } from '../state/store';
import { firstDue, todayISO } from '../lib/dates';
import { PageHeader } from '../components/Layout';
import { ColorPicker, IconPicker, IntervalInput } from '../components/Pickers';
import type { IntervalUnit } from '../types';
import { uid } from '../lib/id';
import { useToast } from '../components/Toast';
import { Icon } from '../components/Icon';

/** A task chosen in the add flow: a preset suggestion or one the user typed. */
interface PickedTask {
  id: string;
  titleKey?: string;
  title?: string;
  every: number;
  unit: IntervalUnit;
  custom?: boolean;
}

/** Create a new item. Preset tasks are suggestions the user adds by tapping. */
export function AddItemPage() {
  const i18n = useI18n();
  const { t, presetName, taskTitle, formatInterval, formatDate, formatNumber } = i18n;
  const store = useStore();
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const formId = useId();
  const { presets } = store.data;

  const [presetId, setPresetId] = useState(params.get('preset') ?? presets[0]?.id ?? '');
  const preset = presets.find((p) => p.id === presetId);
  const [name, setName] = useState('');
  /** Ids of suggestions the user added (nothing is added automatically). */
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [customTasks, setCustomTasks] = useState<PickedTask[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newEvery, setNewEvery] = useState(1);
  const [newUnit, setNewUnit] = useState<IntervalUnit>('month');
  const [newError, setNewError] = useState(false);
  const [error, setError] = useState(false);
  const today = todayISO();
  const [startDate, setStartDate] = useState(today);
  /** Task id → last-done date, for tasks ticked "Done before". */
  const [lastDone, setLastDone] = useState<Record<string, string>>({});

  const setDoneBefore = (id: string, on: boolean) =>
    setLastDone((m) => {
      const next = { ...m };
      if (on) next[id] = startDate < today ? startDate : today;
      else delete next[id];
      return next;
    });

  const choosePreset = (id: string) => {
    setPresetId(id);
    setSelected(new Set());
  };

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const addCustom = () => {
    if (!newTitle.trim() || newEvery < 1) {
      setNewError(true);
      document.getElementById(`${formId}-newtitle`)?.focus();
      return;
    }
    setCustomTasks((list) => [...list, { id: uid(), title: newTitle.trim(), every: newEvery, unit: newUnit, custom: true }]);
    setNewTitle('');
    setNewError(false);
    document.getElementById(`${formId}-newtitle`)?.focus();
  };

  const suggestions: PickedTask[] = preset?.tasks ?? [];
  const picked = [...suggestions.filter((pt) => selected.has(pt.id)), ...customTasks];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    // A blank name falls back to the preset name, except for the empty
    // "Custom" preset where that name would be meaningless.
    const fallback = preset && preset.tasks.length > 0 ? presetName(preset) : '';
    const finalName = name.trim() || fallback;
    if (!finalName) {
      setError(true);
      document.getElementById(`${formId}-name`)?.focus();
      return;
    }
    const start = startDate || today;
    const item = store.addItem(
      {
        name: finalName,
        presetId: preset?.id,
        icon: preset?.icon ?? '⭐',
        color: preset?.color ?? '#64748b',
        startDate: start,
      },
      picked.map((pt) => {
        // A "last done" date can never be in the future.
        const done = lastDone[pt.id] ? (lastDone[pt.id] > today ? today : lastDone[pt.id]) : undefined;
        return {
          titleKey: pt.title ? undefined : pt.titleKey,
          title: pt.title,
          every: pt.every,
          unit: pt.unit,
          nextDue: firstDue(pt.every, pt.unit, start, done),
          remind: true,
          history: done ? [{ date: done }] : [],
        };
      }),
    );
    toast(t('item.created', { name: item.name }));
    navigate(`/item/${item.id}`, { replace: true });
  };

  /** "Done before" controls shown under a picked task. */
  const doneBefore = (pt: PickedTask, label: string) => {
    const done = lastDone[pt.id];
    return (
      <div className="done-before">
        <label className="inline-check">
          <input type="checkbox" checked={done !== undefined} onChange={(e) => setDoneBefore(pt.id, e.target.checked)} />
          <span>
            {t('item.doneBefore')}
            <span className="visually-hidden">: {label}</span>
          </span>
        </label>
        {done !== undefined && (
          <label className="inline-date">
            <span>
              {t('task.lastDoneOn')}
              <span className="visually-hidden">: {label}</span>
            </span>
            <input
              type="date"
              value={done}
              max={today}
              onChange={(e) => setLastDone((m) => ({ ...m, [pt.id]: e.target.value }))}
            />
          </label>
        )}
      </div>
    );
  };

  const dueText = (pt: PickedTask) =>
    t('task.willBeDue', { date: formatDate(firstDue(pt.every, pt.unit, startDate || today, lastDone[pt.id])) });

  return (
    <>
      <PageHeader title={t('item.add')} back />
      <form id={formId} className="form page-form" onSubmit={submit} noValidate>
        <fieldset className="field card-step">
          <legend className="step-title">{t('item.choosePreset')}</legend>
          <div className="preset-choices">
            {presets.map((p) => (
              <label
                key={p.id}
                className={`preset-choice${p.id === presetId ? ' selected' : ''}`}
                style={{ '--accent': p.color } as React.CSSProperties}
              >
                <input
                  type="radio"
                  name={`${formId}-preset`}
                  value={p.id}
                  checked={p.id === presetId}
                  onChange={() => choosePreset(p.id)}
                  className="visually-hidden"
                />
                <span className="preset-icon" aria-hidden="true">
                  {p.icon}
                </span>
                <span>{presetName(p)}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="field card-step">
          <label htmlFor={`${formId}-name`} className="step-title">
            {t('item.details')}
          </label>
          <input
            id={`${formId}-name`}
            type="text"
            value={name}
            placeholder={preset && preset.tasks.length > 0 ? presetName(preset) : t('item.namePlaceholder')}
            aria-describedby={error ? `${formId}-name-err` : `${formId}-name-hint`}
            aria-invalid={error || undefined}
            onChange={(e) => {
              setName(e.target.value);
              setError(false);
            }}
          />
          <p id={`${formId}-name-hint`} className="hint">
            {t('item.namePlaceholder')}
          </p>
          {error && (
            <p id={`${formId}-name-err`} className="error" role="alert">
              {t('required')}
            </p>
          )}
        </div>

        <div className="field card-step">
          <label htmlFor={`${formId}-start`} className="step-title">
            {t('item.startTitle')}
          </label>
          <input
            id={`${formId}-start`}
            type="date"
            value={startDate}
            aria-describedby={`${formId}-start-hint`}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <p id={`${formId}-start-hint`} className="hint">
            {t('item.startHint')}
          </p>
        </div>

        <fieldset className="field card-step">
          <legend className="step-title">{t('item.chooseTasks')}</legend>
          <p className="hint">{t('item.chooseTasksHint')}</p>

          {suggestions.length > 0 && (
            <>
              <div className="suggest-head">
                <h3>{t('item.suggestionsFor', { name: preset ? presetName(preset) : '' })}</h3>
                {selected.size < suggestions.length ? (
                  <button type="button" className="btn btn-text" onClick={() => setSelected(new Set(suggestions.map((x) => x.id)))}>
                    <Icon name="plus" size={20} />
                    {t('item.selectAll')}
                  </button>
                ) : (
                  <button type="button" className="btn btn-text" onClick={() => setSelected(new Set())}>
                    {t('item.selectNone')}
                  </button>
                )}
              </div>
              <ul className="suggest-list" role="list">
                {suggestions.map((pt) => {
                  const label = taskTitle(pt);
                  const on = selected.has(pt.id);
                  return (
                    <li key={pt.id} className={`task-pick${on ? ' on' : ''}`}>
                      <label className="suggest-row">
                        <input
                          type="checkbox"
                          className="visually-hidden"
                          checked={on}
                          onChange={() => toggle(pt.id)}
                          aria-labelledby={`${formId}-${pt.id}-name`}
                          aria-describedby={`${formId}-${pt.id}-info`}
                        />
                        <span className="suggest-toggle" aria-hidden="true">
                          <Icon name={on ? 'check' : 'plus'} size={20} />
                        </span>
                        <span className="check-label">
                          <span id={`${formId}-${pt.id}-name`} className="suggest-title">
                            {label}
                          </span>
                          <span className="muted" id={`${formId}-${pt.id}-info`}>
                            {formatInterval(pt.every, pt.unit)}
                            {on && <> · {dueText(pt)}</>}
                          </span>
                        </span>
                      </label>
                      {on && doneBefore(pt, label)}
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {customTasks.length > 0 && (
            <ul className="suggest-list" role="list" aria-label={t('item.ownTasks')}>
              {customTasks.map((pt) => (
                <li key={pt.id} className="task-pick on">
                  <div className="suggest-row">
                    <span className="suggest-toggle" aria-hidden="true">
                      <Icon name="check" size={20} />
                    </span>
                    <span className="check-label">
                      <span className="suggest-title">{pt.title}</span>
                      <span className="muted">
                        {formatInterval(pt.every, pt.unit)} · {dueText(pt)}
                      </span>
                    </span>
                    <button
                      type="button"
                      className="icon-btn danger"
                      onClick={() => setCustomTasks((list) => list.filter((x) => x.id !== pt.id))}
                      aria-label={t('item.removeOwn', { name: pt.title! })}
                    >
                      <Icon name="close" />
                    </button>
                  </div>
                  {doneBefore(pt, pt.title!)}
                </li>
              ))}
            </ul>
          )}

          <div className="own-task">
            <h3>{t('item.addOwn')}</h3>
            <div className="field">
              <label htmlFor={`${formId}-newtitle`}>{t('task.title')}</label>
              <input
                id={`${formId}-newtitle`}
                type="text"
                value={newTitle}
                placeholder={t('task.titlePlaceholder')}
                aria-invalid={newError || undefined}
                onChange={(e) => {
                  setNewTitle(e.target.value);
                  setNewError(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustom();
                  }
                }}
              />
            </div>
            <IntervalInput
              every={newEvery}
              unit={newUnit}
              onChange={(n, u) => {
                setNewEvery(n);
                setNewUnit(u);
              }}
            />
            {newError && (
              <p className="error" role="alert">
                {t('required')}
              </p>
            )}
            <button type="button" className="btn btn-secondary" onClick={addCustom}>
              <Icon name="plus" />
              {t('item.addOwnButton')}
            </button>
          </div>
        </fieldset>

        <div className="form-actions sticky-actions">
          <p className="picked-count" aria-live="polite">
            {t('item.pickedCount', { n: formatNumber(picked.length) })}
          </p>
          <button type="submit" className="btn btn-primary btn-large">
            <Icon name="check" />
            {t('item.create')}
          </button>
        </div>
      </form>
    </>
  );
}

/** Edit an existing item's name, icon, color and notes. */
export function EditItemPage() {
  const { t } = useI18n();
  const { itemId } = useParams();
  const store = useStore();
  const navigate = useNavigate();
  const toast = useToast();
  const formId = useId();
  const item = store.data.items.find((i) => i.id === itemId);
  const [name, setName] = useState(item?.name ?? '');
  const [icon, setIcon] = useState(item?.icon ?? '⭐');
  const [color, setColor] = useState(item?.color ?? '#64748b');
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [startDate, setStartDate] = useState(item?.startDate ?? '');
  const [error, setError] = useState(false);

  if (!item) {
    return (
      <>
        <PageHeader title={t('item.edit')} back="/" />
        <p className="section">{t('item.notFound')}</p>
      </>
    );
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(true);
      document.getElementById(`${formId}-name`)?.focus();
      return;
    }
    store.updateItem(item.id, { name: name.trim(), icon, color, notes: notes.trim() || undefined, startDate: startDate || undefined });
    toast(t('task.saved'));
    navigate(-1);
  };

  return (
    <>
      <PageHeader title={t('item.edit')} back />
      <form className="form page-form" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor={`${formId}-name`}>{t('name')}</label>
          <input
            id={`${formId}-name`}
            type="text"
            value={name}
            required
            aria-invalid={error || undefined}
            aria-describedby={error ? `${formId}-err` : undefined}
            onChange={(e) => {
              setName(e.target.value);
              setError(false);
            }}
          />
          {error && (
            <p id={`${formId}-err`} className="error" role="alert">
              {t('required')}
            </p>
          )}
        </div>
        <div className="field">
          <label htmlFor={`${formId}-start`}>{t('item.startDate')}</label>
          <input id={`${formId}-start`} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <IconPicker value={icon} onChange={setIcon} />
        <ColorPicker value={color} onChange={setColor} />
        <div className="field">
          <label htmlFor={`${formId}-notes`}>
            {t('notes')} <span className="muted">{t('optional')}</span>
          </label>
          <textarea id={`${formId}-notes`} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="form-actions sticky-actions">
          <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>
            {t('cancel')}
          </button>
          <button type="submit" className="btn btn-primary">
            {t('save')}
          </button>
        </div>
      </form>
    </>
  );
}
