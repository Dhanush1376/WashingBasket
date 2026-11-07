import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';

import { Avatar } from '@/components/ui/Avatar';
import { IconButton } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { ErrorBoundary } from '@/components/ui/States';
import { useQuery } from '@/lib/query';
import { dashboardApi } from '@/services';
import { AlertTicker } from './AlertTicker';
import { LocationPicker } from './LocationPicker';
import { MOBILE_TABS, NAV, type NavItem } from './navigation';
import { QuickFind } from './QuickFind';

/**
 * The portal's frame. Roomy, accessible sidebar with quick navigation and notifications.
 */
export function AdminLayout() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem('wb-admin.sidebar-collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const location = useLocation();
  const counts = useQuery('nav-counts', dashboardApi.getNavCounts);
  const profile = useQuery('admin-profile', dashboardApi.getAdminProfile);
  const dashboard = useQuery('dashboard', dashboardApi.getDashboard);

  useEffect(() => setMenuOpen(false), [location.pathname]);

  const toggleSidebar = () => {
    if (window.innerWidth < 1100) {
      setMenuOpen((open) => !open);
    } else {
      setCollapsed((prev) => {
        const next = !prev;
        try {
          window.localStorage.setItem('wb-admin.sidebar-collapsed', String(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    }
  };

  // Isolate sidebar scrolling completely so scrolling over the sidenav never scrolls in-page content
  useEffect(() => {
    const sidebar = sidebarRef.current;
    if (!sidebar) return;

    const handleWheel = (e: WheelEvent) => {
      const nav = navRef.current;
      if (!nav) {
        e.preventDefault();
        return;
      }

      const { scrollTop, scrollHeight, clientHeight } = nav;
      const maxScroll = scrollHeight - clientHeight;

      if (maxScroll <= 0) {
        // Nav doesn't need to scroll; block wheel from bubbling to page content
        e.preventDefault();
        return;
      }

      // If wheel occurred on sidebar header/padding outside nav, route it to nav
      if (!nav.contains(e.target as Node)) {
        e.preventDefault();
        nav.scrollTop += e.deltaY;
        return;
      }

      // If at top boundary and scrolling up
      if (e.deltaY < 0 && scrollTop <= 0) {
        e.preventDefault();
        return;
      }

      // If at bottom boundary and scrolling down
      if (e.deltaY > 0 && scrollTop >= maxScroll - 1) {
        e.preventDefault();
        return;
      }

      // Stop propagation so document/window never receives this wheel event
      e.stopPropagation();
    };

    sidebar.addEventListener('wheel', handleWheel, { passive: false });
    return () => sidebar.removeEventListener('wheel', handleWheel);
  }, []);

  const badge = (item: NavItem) => (item.badge ? counts.data?.[item.badge] : undefined);
  const user = profile.data?.user;
  const currentItem = NAV.flatMap((group) => group.items).find((item) => item.to === location.pathname);

  return (
    <div className="portal-wrap portal-wrap--has-ticker">
      <AlertTicker d={dashboard.data} />
      <div className={`shell${collapsed ? ' shell--collapsed' : ''}${menuOpen ? ' shell--menu' : ''}`}>
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <aside className="sidebar" ref={sidebarRef} aria-label="Main menu">
        <div className="sidebar__brand">
          <img src="/logo.png" alt="" width={38} height={38} className="sidebar__logo" />
          <div className="sidebar__brand-text">
            <span className="sidebar__wordmark" aria-label="WashingBasket">
              <span className="sidebar__cap">W</span>ashing<span className="sidebar__cap">B</span>asket
            </span>
          </div>
          <IconButton icon="x" label="Close menu" className="sidebar__close" onClick={() => setMenuOpen(false)} size={34} />
        </div>

        <nav className="sidebar__nav" ref={navRef}>
          {NAV.map((group) => (
            <div key={group.title} className="nav-group">
              <p className="nav-group__title">{group.title}</p>
              <ul>
                {group.items.map((item) => {
                  const n = badge(item);
                  return (
                    <li key={item.to}>
                      <NavLink to={item.to} end={item.to === '/'} className={({ isActive }) => `nav-link${isActive ? ' nav-link--on' : ''}`}>
                        <Icon name={item.icon} size={17} />
                        <span className="nav-link__text">
                          <span className="nav-link__label">{item.label}</span>
                        </span>
                        {n ? (
                          <span className={`nav-badge${item.badge === 'orders' ? ' nav-badge--quiet' : ''}`} aria-label={`${n} waiting`}>
                            {n}
                          </span>
                        ) : null}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      <div className="scrim" onClick={() => setMenuOpen(false)} aria-hidden />

      <div className="main-col">
        <header className="topbar">
          <IconButton
            icon={menuOpen ? 'x' : 'menu'}
            label={menuOpen ? 'Close sidebar' : collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`topbar__menu${menuOpen ? ' topbar__menu--open' : ''}`}
            onClick={toggleSidebar}
            tone="outline"
            size={40}
          />
          <img src="/logo.png" alt="Washing Basket" width={46} height={46} className="topbar__logo" />
          <div className="topbar__context" aria-label="Current section">
            <span className="topbar__crumb">Washing Basket</span>
            <Icon name="chevronRight" size={13} className="topbar__chevron" aria-hidden />
            <strong className="topbar__page-title">{currentItem?.label ?? 'Page not found'}</strong>
          </div>
          <QuickFind />
          <div className="topbar__end">
            <LocationPicker />
            {user ? (
              <div className="topbar__user" title={`${user.name} (${user.role})`}>
                <Avatar name={user.name} size={32} tone="navy" />
                <span className="topbar__user-text">
                  <span className="topbar__user-name">{user.name}</span>
                  <span className="topbar__user-role">{user.role}</span>
                </span>
              </div>
            ) : null}
          </div>
        </header>

        <main id="main" className="main" tabIndex={-1}>
          <ErrorBoundary resetKey={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

      <nav className="tabbar" aria-label="Quick links">
        {MOBILE_TABS.map((item) => {
          const n = badge(item);
          return (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => `tab${isActive ? ' tab--on' : ''}`}>
              <span className="tab__icon">
                <Icon name={item.icon} size={20} />
                {n && item.badge !== 'orders' ? <span className="tab__badge">{n}</span> : null}
              </span>
              <span className="tab__label">{item.label.split(' ')[0]}</span>
            </NavLink>
          );
        })}
        <button type="button" className="tab" onClick={() => setMenuOpen(true)}>
          <span className="tab__icon">
            <Icon name="menu" size={20} />
          </span>
          <span className="tab__label">More</span>
        </button>
      </nav>
    </div>
  </div>
  );
}
