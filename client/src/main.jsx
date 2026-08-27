import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App.jsx';
import { AppearanceProvider } from './store/AppearanceContext.jsx';
import { AuthProvider } from './store/AuthContext.jsx';
import { ToastProvider } from './store/ToastContext.jsx';
import './styles/tokens.css';
import './styles/base.css';
import './styles/app.css';
/*
  After app.css on purpose. `.cp-root` redefines tokens the shared components
  read, and several of its rules are `.cp-root .thing` overrides of a plain
  `.thing` — equal specificity, so source order is what decides them.
*/
import './styles/cp.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          {/* Inside AuthProvider so it can adopt the account's saved colours,
              outside <App/> so the signed-out pages are themed too. */}
          <AppearanceProvider>
            <App />
          </AppearanceProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
