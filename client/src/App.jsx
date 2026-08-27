import { Navigate, Route, Routes } from 'react-router-dom';
import { Admin } from './pages/Admin.jsx';
import { AppShell } from './components/layout/AppShell.jsx';
import { Chat } from './pages/Chat.jsx';
import { ChatProvider } from './store/ChatContext.jsx';
import { Feedback } from './pages/Feedback.jsx';
import { Learn } from './pages/Learn.jsx';
import { LearnTopic } from './pages/LearnTopic.jsx';
import { LearnTrack } from './pages/LearnTrack.jsx';
import { Login } from './pages/Login.jsx';
import { Profile } from './pages/Profile.jsx';
import { ProCoder } from './pages/ProCoder.jsx';
import { Register } from './pages/Register.jsx';
import { Revision } from './pages/Revision.jsx';
import { Roadmap } from './pages/Roadmap.jsx';
import { Stats } from './pages/Stats.jsx';
import { Tasks } from './pages/Tasks.jsx';
import { useAuth } from './store/AuthContext.jsx';
import { moduleVisible } from './store/modules.js';
import { Docs } from './pages/Docs.jsx';
import { AttemptTimerProvider } from './store/AttemptTimerContext.jsx';
import { RoadmapProvider } from './store/RoadmapContext.jsx';
import { CPProvider } from './store/CPContext.jsx';
import { TasksProvider } from './store/TasksContext.jsx';

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
        {/*
          The one route that exists on both sides of this branch. Someone
          deciding whether to sign up is the reader who most needs to know what
          this is, and a page that answers that from behind a login answers
          nobody. It draws its own bar out here; inside the shell below it
          picks up the sidebar instead.
        */}
        <Route path="/docs" element={<Docs />} />
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

    TasksProvider holds the one running timer, not the board — the pill it feeds
    is drawn in the top bar on every page, so that state cannot live on the
    tasks route. Unlike the routes below, it is mounted unconditionally rather
    than behind `has('tasks')`: AppShell calls `useTasks()` without knowing
    whether the module is on, and the provider reads that itself and never
    fetches when it is off. A conditional provider would make the hook throw on
    every page the moment the module was hidden.

    AttemptTimerProvider is the same shape for the problem stopwatch, and is
    mounted here for the same reason: its pill is drawn in the top bar, so the
    clock cannot live on the roadmap route. It holds no server state at all —
    see the file for why that one is local.
  */
  return (
    <RoadmapProvider>
      <ChatProvider>
        <TasksProvider>
          <AttemptTimerProvider>
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
                {/*
                  Three routes for one module, and all three go together — a
                  bookmark to a topic inside a hidden Learn falls through to the
                  roadmap like the hub does. The pages are imported eagerly; it is
                  the *content* that is lazy, one chunk per topic behind the
                  registry in learn/tracks.js.
                */}
                {has('learn') && <Route path="/learn" element={<Learn />} />}
                {has('learn') && <Route path="/learn/:track" element={<LearnTrack />} />}
                {has('learn') && <Route path="/learn/:track/:topic" element={<LearnTopic />} />}
                {has('tasks') && <Route path="/tasks" element={<Tasks />} />}
                {/*
                  Pro Coder mounts its own provider on the route rather than
                  around the tree, unlike the roadmap's. The ladder is 800 rows
                  and two requests, and nothing outside this page reads it — the
                  sidebar shows roadmap patterns, not CP tiers — so fetching it
                  for someone who never opens /cp would be a megabyte spent on
                  nothing.
                */}
                {has('procoder') && (
                  <Route
                    path="/cp"
                    element={
                      <CPProvider>
                        <ProCoder />
                      </CPProvider>
                    }
                  />
                )}
                {has('feedback') && <Route path="/feedback" element={<Feedback />} />}
                <Route path="/docs" element={<Docs />} />
                <Route path="/profile" element={<Profile />} />
                {/* Guards itself. A learner who types /admin is redirected home, so
                    the route is indistinguishable from one that does not exist. */}
                <Route path="/admin" element={<Admin />} />
                <Route path="/admin/:section" element={<Admin />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AttemptTimerProvider>
        </TasksProvider>
      </ChatProvider>
    </RoadmapProvider>
  );
}
