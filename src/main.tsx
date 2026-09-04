import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

// Global error handlers to capture unhandled rejections without crashing the entire DOM
window.addEventListener('unhandledrejection', (event) => {
  console.warn('[Global Unhandled Rejection Caught]:', event.reason);
});

window.addEventListener('error', (event) => {
  console.warn('[Global Error Caught]:', event.error || event.message);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary fallbackTitle="StreamLoop Runtime Guardian">
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

