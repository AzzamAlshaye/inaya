import { useEffect, useRef, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import { Icon } from './Icon';
import { ThemeToggle } from './ThemeToggle';

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const firstRender = useRef(true);

  // Move focus to the new page's heading on navigation so screen readers announce it.
  // Skipped on first load so keyboard users start at the skip link.
  useEffect(() => {
    window.scrollTo(0, 0);
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const h1 = mainRef.current?.querySelector('h1');
    if (h1) {
      h1.setAttribute('tabindex', '-1');
      h1.focus({ preventScroll: true });
    }
  }, [location.pathname]);

  return (
    <>
      <a className="skip-link" href="#main" onClick={(e) => {
        e.preventDefault();
        mainRef.current?.focus();
      }}>
        {t('skipToContent')}
      </a>
      <main id="main" ref={mainRef} tabIndex={-1} className="main">
        {children}
      </main>
      <nav className="bottom-nav" aria-label={t('nav.main')}>
        <NavLink to="/" end className="nav-link">
          <Icon name="home" />
          <span>{t('nav.home')}</span>
        </NavLink>
        <NavLink to="/presets" className="nav-link">
          <Icon name="presets" />
          <span>{t('nav.presets')}</span>
        </NavLink>
        <NavLink to="/settings" className="nav-link">
          <Icon name="settings" />
          <span>{t('nav.settings')}</span>
        </NavLink>
      </nav>
    </>
  );
}

export function PageHeader({
  title,
  back,
  actions,
  icon,
  color,
}: {
  title: string;
  back?: string | boolean;
  actions?: ReactNode;
  icon?: string;
  color?: string;
}) {
  const { t } = useI18n();
  const navigate = useNavigate();
  return (
    <header className="page-header" style={color ? ({ '--accent': color } as React.CSSProperties) : undefined}>
      {back && (
        <button
          type="button"
          className="icon-btn back-btn"
          aria-label={t('back')}
          onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}
        >
          <Icon name="back" className="flip-rtl" />
        </button>
      )}
      {icon && (
        <span className="header-icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <h1>{title}</h1>
      <div className="header-actions">
        {actions}
        <ThemeToggle />
      </div>
    </header>
  );
}
