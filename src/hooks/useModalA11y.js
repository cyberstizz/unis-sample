// =============================================================================
// useModalA11y -- shared accessibility hook for modal-like overlays.
//
// What it does:
//   1. Escape key closes the modal (calls onClose)
//   2. On open: focus moves into the modal (to the first focusable element)
//   3. Tab/Shift+Tab is trapped within the modal (can't escape to underlying page)
//   4. On close: focus returns to the element that was focused before open
//
// Usage:
//   const modalRef = useRef(null);
//   useModalA11y({ active: show, onClose, modalRef });
//   ...
//   <div className="modal" ref={modalRef}>...</div>
//
// Why a hook: both SupportedArtistPicker and VoteHistoryModal need identical
// behavior. Duplicating ~40 lines of effect logic in two places is the kind of
// drift that turns into "one modal traps focus correctly and the other doesn't"
// three months from now. One hook, one source of truth.
// =============================================================================

import { useEffect } from 'react';

// CSS selector for everything that can receive focus.
// Excludes elements with negative tabindex (intentionally non-focusable).
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

const useModalA11y = ({ active, onClose, modalRef }) => {
  useEffect(() => {
    if (!active || !modalRef.current) return;

    // Remember what was focused before the modal opened so we can restore it.
    const previouslyFocused = document.activeElement;

    // Move focus into the modal. Prefer the first focusable element; fall back
    // to the modal container itself (which needs tabIndex={-1} to receive focus).
    const focusables = modalRef.current.querySelectorAll(FOCUSABLE_SELECTOR);
    const firstFocusable = focusables[0];
    if (firstFocusable) {
      firstFocusable.focus();
    } else {
      modalRef.current.focus();
    }

    const handleKeyDown = (e) => {
      // Escape closes the modal
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose?.();
        return;
      }

      // Tab traps focus within the modal
      if (e.key === 'Tab') {
        const list = modalRef.current?.querySelectorAll(FOCUSABLE_SELECTOR);
        if (!list || list.length === 0) {
          e.preventDefault();
          return;
        }
        const first = list[0];
        const last = list[list.length - 1];

        // Shift+Tab on first element → wrap to last
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
        // Tab on last element → wrap to first
        else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Restore focus to wherever it was before the modal opened.
      // Guarded because the element may have been unmounted while the modal was open.
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        try {
          previouslyFocused.focus();
        } catch (_) {
          // Element no longer focusable — silently fail rather than crash.
        }
      }
    };
  }, [active, onClose, modalRef]);
};

export default useModalA11y;