/** Keyboard ownership follows the readable/interactive handoff, not the film timer. */
export function isEditingOrNativeControl(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  if (target.closest('.embarkation-hold')) return false;
  return Boolean(target.closest(
    'input, textarea, select, button, a[href], [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"], [role="slider"], .embarkation-inspector',
  ));
}

export function bindArrivalKeyboard(options: {
  root: HTMLElement;
  ownsInput: () => boolean;
  skipAvailable: () => boolean;
  beginHold: () => void;
  cancelHold: () => void;
}) {
  const down = (event: KeyboardEvent) => {
    if (!options.ownsInput()) return;
    if (event.code === 'Tab') {
      const nodes = [...options.root.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]',
      )].filter(n => !n.closest('[inert]') && n.getClientRects().length && getComputedStyle(n).visibility !== 'hidden');
      const first = nodes[0], last = nodes.at(-1);
      if (first && last && (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    }
    if (event.code !== 'Space' || event.isComposing || event.altKey || event.ctrlKey || event.metaKey ||
        !options.skipAvailable() || isEditingOrNativeControl(event.target)) return;
    event.preventDefault();
    if (!event.repeat) options.beginHold();
  };
  const up = (event: KeyboardEvent) => { if (event.code === 'Space') options.cancelHold(); };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', options.cancelHold);
  return () => {
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
    window.removeEventListener('blur', options.cancelHold);
    options.cancelHold();
  };
}
