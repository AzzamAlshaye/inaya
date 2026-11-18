import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import { useStore } from '../state/store';
import { Icon } from './Icon';

function useSystemDark(): boolean {
  const query = '(prefers-color-scheme: dark)';
  const [dark, setDark] = useState(() => window.matchMedia?.(query).matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const onChange = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return dark;
}

/** One-tap light/dark switch. "Device default" stays available in Settings. */
export function ThemeToggle() {
  const { t } = useI18n();
  const store = useStore();
  const systemDark = useSystemDark();
  const { theme } = store.data.settings;
  const isDark = theme === 'dark' || (theme === 'auto' && systemDark);
  const label = isDark ? t('theme.toLight') : t('theme.toDark');
  return (
    <button
      type="button"
      className="icon-btn theme-toggle"
      aria-label={label}
      title={label}
      onClick={() => store.updateSettings({ theme: isDark ? 'light' : 'dark' })}
    >
      <Icon name={isDark ? 'sun' : 'moon'} />
    </button>
  );
}
