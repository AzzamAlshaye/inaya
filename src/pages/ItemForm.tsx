import { useId, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useStore } from '../state/store';
import { addInterval, todayISO } from '../lib/dates';
import { PageHeader } from '../components/Layout';
import { ColorPicker, IconPicker } from '../components/Pickers';
import { useToast } from '../components/Toast';
import { Icon } from '../components/Icon';

/** Create a new item from a preset. */
export function AddItemPage() {
  const i18n = useI18n();
  const { t, presetName, taskTitle, formatInterval } = i18n;
  const store = useStore();
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const formId = useId();
  const { presets } = store.data;

  const [presetId, setPresetId] = useState(params.get('preset') ?? presets[0]?.id ?? '');
  const preset = presets.find((p) => p.id === presetId);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(() => new Set(preset?.tasks.map((x) => x.id)));
  const [error, setError] = useState(false);

  const choosePreset = (id: string) => {
    setPresetId(id);
    const p = presets.find((x) => x.id === id);
    setSelected(new Set(p?.tasks.map((x) => x.id)));
  };

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = name.trim() || (preset ? presetName(preset) : '');
    if (!finalName) {
      setError(true);
      document.getElementById(`${formId}-name`)?.focus();
      return;
    }
    const today = todayISO();
    const item = store.addItem(
      {
        name: finalName,
        presetId: preset?.id,
        icon: preset?.icon ?? '⭐',
        color: preset?.color ?? '#64748b',
      },
      (preset?.tasks ?? [])
        .filter((pt) => selected.has(pt.id))
        .map((pt) => ({
          titleKey: pt.title ? undefined : pt.titleKey,
          title: pt.title,
          every: pt.every,
          unit: pt.unit,
          nextDue: addInterval(today, pt.every, pt.unit),
          remind: true,
        })),
    );
    toast(t('item.created', { name: item.name }));
    navigate(`/item/${item.id}`, { replace: true });
  };

  return (
    <>
      <PageHeader title={t('item.add')} back />
      <form id={formId} className="form page-form" onSubmit={submit} noValidate>
        <fieldset className="field">
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

        <div className="field">
          <label htmlFor={`${formId}-name`} className="step-title">
            {t('item.details')}
          </label>
          <input
            id={`${formId}-name`}
            type="text"
            value={name}
            placeholder={preset ? presetName(preset) : t('item.namePlaceholder')}
            aria-describedby={error ? `${formId}-name-err` : undefined}
            aria-invalid={error || undefined}
            onChange={(e) => {
              setName(e.target.value);
              setError(false);
            }}
          />
          <p className="hint">{t('item.namePlaceholder')}</p>
          {error && (
            <p id={`${formId}-name-err`} className="error" role="alert">
              {t('required')}
            </p>
          )}
        </div>

        {preset && (
          <fieldset className="field">
            <legend className="step-title">{t('item.chooseTasks')}</legend>
            <p className="hint">{t('item.chooseTasksHint')}</p>
            {preset.tasks.length === 0 ? (
              <p className="muted">{t('item.noPresetTasks')}</p>
            ) : (
              <>
                <div className="row-actions">
                  <button type="button" className="btn btn-text" onClick={() => setSelected(new Set(preset.tasks.map((x) => x.id)))}>
                    {t('item.selectAll')}
                  </button>
                  <button type="button" className="btn btn-text" onClick={() => setSelected(new Set())}>
                    {t('item.selectNone')}
                  </button>
                </div>
                <ul className="check-list" role="list">
                  {preset.tasks.map((pt) => (
                    <li key={pt.id}>
                      <label className="check-row">
                        <input type="checkbox" checked={selected.has(pt.id)} onChange={() => toggle(pt.id)} />
                        <span className="check-label">
                          <span>{taskTitle(pt)}</span>
                          <span className="muted">{formatInterval(pt.every, pt.unit)}</span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </fieldset>
        )}

        <div className="form-actions sticky-actions">
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
    store.updateItem(item.id, { name: name.trim(), icon, color, notes: notes.trim() || undefined });
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
