import { useId, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { IntervalUnit } from '../types';
import { useI18n } from '../i18n';
import { useStore } from '../state/store';
import { addInterval, taskStatus, todayISO } from '../lib/dates';
import { PageHeader } from '../components/Layout';
import { IntervalInput } from '../components/Pickers';
import { Icon } from '../components/Icon';
import { MarkDoneDialog, StatusBadge } from '../components/TaskCard';
import { useConfirm } from '../components/Dialog';
import { useToast } from '../components/Toast';

export function TaskPage() {
  const i18n = useI18n();
  const { t, taskTitle, formatDate, formatNumber } = i18n;
  const { itemId, taskId } = useParams();
  const store = useStore();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();
  const formId = useId();

  const isNew = taskId === 'new';
  const item = store.data.items.find((i) => i.id === itemId);
  const task = isNew ? undefined : store.data.tasks.find((x) => x.id === taskId);

  const [title, setTitle] = useState(task ? taskTitle(task) : '');
  const [every, setEvery] = useState(task?.every ?? 1);
  const [unit, setUnit] = useState<IntervalUnit>(task?.unit ?? 'month');
  const [nextDue, setNextDue] = useState(task?.nextDue ?? addInterval(todayISO(), 1, 'month'));
  const [dueTouched, setDueTouched] = useState(!isNew);
  const [notes, setNotes] = useState(task?.notes ?? '');
  const [remind, setRemind] = useState(task?.remind ?? true);
  const [paused, setPaused] = useState(task?.paused ?? false);
  const [error, setError] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);

  // Marking the task done moves its due date; keep the form in sync.
  const [syncedDue, setSyncedDue] = useState(task?.nextDue);
  if (task && task.nextDue !== syncedDue) {
    setSyncedDue(task.nextDue);
    setNextDue(task.nextDue);
  }

  if (!item || (!isNew && !task)) {
    return (
      <>
        <PageHeader title={t('appName')} back="/" />
        <p className="section">{t(item ? 'task.notFound' : 'item.notFound')}</p>
      </>
    );
  }

  const changeInterval = (n: number, u: IntervalUnit) => {
    setEvery(n);
    setUnit(u);
    // For new tasks keep the suggested due date in sync until the user edits it.
    if (!dueTouched && n > 0) setNextDue(addInterval(todayISO(), n, u));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || every < 1 || !nextDue) {
      setError(true);
      return;
    }
    // Keep the translation key if the user did not rename a built-in task,
    // so the name follows the app language.
    const keepKey = task?.titleKey && title.trim() === taskTitle({ titleKey: task.titleKey });
    store.saveTask({
      id: task?.id,
      itemId: item.id,
      titleKey: keepKey ? task!.titleKey : undefined,
      title: keepKey ? undefined : title.trim(),
      every,
      unit,
      nextDue,
      notes: notes.trim() || undefined,
      remind,
      paused,
    });
    toast(t('task.saved'));
    navigate(`/item/${item.id}`, { replace: isNew });
  };

  const remove = async () => {
    if (!task) return;
    if (!(await confirm(t('task.deleteConfirm', { name: taskTitle(task) }), { danger: true }))) return;
    const previous = store.deleteTask(task.id);
    navigate(`/item/${item.id}`, { replace: true });
    toast(t('task.deleted'), { action: { label: t('undo'), onClick: () => store.restore(previous) } });
  };

  const totalCost = task?.history.reduce((sum, h) => sum + (h.cost ?? 0), 0) ?? 0;

  return (
    <>
      <PageHeader
        title={isNew ? t('task.new') : taskTitle(task!)}
        icon={item.icon}
        color={item.color}
        back
        actions={
          task && (
            <button type="button" className="icon-btn danger" onClick={remove} aria-label={t('delete')} title={t('delete')}>
              <Icon name="trash" />
            </button>
          )
        }
      />

      {task && (
        <section className="section task-summary" aria-label={t('task.details')}>
          <p>
            <StatusBadge status={taskStatus(task, store.data.settings.dueSoonDays)} />{' '}
            {t('due.date', { date: formatDate(task.nextDue, 'long') })}
          </p>
          {!task.paused && (
            <button type="button" className="btn btn-done btn-large" onClick={() => setDoneOpen(true)}>
              <Icon name="check" />
              {t('task.markDone')}
            </button>
          )}
          {doneOpen && <MarkDoneDialog task={task} onClose={() => setDoneOpen(false)} />}
        </section>
      )}

      <form id={formId} className="form page-form" onSubmit={submit} noValidate>
        {!isNew && <h2>{t('task.editTitle')}</h2>}
        <div className="field">
          <label htmlFor={`${formId}-title`}>{t('task.title')}</label>
          <input
            id={`${formId}-title`}
            type="text"
            value={title}
            placeholder={t('task.titlePlaceholder')}
            required
            aria-invalid={(error && !title.trim()) || undefined}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <IntervalInput every={every} unit={unit} onChange={changeInterval} />
        <div className="field">
          <label htmlFor={`${formId}-due`}>{t('task.nextDue')}</label>
          <input
            id={`${formId}-due`}
            type="date"
            value={nextDue}
            required
            onChange={(e) => {
              setNextDue(e.target.value);
              setDueTouched(true);
            }}
          />
        </div>
        <div className="field">
          <label htmlFor={`${formId}-notes`}>
            {t('notes')} <span className="muted">{t('optional')}</span>
          </label>
          <textarea id={`${formId}-notes`} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <label className="check-row">
          <input type="checkbox" checked={remind} onChange={(e) => setRemind(e.target.checked)} />
          <span className="check-label">{t('task.remind')}</span>
        </label>
        <label className="check-row">
          <input type="checkbox" checked={paused} onChange={(e) => setPaused(e.target.checked)} />
          <span className="check-label">
            <span>{t('task.pause')}</span>
            <span className="muted">{t('task.pauseHint')}</span>
          </span>
        </label>
        {error && (
          <p className="error" role="alert">
            {t('required')}
          </p>
        )}
        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>
            {t('cancel')}
          </button>
          <button type="submit" className="btn btn-primary">
            {t('save')}
          </button>
        </div>
      </form>

      {task && (
        <section className="section" aria-labelledby="history-heading">
          <h2 id="history-heading">{t('task.history')}</h2>
          {totalCost > 0 && <p>{t('task.totalCost', { cost: formatNumber(totalCost) })}</p>}
          {task.history.length === 0 ? (
            <p className="muted">{t('task.noHistory')}</p>
          ) : (
            <ul className="history-list" role="list">
              {task.history.map((h) => (
                <li key={h.id} className="history-row">
                  <div>
                    <p className="history-date">{formatDate(h.date, 'long')}</p>
                    {h.note && <p>{h.note}</p>}
                    {h.cost !== undefined && (
                      <p className="muted">
                        {t('task.cost')}: {formatNumber(h.cost)}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    className="icon-btn danger"
                    aria-label={t('task.deleteEntry', { date: formatDate(h.date) })}
                    onClick={() => {
                      const previous = store.deleteLogEntry(task.id, h.id);
                      toast(t('task.deleted'), { action: { label: t('undo'), onClick: () => store.restore(previous) } });
                    }}
                  >
                    <Icon name="trash" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}
