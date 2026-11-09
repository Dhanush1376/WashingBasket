import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import '@fontsource/plus-jakarta-sans/700.css';
import '@fontsource/plus-jakarta-sans/800.css';
import '@fontsource/nunito/900.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/pages.css';
import './styles/brand.css';
import './styles/login.css';

import { StrictMode, useEffect, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';

import { BrandIntro, LoadingOverlay } from '@/components/brand/BrandMotion';
import { ToastProvider } from '@/components/ui/Toast';
import { markIntroPlayed, shouldPlayIntro } from '@/lib/demoAuth';
import { router } from '@/routes';
import { DATA_MODE } from '@/services';
import { applyTokens } from '@/theme/tokens';

applyTokens();

if (import.meta.env.DEV && DATA_MODE === 'mock') {
  console.info('%cWashing Basket Admin · sample data mode', 'font-weight:bold;color:#FFA742', '\nAll data comes from src/mock/data and changes are kept in memory only. Add ?fail=orders (or any service) to the URL to preview error states.');
}

/**
 * As in the customer app: the brand intro plays when the portal is first opened in a browser session;
 * later reloads show the logo loader for a moment instead while the page settles.
 */
function Boot({ children }: { children: ReactNode }) {
  const [intro, setIntro] = useState(shouldPlayIntro);
  const [settling, setSettling] = useState(() => !intro);
  useEffect(() => {
    if (!settling) return;
    const t = window.setTimeout(() => setSettling(false), 850);
    return () => window.clearTimeout(t);
  }, [settling]);
  return (
    <>
      {children}
      <LoadingOverlay visible={settling} />
      {intro ? (
        <BrandIntro
          onDone={() => {
            markIntroPlayed();
            setIntro(false);
          }}
        />
      ) : null}
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <Boot>
        <RouterProvider router={router} />
      </Boot>
    </ToastProvider>
  </StrictMode>,
);
