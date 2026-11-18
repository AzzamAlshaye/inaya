import { useId, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { PresetTask } from '../types';
import { useI18n } from '../i18n';
import { useStore } from '../state/store';
import { uid } from '../lib/id';
import { PageHeader } from '../components/Layout';
import { ColorPicker, IconPicker, IntervalInput } from '../components/Pickers';
import { Icon } from '../components/Icon';
import { useConfirm } from '../components/Dialog';
import { useToast } from '../components/Toast';

export function PresetsPage() {
  const { t, presetName, formatNumber } = useI18n();
  const store = useStore();
  const confirm = useConfirm();
  const toast = useToast();

  return (
    <>
      <PageHeader
        title={t('presets.title')}
        actions={
          <Link to="/presets/new" className="btn btn-primary">
            <Icon name="plus" />
            <span>{t('presets.new')}</span>
          </Link>
        }
      />
      <p className="intro">{t('presets.intro')}</p>
      <ul className="preset-list section" role="list">
        {store.data.presets.map((p) => (
          <li key={p.id}>
            <Link to={`/presets/${p.id}`} className="list-row" style={{ '--accent': p.color } as React.CSSProperties}>
              <span className="row-icon" aria-hidden="true">
                {p.icon}
              </span>
              <span className="row-text">
                <span className="row-title">{presetName(p)}</span>
                <span className="muted">{t('presets.taskCount', { n: formatNumber(p.tasks.length) })}</span>
              </span>
              <Icon name="chevron" className="flip-rtl" />
            </Link>
          </li>
        ))}
      </ul>
      <div className="section">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={async () => {
            if (await confirm(t('presets.resetConfirm'), { confirmLabel: t('presets.reset') })) {
              store.resetBuiltInPresets();
              toast(t('presets.restored'));
            }
          }}
        >
          {t('presets.reset')}
        </button>
      </div>
    </>
  );
}

export function PresetEditPage() {
  const i18n = useI18n();
  const { t, presetName, taskTitle } = i18n;
  const { presetId } = useParams();
  const store = useStore();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();
  const formId = useId();
  const isNew = presetId === 'new';
  const existing = store.data.presets.find((p) => p.id === presetId);

  const [name, setName] = useState(existing ? presetName(existing) : '');
  const [icon, setIcon] = useState(existing?.icon ?? '⭐');
  const [color, setColor] = useState(existing?.color ?? '#2563eb');
  // Resolve translated titles into editable text, remembering the original key.
  const [tasks, setTasks] = useState<(PresetTask & { text: string })[]>(
    () => existing?.tasks.map((pt) => ({ ...pt, text: taskTitle(pt) })) ?? [],
  );
  const [error, setError] = useState(false);

  if (!isNew && !existing) {
    return (
      <>
        <PageHeader title={t('presets.edit')} back="/presets" />
        <p className="section">{t('item.notFound')}</p>
      </>
    );
  }

  const updateTask = (id: string, patch: Partial<PresetTask & { text: string }>) =>
    setTasks((list) => list.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || tasks.some((x) => !x.text.trim() || x.every < 1)) {
      setError(true);
      return;
    }
    const keepName = existing?.nameKey && name.trim() === presetName({ nameKey: existing.nameKey });
    store.savePreset({
      id: existing?.id,
      builtIn: existing?.builtIn,
      nameKey: keepName ? existing!.nameKey : undefined,
      name: keepName ? undefined : name.trim(),
      icon,
      color,
      tasks: tasks.map(({ text, ...pt }) => {
        const keepKey = pt.titleKey && text.trim() === taskTitle({ titleKey: pt.titleKey });
        return { ...pt, titleKey: keepKey ? pt.titleKey : undefined, title: keepKey ? undefined : text.trim() };
      }),
    });
    toast(t('task.saved'));
    navigate('/presets');
  };

  const remove = async () => {
    if (!existing) return;
    if (!(await confirm(t('presets.deleteConfirm', { name: presetName(existing) }), { danger: true }))) return;
    const previous = store.deletePreset(existing.id);
    navigate('/presets', { replace: true });
    toast(t('task.deleted'), { action: { label: t('undo'), onClick: () => store.restore(previous) } });
  };

  return (
    <>
      <PageHeader
        title={isNew ? t('presets.new') : t('presets.edit')}
        back="/presets"
        actions={
          existing && (
            <button type="button" className="icon-btn danger" onClick={remove} aria-label={t('delete')} title={t('delete')}>
              <Icon name="trash" />
            </button>
          )
        }
      />
      <form className="form page-form" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor={`${formId}-name`}>{t('name')}</label>
          <input
            id={`${formId}-name`}
            type="text"
            value={name}
            required
            aria-invalid={(error && !name.trim()) || undefined}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <IconPicker value={icon} onChange={setIcon} />
        <ColorPicker value={color} onChange={setColor} />

        <fieldset className="field">
          <legend>{t('presets.tasks')}</legend>
          <ol className="preset-task-list">
            {tasks.map((pt, idx) => (
              <li key={pt.id} className="preset-task">
                <div className="field">
                  <label htmlFor={`${formId}-t-${pt.id}`}>
                    {t('task.title')} {i18n.formatNumber(idx + 1)}
                  </label>
                  <input
                    id={`${formId}-t-${pt.id}`}
                    type="text"
                    value={pt.text}
                    required
                    aria-invalid={(error && !pt.text.trim()) || undefined}
                    onChange={(e) => updateTask(pt.id, { text: e.target.value })}
                  />
                </div>
                <IntervalInput every={pt.every} unit={pt.unit} onChange={(every, unit) => updateTask(pt.id, { every, unit })} />
                <button
                  type="button"
                  className="btn btn-text danger"
                  onClick={() => setTasks((list) => list.filter((x) => x.id !== pt.id))}
                  aria-label={t('presets.removeTask', { name: pt.text || String(idx + 1) })}
                >
                  <Icon name="trash" />
                  {t('delete')}
                </button>
              </li>
            ))}
          </ol>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              const id = uid();
              setTasks((list) => [...list, { id, text: '', every: 1, unit: 'month' }]);
              setTimeout(() => document.getElementById(`${formId}-t-${id}`)?.focus(), 0);
            }}
          >
            <Icon name="plus" />
            {t('presets.addTask')}
          </button>
        </fieldset>

        {error && (
          <p className="error" role="alert">
            {t('required')}
          </p>
        )}
        <div className="form-actions sticky-actions">
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/presets')}>
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
