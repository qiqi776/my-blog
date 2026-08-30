import { useCallback, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export default function NavigationSheet({ open, onClose, title, triggerRef, children }) {
  const titleId = useId();
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const panel = panelRef.current;
    const previousOverflow = document.body.style.overflow;
    const returnFocus = triggerRef?.current ?? document.activeElement;
    document.body.style.overflow = 'hidden';

    const focusable = panel?.querySelectorAll(focusableSelector) ?? [];
    focusable[0]?.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !panel) return;
      const candidates = [...panel.querySelectorAll(focusableSelector)].filter((element) => {
        const style = getComputedStyle(element);
        return style.visibility !== 'hidden' && style.display !== 'none';
      });

      if (!candidates.length) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = candidates[0];
      const last = candidates[candidates.length - 1];
      if (!panel.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      const focusTarget = returnFocus?.isConnected && returnFocus.getClientRects().length
        ? returnFocus
        : document.querySelector('.post-back-link');
      focusTarget?.focus?.({ preventScroll: true });
    };
  }, [onClose, open, triggerRef]);

  const handleBackdropClick = useCallback((event) => {
    if (event.target === event.currentTarget) onClose();
  }, [onClose]);

  if (!open) return null;

  return createPortal(
    <div className="navigation-sheet-backdrop" onMouseDown={handleBackdropClick}>
      <section
        ref={panelRef}
        className="navigation-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header className="navigation-sheet__header">
          <h2 id={titleId} className="navigation-sheet__title">{title}</h2>
          <button type="button" className="navigation-sheet__close" onClick={onClose} aria-label={`关闭${title}`}>
            <X aria-hidden="true" size={20} />
          </button>
        </header>
        <div className="navigation-sheet__body">{children}</div>
      </section>
    </div>,
    document.body,
  );
}
