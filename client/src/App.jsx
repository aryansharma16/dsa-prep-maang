import { Navigate, Route, Routes } from 'react-router-dom';
import { Admin } from './pages/Admin.jsx';
import { AppShell } from './components/layout/AppShell.jsx';
import { Chat } from './pages/Chat.jsx';
import { ChatProvider } from './store/ChatContext.jsx';
import { Login } from './pages/Login.jsx';
import { NoteEdit } from './pages/NoteEdit.jsx';
import { Notes } from './pages/Notes.jsx';
import { NoteView } from './pages/NoteView.jsx';
import { Profile } from './pages/Profile.jsx';
import { Register } from './pages/Register.jsx';
import { Revision } from './pages/Revision.jsx';
import { Roadmap } from './pages/Roadmap.jsx';
import { SharedNote } from './pages/SharedNote.jsx';
import { Stats } from './pages/Stats.jsx';
import { useAuth } from './store/AuthContext.jsx';
import { moduleVisible } from './store/modules.js';
import { RoadmapProvider } from './store/RoadmapContext.jsx';

export function App() {
  const { user, ready, modules } = useAuth();
  const has = (key) => moduleVisible(modules, key);

  // Wait for the session check before routing, or a refresh would bounce you to
  // the login screen for a frame.
  if (!ready) return <div className="loading" style={{ paddingTop: 120 }}>Loading...</div>;

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        {/* A shared note opens for someone with no account — that is what the
            link is for. Declared in both branches rather than hoisted above
            them, because the page itself changes with the session: signed in it
            offers "my notes", signed out it offers the product.

            No module check on this side: nobody is signed in, so there is no
            module list to check against. The server answers 404 for a hidden
            notes module regardless, and the page renders that as "this note is
            not available" — the same as an expired link. */}
        <Route path="/n/:publicId" element={<SharedNote />} />
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
            {/*
              A module the super admin has hidden is not declared at all, so its
              URL falls through to the catch-all and lands on the roadmap —
              indistinguishable from a route that was never built, which is the
              same line /admin takes below. Cosmetic, like every guard in this
              file: `requireModule` locks the API behind each of these.
            */}
            {has('revision') && <Route path="/revision" element={<Revision />} />}
            {has('stats') && <Route path="/stats" element={<Stats />} />}
            {has('chat') && <Route path="/chat" element={<Chat />} />}
            {has('notes') && (
              <>
                <Route path="/notes" element={<Notes />} />
                <Route path="/notes/new" element={<NoteEdit />} />
                <Route path="/notes/:id" element={<NoteView />} />
                <Route path="/notes/:id/edit" element={<NoteEdit />} />
              </>
            )}
            <Route path="/profile" element={<Profile />} />
            {/* Guards itself. A learner who types /admin is redirected home, so
                the route is indistinguishable from one that does not exist. */}
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/:section" element={<Admin />} />
          </Route>
          {/* Outside AppShell: a shared link is its own page, with no sidebar
              and nothing that assumes the reader is here to study. */}
          <Route path="/n/:publicId" element={<SharedNote />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ChatProvider>
    </RoadmapProvider>
  );
}
