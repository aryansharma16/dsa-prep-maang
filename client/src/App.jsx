import { Navigate, Route, Routes } from 'react-router-dom';
import { Admin } from './pages/Admin.jsx';
import { AppShell } from './components/layout/AppShell.jsx';
import { Chat } from './pages/Chat.jsx';
import { ChatProvider } from './store/ChatContext.jsx';
import { Login } from './pages/Login.jsx';
import { Profile } from './pages/Profile.jsx';
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

  /*
    ChatProvider sits inside this branch on purpose. When `user` goes null the
    whole tree unmounts and the conversation goes with it, so one account's
    questions cannot survive a sign-out into the next session on a shared
    machine. Inside RoadmapProvider too, so the problem picker can read the
    roadmap that is already in memory instead of fetching it again.
  */
  return (
    <RoadmapProvider>
      <ChatProvider>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<Roadmap />} />
            <Route path="/revision" element={<Revision />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/profile" element={<Profile />} />
            {/* Guards itself. A learner who types /admin is redirected home, so
                the route is indistinguishable from one that does not exist. */}
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/:section" element={<Admin />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ChatProvider>
    </RoadmapProvider>
  );
}
