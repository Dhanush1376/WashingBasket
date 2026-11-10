/**
 * The Washing Basket website: the story of the service, told in one calm page.
 *
 *   Hero → Story → Brand → Services → The app → Care → Booking → Offers → Download → Footer
 */
import { Component, useEffect, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || null;
    }
    return this.props.children;
  }
}

import { gsap, prefersReducedMotion, ScrollTrigger, startSmoothScroll, whenFree } from './motion';
import { Brand } from './sections/Brand';
import { Download, Footer, Offers } from './sections/Closing';
import { Care } from './sections/Care';
import { Intro } from './sections/Intro';
import { Nav } from './sections/Nav';
import { Hero, Story } from './sections/Opening';
import { AppShowcase, Booking } from './sections/Product';

/**
 * The page's shared entrances, used sparingly: section titles rise line by line out of their masks, and
 * anything marked `data-reveal` lifts gently into place once, the first time it comes into view.
 */
function useReveals() {
  useEffect(() => {
    if (prefersReducedMotion()) return;
    // (set up a little after opening, with the scenes below the fold, so the intro plays without waiting on it)
    let ctx: gsap.Context | null = null;
    let gone = false;
    whenFree(() => {
      if (gone) return;
      ctx = gsap.context(() => {
        gsap.utils.toArray<HTMLElement>('.title').forEach((t) => {
          gsap.from(t.querySelectorAll('.line__in'), {
            yPercent: 108,
            duration: 1.15,
            stagger: 0.08,
            ease: 'expo.out',
            scrollTrigger: { trigger: t, start: 'top 88%', once: true },
          });
        });
        ScrollTrigger.batch('[data-reveal]', {
          start: 'top 90%',
          once: true,
          onEnter: (els) => gsap.fromTo(els, { y: 26, opacity: 0 }, { y: 0, opacity: 1, duration: 1, stagger: 0.07, ease: 'power3.out', overwrite: true }),
        });
        gsap.set('[data-reveal]', { opacity: 0 });
        // anything already on screen at load is revealed by the batch's first check
        ScrollTrigger.refresh();
      });
    });
    return () => {
      gone = true;
      ctx?.revert();
    };
  }, []);
}

export function App() {
  useEffect(() => startSmoothScroll(), []);
  useReveals();

  // measure again once fonts and pictures have settled (not in the middle of the intro: once it has gone)
  useEffect(() => {
    const refresh = () => whenFree(() => ScrollTrigger.refresh());
    document.fonts?.ready.then(refresh);
    window.addEventListener('load', refresh);
    return () => window.removeEventListener('load', refresh);
  }, []);

  return (
    <>
      <Intro />
      <Nav />
      <main id="main" tabIndex={-1}>
        <Hero />
        <Brand />
        <ErrorBoundary><Story /></ErrorBoundary>
        <AppShowcase />
        <Care />
        <Booking />
        <Offers />
        <Download />
      </main>
      <Footer />
    </>
  );
}
