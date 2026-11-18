import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { Share } from '@capacitor/share';
import type { AppData } from '../types';
import { useI18n } from '../i18n';
import { useStore } from '../state/store';
import { PageHeader } from '../components/Layout';
import { Icon } from '../components/Icon';
import { useConfirm } from '../components/Dialog';
import { useToast } from '../components/Toast';
import { decodePayload, decodeText, encodeTransfer, parsePart, TransferCollector } from '../lib/transfer';
import { isNative } from '../lib/notifications';

const CYCLE_MS = 1600;

function prefersReducedMotion(): boolean {
  return (
    document.documentElement.dataset.motion === 'reduce' ||
    (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
  );
}

/** Shows the data as one or more QR codes plus a copyable text code. */
function SendPanel() {
  const { t, formatNumber } = useI18n();
  const { data } = useStore();
  const toast = useToast();
  const [svgs, setSvgs] = useState<string[]>([]);
  const [textCode, setTextCode] = useState('');
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(() => !prefersReducedMotion());
  const codeId = useId();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [parts, [full]] = await Promise.all([encodeTransfer(data), encodeTransfer(data, Infinity)]);
      // Always dark-on-light with a quiet zone, whatever the app theme, so cameras can read it.
      const rendered = await Promise.all(
        parts.map((p) =>
          QRCode.toString(p, { type: 'svg', errorCorrectionLevel: 'M', margin: 4, color: { dark: '#000000', light: '#ffffff' } }),
        ),
      );
      if (cancelled) return;
      setSvgs(rendered);
      setTextCode(full);
      setIndex(0);
    })();
    return () => {
      cancelled = true;
    };
  }, [data]);

  const total = svgs.length;
  useEffect(() => {
    if (!playing || total < 2) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % total), CYCLE_MS);
    return () => window.clearInterval(timer);
  }, [playing, total]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(textCode);
    } catch {
      const el = document.getElementById(codeId) as HTMLTextAreaElement | null;
      el?.select();
      document.execCommand?.('copy');
    }
    toast(t('transfer.copied'));
  };

  const share = async () => {
    try {
      if (isNative()) await Share.share({ text: textCode });
      else await navigator.share({ text: textCode });
    } catch {
      /* user cancelled */
    }
  };
  const canShare = isNative() || typeof navigator.share === 'function';

  if (!total) {
    return (
      <p className="muted" role="status">
        {t('transfer.encoding')}
      </p>
    );
  }

  return (
    <div className="transfer-send">
      <p>{t('transfer.sendHint')}</p>
      {total > 1 && <p className="hint">{t('transfer.multiHint', { total })}</p>}
      <figure className="qr-frame">
        <div
          className="qr-image"
          role="img"
          aria-label={t('transfer.qrAlt', { n: index + 1, total })}
          dangerouslySetInnerHTML={{ __html: svgs[index] }}
        />
        {total > 1 && (
          <figcaption className="qr-caption" aria-live={playing ? 'off' : 'polite'}>
            {t('transfer.partOf', { n: formatNumber(index + 1), total: formatNumber(total) })}
          </figcaption>
        )}
      </figure>
      {total > 1 && (
        <div className="qr-controls">
          <button type="button" className="icon-btn" aria-label={t('transfer.prev')} onClick={() => setIndex((i) => (i - 1 + total) % total)}>
            <Icon name="back" className="flip-rtl" />
          </button>
          <button type="button" className="btn btn-secondary" aria-pressed={!playing} onClick={() => setPlaying((p) => !p)}>
            <Icon name={playing ? 'pause' : 'chevron'} className={playing ? undefined : 'flip-rtl'} />
            {playing ? t('transfer.pause') : t('transfer.play')}
          </button>
          <button type="button" className="icon-btn" aria-label={t('transfer.next')} onClick={() => setIndex((i) => (i + 1) % total)}>
            <Icon name="chevron" className="flip-rtl" />
          </button>
        </div>
      )}

      <h3 className="transfer-sub">{t('transfer.textCode')}</h3>
      <p className="hint">{t('transfer.textCodeHint')}</p>
      <label htmlFor={codeId} className="visually-hidden">
        {t('transfer.pasteLabel')}
      </label>
      <textarea id={codeId} className="code-box" readOnly rows={3} value={textCode} dir="ltr" onFocus={(e) => e.target.select()} />
      <div className="row-actions">
        <button type="button" className="btn btn-secondary" onClick={copy}>
          <Icon name="copy" />
          {t('transfer.copy')}
        </button>
        {canShare && (
          <button type="button" className="btn btn-secondary" onClick={share}>
            <Icon name="share" />
            {t('transfer.share')}
          </button>
        )}
      </div>
    </div>
  );
}

/** Scans QR codes with the camera or accepts a pasted text code. */
function ReceivePanel({ onData }: { onData: (data: AppData) => void }) {
  const { t, formatNumber } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const collectorRef = useRef(new TransferCollector());
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<{ n: number; total: number } | null>(null);
  const [cameraError, setCameraError] = useState(false);
  const [pasted, setPasted] = useState('');
  const [pasteError, setPasteError] = useState(false);
  const pasteId = useId();

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  useEffect(() => stop, [stop]);

  const start = async () => {
    setCameraError(false);
    collectorRef.current = new TransferCollector();
    setProgress(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setScanning(true);
    } catch (err) {
      console.error(err);
      setCameraError(true);
    }
  };

  // Attach the stream and scan frames while the camera is on.
  useEffect(() => {
    if (!scanning) return;
    const video = videoRef.current!;
    video.srcObject = streamRef.current;
    void video.play().catch(() => {});
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    let stopped = false;
    let last = 0;
    let busy = false;

    const tick = (now: number) => {
      if (stopped) return;
      requestAnimationFrame(tick);
      if (busy || now - last < 120 || video.readyState < 2 || !video.videoWidth) return;
      last = now;
      const scale = Math.min(1, 800 / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const found = jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' });
      const part = found && parsePart(found.data);
      if (!part) return;
      const collector = collectorRef.current;
      if (!collector.add(part)) return;
      navigator.vibrate?.(30);
      setProgress({ n: collector.received, total: collector.total });
      if (collector.complete) {
        busy = true;
        stop();
        decodePayload(collector.payload())
          .then(onData)
          .catch(() => setPasteError(true));
      }
    };
    requestAnimationFrame(tick);
    return () => {
      stopped = true;
    };
  }, [scanning, stop, onData]);

  const importText = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      onData(await decodeText(pasted));
      setPasteError(false);
    } catch {
      setPasteError(true);
    }
  };

  return (
    <div className="transfer-receive">
      {!scanning ? (
        <button type="button" className="btn btn-primary btn-large" onClick={start}>
          <Icon name="camera" />
          {t('transfer.scan')}
        </button>
      ) : (
        <>
          <p>{t('transfer.scanning')}</p>
          <div className="scanner">
            <video ref={videoRef} playsInline muted aria-label={t('transfer.cameraLabel')} />
            <span className="scanner-frame" aria-hidden="true" />
          </div>
          <button type="button" className="btn btn-secondary" onClick={stop}>
            <Icon name="close" />
            {t('transfer.stopScan')}
          </button>
        </>
      )}
      <p role="status" aria-live="polite" className="scan-progress">
        {progress && t('transfer.progress', { n: formatNumber(progress.n), total: formatNumber(progress.total) })}
      </p>
      {cameraError && (
        <p className="error" role="alert">
          {t('transfer.cameraError')}
        </p>
      )}

      <form className="form" onSubmit={importText}>
        <h3 className="transfer-sub">{t('transfer.paste')}</h3>
        <div className="field">
          <label htmlFor={pasteId}>{t('transfer.pasteLabel')}</label>
          <textarea
            id={pasteId}
            className="code-box"
            rows={3}
            dir="ltr"
            value={pasted}
            aria-invalid={pasteError || undefined}
            aria-describedby={pasteError ? `${pasteId}-err` : undefined}
            onChange={(e) => {
              setPasted(e.target.value);
              setPasteError(false);
            }}
          />
          {pasteError && (
            <p id={`${pasteId}-err`} className="error" role="alert">
              {t('transfer.invalid')}
            </p>
          )}
        </div>
        <div>
          <button type="submit" className="btn btn-primary" disabled={!pasted.trim()}>
            {t('transfer.import')}
          </button>
        </div>
      </form>
    </div>
  );
}

export function TransferPage() {
  const { t, formatNumber } = useI18n();
  const store = useStore();
  const confirm = useConfirm();
  const toast = useToast();
  const navigate = useNavigate();

  const receive = useCallback(
    async (data: AppData) => {
      const ok = await confirm(
        t('transfer.confirm', { items: formatNumber(data.items.length), tasks: formatNumber(data.tasks.length) }),
        { confirmLabel: t('transfer.import') },
      );
      if (!ok) return;
      // Keep this phone's own display preferences; take everything else.
      const previous = store.replaceAll({ ...data, settings: store.data.settings });
      navigate('/', { replace: true });
      toast(t('transfer.done'), { action: { label: t('undo'), onClick: () => store.restore(previous) } });
    },
    [confirm, formatNumber, navigate, store, t, toast],
  );

  return (
    <>
      <PageHeader title={t('transfer.title')} back="/settings" />
      <p className="intro">{t('transfer.intro')}</p>
      <section className="section transfer-section" aria-labelledby="send-heading">
        <h2 id="send-heading">
          <Icon name="qr" /> {t('transfer.send')}
        </h2>
        <SendPanel />
      </section>
      <section className="section transfer-section" aria-labelledby="receive-heading">
        <h2 id="receive-heading">
          <Icon name="camera" /> {t('transfer.receive')}
        </h2>
        <ReceivePanel onData={receive} />
      </section>
    </>
  );
}
