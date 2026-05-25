import React, { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

// =============================================================================
// CollapsibleSection
//
// Wraps a profile section with a clickable header that toggles the content
// open/closed. Open state persists in localStorage per section id so the
// user's choice survives reloads.
//
// Props:
//   - id:          string — stable, used as part of the storage key
//   - eyebrow:     ReactNode — small label above the title
//   - title:       ReactNode — the section heading (can include <em>)
//   - defaultOpen: boolean — initial open state (default: true)
//   - children:    ReactNode — the section content
// =============================================================================

const STORAGE_PREFIX = 'unis:profile:section:';

const CollapsibleSection = ({
  id,
  eyebrow,
  title,
  defaultOpen = true,
  children,
}) => {
  const storageKey = `${STORAGE_PREFIX}${id}`;
  const headingId  = `${id}-heading`;
  const panelId    = `${id}-panel`;

  const [open, setOpen] = useState(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored === 'open')   return true;
      if (stored === 'closed') return false;
    } catch (_) { /* localStorage unavailable */ }
    return defaultOpen;
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, open ? 'open' : 'closed');
    } catch (_) { /* ignore */ }
  }, [open, storageKey]);

  return (
    <section
      className={`profile-section profile-section--collapsible ${open ? 'is-open' : 'is-closed'}`}
      aria-labelledby={headingId}
    >
      <button
        type="button"
        className="profile-section__head profile-section__head--toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(o => !o)}
      >
        <div className="profile-section__head-text">
          {eyebrow && <div className="profile-section__eyebrow">{eyebrow}</div>}
          <h2 id={headingId} className="profile-section__title">
            {title}
          </h2>
        </div>
        <ChevronDown
          size={20}
          className="profile-section__chevron"
          aria-hidden="true"
        />
      </button>
      <div
        id={panelId}
        className="profile-section__panel"
        role="region"
        aria-labelledby={headingId}
        hidden={!open}
      >
        {children}
      </div>
    </section>
  );
};

export default CollapsibleSection;