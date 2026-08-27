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
/* Its own sheet, and it redefines no tokens — Practice is the same app with a
   stopwatch on, not a different room the way the ladder is. */
import './styles/practice.css';
/*
  After cp.css, for the same reason cp.css is after app.css: the playbook
  borrows the ladder's panel language and overrides a handful of shared classes
  at equal specificity, so source order is what decides them.
*/
import './styles/playbook.css';
/*
  Last. Learn is its own room like the ladder is — `.learn-shell` redefines the
  same tokens the shared components read, and several of its rules override a
  plain `.thing` at equal specificity, so source order is what decides them.
*/
import './styles/learn.css';

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
