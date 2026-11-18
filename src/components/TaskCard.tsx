import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Item, Task, TaskStatus } from '../types';
import { useI18n } from '../i18n';
import { useStore } from '../state/store';
import { lastDone, taskStatus, todayISO } from '../lib/dates';
import { Dialog } from './Dialog';
import { Icon, type IconName } from './Icon';
import { useToast } from './Toast';

const statusIcon: Record<TaskStatus, IconName> = {
  overdue: 'alert',
  today: 'alert',
  soon: 'clock',
  ok: 'check',
  paused: 'pause',
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  const { t } = useI18n();
  return (
    <span className={`badge badge-${status}`}>
      <Icon name={statusIcon[status]} size={16} />
      {t(`status.${status}`)}
    </span>
  );
}

export function TaskCard({ task, item, showItem = false }: { task: Task; item?: Item; showItem?: boolean }) {
  const i18n = useI18n();
  const { t, taskTitle, formatDate, formatRelative, formatInterval } = i18n;
  const { data } = useStore();
  const status = taskStatus(task, data.settings.dueSoonDays);
  const [doneOpen, setDoneOpen] = useState(false);
  const title = taskTitle(task);
  const titleId = useId();
  const last = lastDone(task);

  // e.g. "3 days ago" for overdue tasks, "Due in 2 weeks" otherwise.
  const dueText = status === 'overdue' ? formatRelative(task.nextDue) : t('due.in', { rel: formatRelative(task.nextDue) });

  return (
    <article className={`task-card status-${status}`} aria-labelledby={titleId}>
      <div className="task-main">
        {showItem && item && (
          <p className="task-item-name">
            <span aria-hidden="true">{item.icon} </span>
            {item.name}
          </p>
        )}
        <h3 className="task-title" id={titleId}>
          <Link to={`/item/${task.itemId}/task/${task.id}`} className="stretched-link">
            {title}
          </Link>
        </h3>
        <p className="task-meta">
          <StatusBadge status={status} />
          <span className="task-due">{status !== 'paused' && dueText}</span>
        </p>
        <p className="task-sub">
          {formatInterval(task.every, task.unit)}
          {' · '}
          {t('due.date', { date: formatDate(task.nextDue) })}
          {' · '}
          {last ? t('due.lastDone', { date: formatDate(last) }) : t('due.never')}
        </p>
      </div>
      {!task.paused && (
        <button
          type="button"
          className="btn btn-done"
          onClick={() => setDoneOpen(true)}
        >
          <Icon name="check" />
          <span>
            {t('task.markDone')}
            <span className="visually-hidden">: {title}</span>
          </span>
        </button>
      )}
      {doneOpen && <MarkDoneDialog task={task} onClose={() => setDoneOpen(false)} />}
    </article>
  );
}

export function MarkDoneDialog({ task, onClose }: { task: Task; onClose: () => void }) {
  const { t, taskTitle, formatDate } = useI18n();
  const store = useStore();
  const toast = useToast();
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const [cost, setCost] = useState('');
  const formId = useId();
  const title = taskTitle(task);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const costNum = cost.trim() === '' ? undefined : Number(cost.replace(',', '.'));
    const { previous, task: updated } = store.markDone(task.id, {
      date: date || todayISO(),
      note: note.trim() || undefined,
      cost: costNum !== undefined && Number.isFinite(costNum) ? costNum : undefined,
    });
    onClose();
    toast(t('task.marked', { name: title, date: formatDate(updated.nextDue) }), {
      action: { label: t('undo'), onClick: () => store.restore(previous) },
    });
  };

  return (
    <Dialog
      open
      title={t('task.markDoneFor', { name: title })}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {t('cancel')}
          </button>
          <button type="submit" form={formId} className="btn btn-primary">
            <Icon name="check" />
            {t('save')}
          </button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="form">
        <div className="field">
          <label htmlFor={`${formId}-date`}>{t('task.doneOn')}</label>
          <input
            id={`${formId}-date`}
            type="date"
            value={date}
            max={todayISO()}
            required
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor={`${formId}-note`}>
            {t('task.doneNote')} <span className="muted">{t('optional')}</span>
          </label>
          <input
            id={`${formId}-note`}
            type="text"
            value={note}
            placeholder={t('task.doneNotePlaceholder')}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor={`${formId}-cost`}>
            {t('task.cost')} <span className="muted">{t('optional')}</span>
          </label>
          <input
            id={`${formId}-cost`}
            type="text"
            inputMode="decimal"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
          />
        </div>
      </form>
    </Dialog>
  );
}
