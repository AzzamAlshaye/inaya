import { Keyboard } from '@capacitor/keyboard';
import { isNative } from './notifications';

const FIELD = 'input:not([type=checkbox]):not([type=radio]):not([type=file]), textarea, select';

function reduceMotion(): boolean {
  return (
    document.documentElement.dataset.motion === 'reduce' ||
    (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
  );
}

/** Scroll the focused field to the middle of the visible area (above the keyboard). */
function revealFocused() {
  const el = document.activeElement as HTMLElement | null;
  if (!el || !el.matches?.(FIELD)) return;
  el.scrollIntoView({ block: 'center', behavior: reduceMotion() ? 'auto' : 'smooth' });
}

function setOpen(open: boolean) {
  document.documentElement.classList.toggle('keyboard-open', open);
  if (open) {
    // Wait for the layout to settle after the keyboard animation.
    window.setTimeout(revealFocused, 50);
    window.setTimeout(revealFocused, 350);
  }
}

/**
 * Keeps the field being typed in visible when the on-screen keyboard opens,
 * and hides the bottom navigation while typing so it doesn't cover fields.
 */
export function setupKeyboard() {
  if (isNative()) {
    void Keyboard.addListener('keyboardDidShow', () => setOpen(true));
    void Keyboard.addListener('keyboardWillHide', () => setOpen(false));
  } else if (window.visualViewport) {
    // Mobile browsers: the visual viewport shrinks when the keyboard opens.
    const vv = window.visualViewport;
    const check = () => setOpen(window.innerHeight - vv.height > 150);
    vv.addEventListener('resize', check);
  }
  // Also reveal on focus (e.g. moving between fields while the keyboard stays open).
  document.addEventListener('focusin', (e) => {
    if ((e.target as HTMLElement).matches?.(FIELD)) window.setTimeout(revealFocused, 300);
  });
}
