import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import './scrollSelect.scss';

// =============================================================================
// ScrollSelect — theme-aware dropdown. The menu is height-capped so only a few
// options show at once; the rest scroll. Reusable anywhere an unbounded native
// <select> or list would get cluttered.
//
// Props:
//   options:      [{ value, label, meta?, trailing? }]
//   value:        currently selected value
//   onChange:     (value) => void
//   placeholder:  shown when nothing selected
//   visibleRows:  how many rows show before scrolling (default 3)
//   ariaLabel:    accessible label for the trigger
//   disabled:     boolean
// =============================================================================
const ROW_PX = 46; // keep in sync with .scrollselect__option min-height

const ScrollSelect = ({
  options = [],
  value,
  onChange,
  placeholder = 'Select…',
  visibleRows = 3,
  ariaLabel,
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef(null);
  const listRef = useRef(null);

  const selected = options.find((o) => o.value === value) || null;

  const close = useCallback(() => {
    setOpen(false);
    setActiveIndex(-1);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) close();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        close();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(options.length - 1, i + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
      } else if (e.key === 'Enter' && activeIndex >= 0) {
        e.preventDefault();
        const opt = options[activeIndex];
        if (opt) {
          onChange?.(opt.value);
          close();
        }
      }
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, options, activeIndex, onChange, close]);

  // keep the active row in view while arrow-keying
  useEffect(() => {
    if (!open || activeIndex < 0 || !listRef.current) return;
    const node = listRef.current.children[activeIndex];
    node?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  const pick = (opt) => {
    onChange?.(opt.value);
    close();
  };

  return (
    <div className={`scrollselect ${open ? 'is-open' : ''}`} ref={rootRef}>
      <button
        type="button"
        className="scrollselect__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="scrollselect__value">
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={16} className="scrollselect__chevron" />
      </button>

      {open && (
        <div className="scrollselect__menu" role="listbox" aria-label={ariaLabel}>
          <div
            className="scrollselect__scroll"
            ref={listRef}
            style={{ maxHeight: `${visibleRows * ROW_PX}px` }}
          >
            {options.length === 0 ? (
              <div className="scrollselect__empty">No options</div>
            ) : (
              options.map((opt, i) => {
                const isSelected = opt.value === value;
                const isActive = i === activeIndex;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={`scrollselect__option ${isSelected ? 'is-selected' : ''} ${
                      isActive ? 'is-active' : ''
                    }`}
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => pick(opt)}
                  >
                    <span className="scrollselect__option-main">
                      <span className="scrollselect__option-label">{opt.label}</span>
                      {opt.meta && (
                        <span className="scrollselect__option-meta">{opt.meta}</span>
                      )}
                    </span>
                    {opt.trailing}
                    {isSelected && (
                      <Check size={15} className="scrollselect__option-check" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ScrollSelect;