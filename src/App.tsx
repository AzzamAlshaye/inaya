import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { HashRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { App as CapApp } from '@capacitor/app';
import { Device } from '@capacitor/device';
import { LocalNotifications } from '@capacitor/local-notifications';
import { I18nProvider, resolveLang, useI18n, type Lang } from './i18n';
import { StoreProvider, useStore } from './state/store';
import { ToastProvider } from './components/Toast';
import { ConfirmProvider } from './components/Dialog';
import { AppShell } from './components/Layout';
import { HomePage } from './pages/Home';
import { AddItemPage, EditItemPage } from './pages/ItemForm';
import { ItemPage } from './pages/ItemPage';
import { TaskPage } from './pages/TaskPage';
import { PresetEditPage, PresetsPage } from './pages/PresetsPage';
import { SettingsPage } from './pages/SettingsPage';
// QR libraries are only needed on this screen, so load it on demand.
const TransferPage = lazy(() => import('./pages/TransferPage').then((m) => ({ default: m.TransferPage })));
import { isNative, syncNotifications } from './lib/notifications';

function useDeviceLang(): Lang | null {
  const [lang, setLang] = useState<Lang | null>(null);
  useEffect(() => {
    let cancelled = false;
    const fallback = () => resolveLang(navigator.languages?.[0] ?? navigator.language);
    (isNative() ? Device.getLanguageCode().then((r) => resolveLang(r.value)) : Promise.resolve(fallback()))
      .catch(fallback)
      .then((l) => !cancelled && setLang(l));
    return () => {
      cancelled = true;
    };
  }, []);
  return lang;
}

/** Applies language, direction, theme and accessibility preferences to <html>. */
function Preferences({ deviceLang, children }: { deviceLang: Lang; children: ReactNode }) {
  const { settings } = useStore().data;
  const lang: Lang = settings.language === 'auto' ? deviceLang : settings.language;

  useEffect(() => {
    const root = document.documentElement;
    root.lang = lang;
    root.dir = lang === 'ar' ? 'rtl' : 'ltr';
    root.dataset.theme = settings.theme;
    root.dataset.contrast = settings.highContrast ? 'high' : 'normal';
    root.dataset.motion = settings.reduceMotion ? 'reduce' : 'auto';
    root.style.setProperty('--text-scale', String(settings.textScale));
  }, [lang, settings.theme, settings.highContrast, settings.reduceMotion, settings.textScale]);

  return <I18nProvider lang={lang}>{children}</I18nProvider>;
}

/** Native-only behaviour: Android back button, reminders, notification taps. */
function NativeBridge() {
  const navigate = useNavigate();
  const { data } = useStore();
  const i18n = useI18n();

  useEffect(() => {
    if (!isNative()) return;
    const back = CapApp.addListener('backButton', ({ canGoBack }) => {
      const openDialog = document.querySelector<HTMLDialogElement>('dialog[open]');
      if (openDialog) {
        openDialog.dispatchEvent(new Event('cancel', { cancelable: true }));
        return;
      }
      if (canGoBack && window.location.hash !== '#/' && window.location.hash !== '') window.history.back();
      else CapApp.exitApp();
    });
    const tap = LocalNotifications.addListener('localNotificationActionPerformed', ({ notification }) => {
      const { itemId, taskId } = (notification.extra ?? {}) as { itemId?: string; taskId?: string };
      navigate(itemId && taskId ? `/item/${itemId}/task/${taskId}` : '/');
    });
    return () => {
      back.then((h) => h.remove());
      tap.then((h) => h.remove());
    };
  }, [navigate]);

  // Debounced re-scheduling whenever data or language changes.
  useEffect(() => {
    if (!isNative()) return;
    const timer = window.setTimeout(() => {
      syncNotifications(data, i18n).catch((e) => console.error('Notification sync failed', e));
    }, 800);
    return () => window.clearTimeout(timer);
  }, [data, i18n]);

  return null;
}

function Loading() {
  return (
    <div className="loading" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
    </div>
  );
}

export default function App() {
  const deviceLang = useDeviceLang();
  if (!deviceLang) return <Loading />;
  return (
    <StoreProvider fallback={<Loading />}>
      <Preferences deviceLang={deviceLang}>
        <ToastProvider>
          <ConfirmProvider>
            <HashRouter>
              <NativeBridge />
              <AppShell>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/add" element={<AddItemPage />} />
                  <Route path="/item/:itemId" element={<ItemPage />} />
                  <Route path="/item/:itemId/edit" element={<EditItemPage />} />
                  <Route path="/item/:itemId/task/:taskId" element={<TaskPage />} />
                  <Route path="/presets" element={<PresetsPage />} />
                  <Route path="/presets/:presetId" element={<PresetEditPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route
                    path="/transfer"
                    element={
                      <Suspense fallback={<Loading />}>
                        <TransferPage />
                      </Suspense>
                    }
                  />
                  <Route path="*" element={<HomePage />} />
                </Routes>
              </AppShell>
            </HashRouter>
          </ConfirmProvider>
        </ToastProvider>
      </Preferences>
    </StoreProvider>
  );
}
