import { useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { LanguageSetting, ThemeSetting } from '../types';
import { useI18n } from '../i18n';
import { useStore } from '../state/store';
import { PageHeader } from '../components/Layout';
import { Icon } from '../components/Icon';
import { useConfirm } from '../components/Dialog';
import { useToast } from '../components/Toast';
import { exportBackup, readBackup } from '../lib/backup';
import { ensurePermission, isNative } from '../lib/notifications';

function RadioGroup<T extends string | number>({
  legend,
  value,
  options,
  onChange,
}: {
  legend: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const name = useId();
  return (
    <fieldset className="field">
      <legend>{legend}</legend>
      <div className="segmented">
        {options.map((o) => (
          <label key={String(o.value)} className={`segment${o.value === value ? ' selected' : ''}`}>
            <input
              type="radio"
              name={name}
              checked={o.value === value}
              onChange={() => onChange(o.value)}
              className="visually-hidden"
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function SettingsPage() {
  const { t, formatNumber } = useI18n();
  const store = useStore();
  const { settings } = store.data;
  const confirm = useConfirm();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const [permissionDenied, setPermissionDenied] = useState(false);
  const native = isNative();

  const hourLabel = (h: number) =>
    new Intl.DateTimeFormat(document.documentElement.lang === 'ar' ? 'ar' : 'en', { hour: 'numeric' }).format(
      new Date(2000, 0, 1, h),
    );

  return (
    <>
      <PageHeader title={t('settings.title')} />
      <div className="form page-form">
        <RadioGroup<LanguageSetting>
          legend={t('settings.language')}
          value={settings.language}
          onChange={(language) => store.updateSettings({ language })}
          options={(['auto', 'ar', 'en'] as const).map((v) => ({ value: v, label: t(`settings.lang.${v}`) }))}
        />
        <RadioGroup<ThemeSetting>
          legend={t('settings.theme')}
          value={settings.theme}
          onChange={(theme) => store.updateSettings({ theme })}
          options={(['auto', 'light', 'dark'] as const).map((v) => ({ value: v, label: t(`settings.theme.${v}`) }))}
        />

        <h2>{t('settings.accessibility')}</h2>
        <RadioGroup<number>
          legend={t('settings.textSize')}
          value={settings.textScale}
          onChange={(textScale) => store.updateSettings({ textScale })}
          options={[
            { value: 1, label: t('settings.text.normal') },
            { value: 1.15, label: t('settings.text.large') },
            { value: 1.3, label: t('settings.text.xlarge') },
          ]}
        />
        <label className="check-row">
          <input
            type="checkbox"
            checked={settings.highContrast}
            onChange={(e) => store.updateSettings({ highContrast: e.target.checked })}
          />
          <span className="check-label">{t('settings.highContrast')}</span>
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={settings.reduceMotion}
            onChange={(e) => store.updateSettings({ reduceMotion: e.target.checked })}
          />
          <span className="check-label">{t('settings.reduceMotion')}</span>
        </label>

        <h2>{t('settings.tracking')}</h2>
        <div className="field">
          <label htmlFor={`${id}-soon`}>{t('settings.dueSoonDays')}</label>
          <select
            id={`${id}-soon`}
            value={settings.dueSoonDays}
            onChange={(e) => store.updateSettings({ dueSoonDays: Number(e.target.value) })}
          >
            {[1, 3, 7, 14, 30].map((n) => (
              <option key={n} value={n}>
                {formatNumber(n)}
              </option>
            ))}
          </select>
        </div>

        <h2>{t('settings.notifications')}</h2>
        {!native && <p className="hint">{t('settings.notificationsWebOnly')}</p>}
        <label className="check-row">
          <input
            type="checkbox"
            checked={native && settings.notifications}
            disabled={!native}
            onChange={async (e) => {
              const on = e.target.checked;
              if (on) {
                const ok = await ensurePermission();
                setPermissionDenied(!ok);
                if (!ok) return;
              }
              store.updateSettings({ notifications: on });
            }}
          />
          <span className="check-label">{t('settings.notificationsEnable')}</span>
        </label>
        {permissionDenied && (
          <p className="error" role="alert">
            {t('settings.notificationsDenied')}
          </p>
        )}
        <div className="field">
          <label htmlFor={`${id}-hour`}>{t('settings.notificationsHour')}</label>
          <select
            id={`${id}-hour`}
            value={settings.reminderHour}
            disabled={!native || !settings.notifications}
            onChange={(e) => store.updateSettings({ reminderHour: Number(e.target.value) })}
          >
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {hourLabel(h)}
              </option>
            ))}
          </select>
        </div>

        <h2>{t('settings.data')}</h2>
        <div className="button-stack">
          <Link to="/transfer" className="btn btn-primary">
            <Icon name="qr" />
            {t('settings.transfer')}
          </Link>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={async () => {
              try {
                await exportBackup(store.data);
                toast(t('settings.exported'));
              } catch (err) {
                console.error(err);
              }
            }}
          >
            <Icon name="download" />
            {t('settings.export')}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => fileRef.current?.click()}>
            <Icon name="upload" />
            {t('settings.import')}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="visually-hidden"
            tabIndex={-1}
            aria-hidden="true"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              try {
                const data = await readBackup(file);
                if (await confirm(t('settings.importConfirm'), { confirmLabel: t('settings.import') })) {
                  store.replaceAll(data);
                  toast(t('settings.importDone'));
                }
              } catch {
                toast(t('settings.importError'));
              }
            }}
          />
          <button
            type="button"
            className="btn btn-danger-outline"
            onClick={async () => {
              if (await confirm(t('settings.resetConfirm'), { danger: true, confirmLabel: t('settings.reset') })) {
                const previous = store.data;
                store.eraseAll();
                toast(t('settings.resetDone'), { action: { label: t('undo'), onClick: () => store.restore(previous) } });
              }
            }}
          >
            <Icon name="trash" />
            {t('settings.reset')}
          </button>
        </div>

        <h2>{t('settings.about')}</h2>
        <p>{t('settings.aboutText')}</p>
        <p className="muted">{t('settings.version', { v: __APP_VERSION__ })}</p>
      </div>
    </>
  );
}
