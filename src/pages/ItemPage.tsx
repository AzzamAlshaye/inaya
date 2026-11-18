import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useStore } from '../state/store';
import { compareTasks, firstDue, todayISO } from '../lib/dates';
import { PageHeader } from '../components/Layout';
import { TaskCard } from '../components/TaskCard';
import { Icon } from '../components/Icon';
import { useConfirm } from '../components/Dialog';
import { useToast } from '../components/Toast';

/** How many suggestions to show before "Show all". */
const SUGGEST_PREVIEW = 4;

export function ItemPage() {
  const { t, formatDate, taskTitle, formatInterval, formatNumber } = useI18n();
  const { itemId } = useParams();
  const store = useStore();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();
  const item = store.data.items.find((i) => i.id === itemId);
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);

  if (!item) {
    return (
      <>
        <PageHeader title={t('appName')} back="/" />
        <p className="section">{t('item.notFound')}</p>
      </>
    );
  }

  const tasks = store.data.tasks
    .filter((task) => task.itemId === item.id)
    .sort((a, b) => compareTasks(a, b, store.data.settings.dueSoonDays));

  // Preset tasks not added yet, offered as one-tap suggestions.
  const preset = store.data.presets.find((p) => p.id === item.presetId);
  const suggestions = (preset?.tasks ?? []).filter(
    (pt) => !tasks.some((task) => (pt.titleKey && task.titleKey === pt.titleKey) || taskTitle(task) === taskTitle(pt)),
  );
  const addSuggestion = (pt: (typeof suggestions)[number]) => {
    const today = todayISO();
    // Counted from today, or from the start date if tracking hasn't started yet.
    const start = item.startDate && item.startDate > today ? item.startDate : today;
    const task = store.saveTask({
      itemId: item.id,
      titleKey: pt.title ? undefined : pt.titleKey,
      title: pt.title,
      every: pt.every,
      unit: pt.unit,
      nextDue: firstDue(pt.every, pt.unit, start),
      remind: true,
    });
    toast(t('item.suggestionAdded', { name: taskTitle(task) }));
  };

  const remove = async () => {
    if (!(await confirm(t('item.deleteConfirm', { name: item.name }), { danger: true }))) return;
    const previous = store.deleteItem(item.id);
    navigate('/', { replace: true });
    toast(t('item.deleted', { name: item.name }), {
      action: { label: t('undo'), onClick: () => store.restore(previous) },
    });
  };

  return (
    <>
      <PageHeader
        title={item.name}
        icon={item.icon}
        color={item.color}
        back="/"
        actions={
          <>
            <Link to={`/item/${item.id}/edit`} className="icon-btn" aria-label={t('edit')} title={t('edit')}>
              <Icon name="edit" />
            </Link>
            <button type="button" className="icon-btn danger" onClick={remove} aria-label={t('delete')} title={t('delete')}>
              <Icon name="trash" />
            </button>
          </>
        }
      />
      {item.startDate && (
        <p className="item-since">
          {t(item.startDate > todayISO() ? 'item.startsOn' : 'item.since', { date: formatDate(item.startDate, 'long') })}
        </p>
      )}
      {item.notes && <p className="item-notes">{item.notes}</p>}

      <section className="section" aria-labelledby="tasks-heading">
        <div className="section-head">
          <h2 id="tasks-heading">{t('item.tasks')}</h2>
          <Link to={`/item/${item.id}/task/new`} className="btn btn-secondary">
            <Icon name="plus" />
            {t('item.addTask')}
          </Link>
        </div>
        {tasks.length === 0 ? (
          <p className="muted">{t('item.noTasks')}</p>
        ) : (
          <ul className="task-list" role="list">
            {tasks.map((task) => (
              <li key={task.id}>
                <TaskCard task={task} item={item} />
              </li>
            ))}
          </ul>
        )}
      </section>
      {suggestions.length > 0 && (
        <section className="section suggestions" aria-labelledby="suggest-heading">
          <h2 id="suggest-heading">{t('item.suggestions')}</h2>
          <p className="hint">{t('item.suggestionsHint')}</p>
          <ul className="suggest-list" role="list">
            {(showAllSuggestions ? suggestions : suggestions.slice(0, SUGGEST_PREVIEW)).map((pt) => (
              <li key={pt.id} className="suggest-row compact">
                <span className="check-label">
                  <span className="suggest-title">{taskTitle(pt)}</span>
                  <span className="muted">{formatInterval(pt.every, pt.unit)}</span>
                </span>
                <button type="button" className="btn btn-secondary btn-small" onClick={() => addSuggestion(pt)}>
                  <Icon name="plus" size={20} />
                  {t('item.addSuggestion')}
                  <span className="visually-hidden">: {taskTitle(pt)}</span>
                </button>
              </li>
            ))}
          </ul>
          {!showAllSuggestions && suggestions.length > SUGGEST_PREVIEW && (
            <button type="button" className="btn btn-text show-more" onClick={() => setShowAllSuggestions(true)}>
              {t('item.showAllSuggestions', { n: formatNumber(suggestions.length) })}
            </button>
          )}
        </section>
      )}
    </>
  );
}
