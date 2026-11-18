import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useStore } from '../state/store';
import { compareTasks, taskStatus } from '../lib/dates';
import { PageHeader } from '../components/Layout';
import { TaskCard } from '../components/TaskCard';
import { Icon } from '../components/Icon';
import { ThemeToggle } from '../components/ThemeToggle';
import { todayISO } from '../lib/dates';

function greetingKey() {
  const h = new Date().getHours();
  return h < 12 ? 'home.greetMorning' : h < 17 ? 'home.greetAfternoon' : 'home.greetEvening';
}

export function HomePage() {
  const { t, formatNumber, formatDate } = useI18n();
  const { data } = useStore();
  const { dueSoonDays } = data.settings;
  const itemsById = new Map(data.items.map((i) => [i.id, i]));
  const tasks = data.tasks.filter((task) => itemsById.has(task.itemId));

  const attention = tasks
    .filter((task) => ['overdue', 'today', 'soon'].includes(taskStatus(task, dueSoonDays)))
    .sort((a, b) => compareTasks(a, b, dueSoonDays));

  const counts = { overdue: 0, soon: 0, ok: 0 };
  for (const task of tasks) {
    const st = taskStatus(task, dueSoonDays);
    if (st === 'overdue') counts.overdue++;
    else if (st === 'today' || st === 'soon') counts.soon++;
    else if (st === 'ok') counts.ok++;
  }

  if (data.items.length === 0) {
    return (
      <>
        <PageHeader title={t('home.title')} themeToggle />
        <section className="empty-state">
          <div className="empty-icons" aria-hidden="true">🚗 🌱 🏠</div>
          <h2>{t('home.emptyTitle')}</h2>
          <p>{t('home.emptyBody')}</p>
          <Link to="/add" className="btn btn-primary btn-large">
            <Icon name="plus" />
            {t('home.addThing')}
          </Link>
        </section>
      </>
    );
  }

  return (
    <>
      <header className="hero">
        <div className="hero-top">
          <div className="hero-text">
            <p className="hero-greeting">
              {t(greetingKey())} · {formatDate(todayISO(), 'long')}
            </p>
            <h1>{t('home.title')}</h1>
          </div>
          <div className="header-actions">
            <Link to="/add" className="btn btn-on-hero">
              <Icon name="plus" />
              <span>{t('add')}</span>
            </Link>
            <ThemeToggle />
          </div>
        </div>
        <ul className="stat-tiles" role="list" aria-label={t('home.summary')}>
          <li className={`stat-tile tile-overdue${counts.overdue ? ' active' : ''}`}>
            <span className="stat-num">{formatNumber(counts.overdue)}</span>
            <span className="stat-label">{t('home.overdueCount')}</span>
          </li>
          <li className={`stat-tile tile-soon${counts.soon ? ' active' : ''}`}>
            <span className="stat-num">{formatNumber(counts.soon)}</span>
            <span className="stat-label">{t('home.soonCount')}</span>
          </li>
          <li className="stat-tile tile-ok active">
            <span className="stat-num">{formatNumber(counts.ok)}</span>
            <span className="stat-label">{t('home.okCount')}</span>
          </li>
        </ul>
      </header>

      <section aria-labelledby="attention-heading" className="section">
        <h2 id="attention-heading">
          {t('home.needsAttention')}
          {attention.length > 0 && <span className="count-pill">{formatNumber(attention.length)}</span>}
        </h2>
        {attention.length === 0 ? (
          <p className="all-good">
            <Icon name="check" />
            {t('home.allGood', { n: dueSoonDays })}
          </p>
        ) : (
          <ul className="task-list" role="list">
            {attention.map((task) => (
              <li key={task.id}>
                <TaskCard task={task} item={itemsById.get(task.itemId)} showItem />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="things-heading" className="section">
        <h2 id="things-heading">{t('home.myThings')}</h2>
        <ul className="item-grid" role="list">
          {data.items.map((item) => {
            const itemTasks = tasks.filter((task) => task.itemId === item.id);
            const overdue = itemTasks.filter((task) => taskStatus(task, dueSoonDays) === 'overdue').length;
            const soon = itemTasks.filter((task) => ['today', 'soon'].includes(taskStatus(task, dueSoonDays))).length;
            const okShare = itemTasks.length ? Math.round(((itemTasks.length - overdue) / itemTasks.length) * 100) : 100;
            return (
              <li key={item.id}>
                <Link
                  to={`/item/${item.id}`}
                  className="item-card"
                  style={{ '--accent': item.color } as React.CSSProperties}
                >
                  <span className="item-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span className="item-name">{item.name}</span>
                  <span className="item-stats">
                    <span>
                      {t('home.taskCount')}: {formatNumber(itemTasks.length)}
                    </span>
                    {overdue > 0 && (
                      <span className="stat-overdue">
                        {t('home.overdueCount')}: {formatNumber(overdue)}
                      </span>
                    )}
                    {soon > 0 && (
                      <span className="stat-soon">
                        {t('home.soonCount')}: {formatNumber(soon)}
                      </span>
                    )}
                  </span>
                  <span className="item-meter" aria-hidden="true">
                    <span style={{ inlineSize: `${okShare}%` }} />
                  </span>
                </Link>
              </li>
            );
          })}
          <li>
            <Link to="/add" className="item-card item-card-add">
              <span className="item-icon" aria-hidden="true">
                <Icon name="plus" size={32} />
              </span>
              <span className="item-name">{t('home.addThing')}</span>
            </Link>
          </li>
        </ul>
      </section>
    </>
  );
}
