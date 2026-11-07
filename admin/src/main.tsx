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

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';

import { ToastProvider } from '@/components/ui/Toast';
import { router } from '@/routes';
import { DATA_MODE } from '@/services';
import { applyTokens } from '@/theme/tokens';

applyTokens();

if (import.meta.env.DEV && DATA_MODE === 'mock') {
  console.info('%cWashing Basket Admin · sample data mode', 'font-weight:bold;color:#FE8701', '\nAll data comes from src/mock/data and changes are kept in memory only. Add ?fail=orders (or any service) to the URL to preview error states.');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>
  </StrictMode>,
);
