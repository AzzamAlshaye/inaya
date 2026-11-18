import { Link, useNavigate, useParams } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useStore } from '../state/store';
import { compareTasks, todayISO } from '../lib/dates';
import { PageHeader } from '../components/Layout';
import { TaskCard } from '../components/TaskCard';
import { Icon } from '../components/Icon';
import { useConfirm } from '../components/Dialog';
import { useToast } from '../components/Toast';

export function ItemPage() {
  const { t, formatDate } = useI18n();
  const { itemId } = useParams();
  const store = useStore();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();
  const item = store.data.items.find((i) => i.id === itemId);

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
    </>
  );
}
