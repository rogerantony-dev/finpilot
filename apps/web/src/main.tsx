import '@fontsource-variable/instrument-sans';
import '@fontsource-variable/newsreader';
import '@fontsource-variable/newsreader/wght-italic.css';
import '@fontsource/ibm-plex-mono/400.css';
import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import { queryClient } from './app/query-client';
import { router } from './app/router';
import { ToastProvider } from './components/ui';
import './index.css';

// A page restored from the back/forward cache after sign-out would show stale
// customer data without re-checking the session; reload it instead.
window.addEventListener('pageshow', (event) => {
  if (event.persisted) window.location.reload();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
);
