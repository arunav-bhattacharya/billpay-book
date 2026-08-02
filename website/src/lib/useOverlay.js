import {useEffect} from 'react';

/**
 * What a full-window layer owes the page while it is up.
 *
 * Escape closes it. The page behind it stops scrolling, so the wheel drives
 * the layer rather than the article underneath. Focus moves into the layer
 * when it opens and back to whatever opened it when it closes, which is the
 * part both of the site's overlays were missing: without it, closing a layer
 * dropped the keyboard back at the top of the document.
 *
 * Pair it with role="dialog" and aria-modal on the layer itself.
 *
 * onClose must be stable, from useCallback or a setState function, or the
 * effect tears down and rebuilds on every render.
 */
export default function useOverlay({open, onClose, focusRef}) {
  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const returnFocusTo = document.activeElement;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    const {overflow} = document.body.style;
    document.body.style.overflow = 'hidden';
    focusRef?.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
      returnFocusTo?.focus?.();
    };
  }, [open, onClose, focusRef]);
}
