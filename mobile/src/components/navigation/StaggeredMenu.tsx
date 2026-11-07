'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { gsap } from 'gsap';
import './StaggeredMenu.css';

export interface StaggeredMenuItem {
  label: string;
  ariaLabel?: string;
  link?: string;
  active?: boolean;
  dividerBefore?: boolean;
  isDanger?: boolean;
  /** A small icon drawn in a rounded tile before the label. */
  icon?: React.ReactNode;
  onClick?: () => void;
}

export interface StaggeredMenuProps {
  position?: 'left' | 'right';
  colors?: string[];
  items?: StaggeredMenuItem[];
  className?: string;
  logoComponent?: React.ReactNode;
  brandTitle?: React.ReactNode;
  /** A quiet line under the brand name. */
  brandSubtitle?: string;
  accentColor?: string;
  isFixed?: boolean;
  closeOnClickAway?: boolean;
  isOpen?: boolean;
  onMenuOpen?: () => void;
  onMenuClose?: () => void;
}

export const StaggeredMenu: React.FC<StaggeredMenuProps> = ({
  position = 'left',
  colors = ['#FE8701', '#013E86'],
  items = [],
  className,
  logoComponent,
  brandTitle = 'Washing Basket',
  brandSubtitle,
  accentColor = '#FE8701',
  isFixed = true,
  closeOnClickAway = true,
  isOpen: controlledOpen,
  onMenuOpen,
  onMenuClose,
}) => {
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);
  const panelRef = useRef<HTMLElement | null>(null);
  const preLayersRef = useRef<HTMLDivElement | null>(null);
  const preLayerElsRef = useRef<HTMLElement[]>([]);

  const openTlRef = useRef<gsap.core.Timeline | null>(null);
  const closeTweenRef = useRef<gsap.core.Tween | null>(null);
  const busyRef = useRef(false);
  const itemEntranceTweenRef = useRef<gsap.core.Tween | null>(null);

  useLayoutEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;

    const ctx = gsap.context(() => {
      const panel = panelRef.current;
      const preContainer = preLayersRef.current;
      if (!panel) return;

      let preLayers: HTMLElement[] = [];
      if (preContainer) {
        preLayers = Array.from(preContainer.querySelectorAll('.sm-prelayer')) as HTMLElement[];
      }
      preLayerElsRef.current = preLayers;

      const offscreen = position === 'left' ? -100 : 100;
      gsap.set([panel, ...preLayers], { xPercent: offscreen, opacity: 1 });
      if (preContainer) {
        gsap.set(preContainer, { xPercent: 0, opacity: 1 });
      }
    });
    return () => ctx.revert();
  }, [position]);

  const buildOpenTimeline = useCallback(() => {
    const panel = panelRef.current;
    if (!panel) return null;

    let layers = preLayerElsRef.current;
    if ((!layers || !layers.length) && preLayersRef.current) {
      layers = Array.from(preLayersRef.current.querySelectorAll('.sm-prelayer')) as HTMLElement[];
      preLayerElsRef.current = layers;
    }

    openTlRef.current?.kill();
    if (closeTweenRef.current) {
      closeTweenRef.current.kill();
      closeTweenRef.current = null;
    }
    itemEntranceTweenRef.current?.kill();

    const itemEls = Array.from(panel.querySelectorAll('.sm-panel-itemLabel')) as HTMLElement[];
    const panelTop = panel.querySelector('.sm-panel-top');

    const offscreen = position === 'left' ? -100 : 100;
    const layerStates = (layers || []).map((el) => ({ el, start: offscreen }));
    const panelStart = offscreen;

    // Ensure full visibility during animation
    gsap.set([panel, ...(layers || [])], { opacity: 1 });
    if (preLayersRef.current) {
      gsap.set(preLayersRef.current, { opacity: 1 });
    }

    if (itemEls.length) {
      gsap.set(itemEls, { yPercent: 140, rotate: 8 });
    }
    if (panelTop) {
      gsap.set(panelTop, { opacity: 0, y: -10 });
    }

    const tl = gsap.timeline({ paused: true });

    layerStates.forEach((ls, i) => {
      tl.fromTo(
        ls.el,
        { xPercent: ls.start, opacity: 1 },
        { xPercent: 0, opacity: 1, duration: 0.45, ease: 'power4.out' },
        i * 0.06
      );
    });
    const lastTime = layerStates.length ? (layerStates.length - 1) * 0.06 : 0;
    const panelInsertTime = lastTime + (layerStates.length ? 0.07 : 0);
    const panelDuration = 0.58;
    tl.fromTo(
      panel,
      { xPercent: panelStart, opacity: 1 },
      { xPercent: 0, opacity: 1, duration: panelDuration, ease: 'power4.out' },
      panelInsertTime
    );

    if (panelTop) {
      tl.to(
        panelTop,
        {
          opacity: 1,
          y: 0,
          duration: 0.4,
          ease: 'power2.out',
        },
        panelInsertTime + 0.06
      );
    }

    if (itemEls.length) {
      const itemsStart = panelInsertTime + panelDuration * 0.16;
      tl.to(
        itemEls,
        {
          yPercent: 0,
          rotate: 0,
          duration: 0.8,
          ease: 'power4.out',
          stagger: { each: 0.05, from: 'start' },
        },
        itemsStart
      );
    }

    openTlRef.current = tl;
    return tl;
  }, [position]);

  const playOpen = useCallback(() => {
    busyRef.current = true;
    const tl = buildOpenTimeline();
    if (tl) {
      tl.eventCallback('onComplete', () => {
        busyRef.current = false;
      });
      tl.play(0);
    } else {
      busyRef.current = false;
    }
  }, [buildOpenTimeline]);

  const playClose = useCallback(() => {
    openTlRef.current?.kill();
    openTlRef.current = null;
    itemEntranceTweenRef.current?.kill();

    const panel = panelRef.current;
    let layers = preLayerElsRef.current;
    if ((!layers || !layers.length) && preLayersRef.current) {
      layers = Array.from(preLayersRef.current.querySelectorAll('.sm-prelayer')) as HTMLElement[];
      preLayerElsRef.current = layers;
    }
    if (!panel) return;

    const all = [...(layers || []), panel];
    closeTweenRef.current?.kill();
    const offscreen = position === 'left' ? -100 : 100;
    closeTweenRef.current = gsap.to(all, {
      xPercent: offscreen,
      duration: 0.28,
      ease: 'power3.in',
      overwrite: 'auto',
      onComplete: () => {
        const itemEls = Array.from(panel.querySelectorAll('.sm-panel-itemLabel'));
        if (itemEls.length) {
          gsap.set(itemEls, { yPercent: 140, rotate: 8 });
        }
        busyRef.current = false;
      },
    });
  }, [position]);

  const closeMenu = useCallback(() => {
    if (openRef.current) {
      openRef.current = false;
      setOpen(false);
      onMenuClose?.();
      playClose();
    }
  }, [playClose, onMenuClose]);

  // Sync with controlled `isOpen` prop
  useEffect(() => {
    if (controlledOpen === undefined) return;
    if (controlledOpen !== openRef.current) {
      openRef.current = controlledOpen;
      setOpen(controlledOpen);
      if (controlledOpen) {
        onMenuOpen?.();
        playOpen();
      } else {
        onMenuClose?.();
        playClose();
      }
    }
  }, [controlledOpen, playOpen, playClose, onMenuOpen, onMenuClose]);

  // Handle click outside panel on backdrop to close
  useEffect(() => {
    if (!closeOnClickAway || !open) return;

    let timer: ReturnType<typeof setTimeout>;
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        closeMenu();
      }
    };

    // Delay attaching so that the opening click itself does not immediately trigger close
    timer = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 150);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [closeOnClickAway, open, closeMenu]);

  return (
    <div
      className={
        (className ? className + ' ' : '') +
        'staggered-menu-wrapper' +
        (isFixed ? ' fixed-wrapper' : '')
      }
      style={accentColor ? ({ ['--sm-accent']: accentColor } as React.CSSProperties) : undefined}
      data-position={position}
      data-open={open || undefined}
    >
      {/* Semi-transparent dimmed backdrop covering remaining 1/4th of screen */}
      <div className="sm-backdrop" onClick={closeMenu} aria-hidden="true" />

      {/* Prelayers matching 3/4th width with sharp edges */}
      <div ref={preLayersRef} className="sm-prelayers" aria-hidden="true">
        {(() => {
          const raw = colors && colors.length ? colors.slice(0, 4) : ['#FE8701', '#013E86'];
          let arr = [...raw];
          if (arr.length >= 3) {
            const mid = Math.floor(arr.length / 2);
            arr.splice(mid, 1);
          }
          return arr.map((c, i) => (
            <div key={i} className="sm-prelayer" style={{ background: c }} />
          ));
        })()}
      </div>

      {/* 3/4th Width Sharp Drawer Panel */}
      <aside
        id="staggered-menu-panel"
        ref={panelRef}
        className="staggered-menu-panel"
        aria-hidden={!open}
      >
        {/* Panel Internal Header: Logo + Brand Name + Close Button */}
        <div className="sm-panel-top">
          <div className="sm-panel-logo">
            {logoComponent}
            {brandTitle ? (
              <span className="sm-panel-brand">
                {typeof brandTitle === 'string' ? (
                  <span className="sm-panel-brand-text">{brandTitle}</span>
                ) : (
                  brandTitle
                )}
                {brandSubtitle ? <span className="sm-panel-brand-sub">{brandSubtitle}</span> : null}
              </span>
            ) : null}
          </div>
          <button
            className="sm-panel-close-btn"
            onClick={closeMenu}
            aria-label="Close menu"
            type="button"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#0A1C3E"
              strokeWidth="2.4"
              strokeLinecap="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="sm-panel-inner">
          {/* Staggered Items List - Clean, Pure, Bold Sans, NO numbers */}
          <ul className="sm-panel-list" role="list">
            {items && items.length ? (
              items.map((it, idx) => (
                <li className={`sm-panel-itemWrap${it.dividerBefore ? " sm-panel-item-divider" : ""}`} key={it.label + idx}>
                  <button
                    className={'sm-panel-item' + (it.active ? ' active-item' : '') + (it.isDanger ? ' danger-item' : '')}
                    aria-label={it.ariaLabel || it.label}
                    onClick={() => {
                      it.onClick?.();
                      closeMenu();
                    }}
                    type="button"
                  >
                    <span className="sm-panel-itemLabel">
                      {it.icon ? <span className="sm-panel-itemIcon">{it.icon}</span> : null}
                      <span className="sm-panel-itemText">{it.label}</span>
                    </span>
                  </button>
                </li>
              ))
            ) : (
              <li className="sm-panel-itemWrap" aria-hidden="true">
                <span className="sm-panel-item">
                  <span className="sm-panel-itemLabel">No items</span>
                </span>
              </li>
            )}
          </ul>
        </div>

      </aside>
    </div>
  );
};

export default StaggeredMenu;
