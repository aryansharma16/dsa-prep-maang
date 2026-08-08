import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell.jsx';
import { Login } from './pages/Login.jsx';
import { Register } from './pages/Register.jsx';
import { Revision } from './pages/Revision.jsx';
import { Roadmap } from './pages/Roadmap.jsx';
import { Stats } from './pages/Stats.jsx';
import { useAuth } from './store/AuthContext.jsx';
import { RoadmapProvider } from './store/RoadmapContext.jsx';

export function App() {
  const { user, ready } = useAuth();

  // Wait for the session check before routing, or a refresh would bounce you to
  // the login screen for a frame.
  if (!ready) return <div className="loading" style={{ paddingTop: 120 }}>Loading...</div>;

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <RoadmapProvider>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Roadmap />} />
          <Route path="/revision" element={<Revision />} />
          <Route path="/stats" element={<Stats />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </RoadmapProvider>
  );
}
