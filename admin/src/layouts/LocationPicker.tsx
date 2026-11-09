import { useEffect, useRef, useState } from 'react';

import { Icon } from '@/components/ui/Icon';
import { LOCATIONS, useOperationalLocation, type LocationValue } from '@/hooks/useOperationalLocation';

const LOGOS: Record<string, string> = {
  'loc-nit': `${import.meta.env.BASE_URL}logos/nitj.png`,
  'loc-lpu': `${import.meta.env.BASE_URL}logos/lpu.png`,
  'loc-outside': `${import.meta.env.BASE_URL}logos/wb.png`,
};

export function LocationPicker() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { location, label, isFiltered, setLocation } = useOperationalLocation();

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const select = (value: LocationValue) => {
    setLocation(value);
    setOpen(false);
  };

  return (
    <div className="location-select-wrap" ref={containerRef}>
      <button
        type="button"
        className={`location-select${open ? ' location-select--open' : ''}${isFiltered ? ' location-select--filtered' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Location filter: ${label}`}
        title={`Filter: ${label}`}
      >
        <span className="location-select__icon-box">
          {isFiltered && LOGOS[location] ? (
            <img src={LOGOS[location]} alt="" className="location-select__logo-img" />
          ) : (
            <Icon name="mapPin" size={15} className="location-select__icon" />
          )}
          {isFiltered ? <span className="location-select__dot" aria-hidden /> : null}
        </span>
        <span className="location-select__label">{label}</span>
        <Icon name="chevronDown" size={14} className="location-select__arrow" />
      </button>

      {open && (
        <div className="location-dropdown" role="listbox" aria-label="Select location filter">
          <div className="location-dropdown__header">Operational location</div>
          {LOCATIONS.map((loc) => {
            const isSelected = location === loc.value;
            return (
              <button
                key={loc.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`location-dropdown__item${isSelected ? ' location-dropdown__item--selected' : ''}`}
                onClick={() => select(loc.value)}
              >
                <span className="location-dropdown__item-left">
                  {LOGOS[loc.value] ? (
                    <span className="location-dropdown__logo-squircle">
                      <img src={LOGOS[loc.value]} alt="" className="location-dropdown__logo-img" />
                    </span>
                  ) : (
                    <span className="location-dropdown__logo-squircle location-dropdown__logo-squircle--all">
                      <Icon name="mapPin" size={12} />
                    </span>
                  )}
                  <span className="location-dropdown__item-info">
                    <span className="location-dropdown__item-label">{loc.label}</span>
                    {loc.hint ? <span className="location-dropdown__item-hint">{loc.hint}</span> : null}
                  </span>
                </span>
                {isSelected ? (
                  <span className="location-dropdown__check" aria-hidden>
                    <Icon name="check" size={14} />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
