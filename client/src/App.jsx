import { lazy, Suspense } from 'react';
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
import { Playbook } from './pages/Playbook.jsx';
import { Practice } from './pages/Practice.jsx';
import { Profile } from './pages/Profile.jsx';
import { ProCoder } from './pages/ProCoder.jsx';
import { SqlLab } from './pages/SqlLab.jsx';
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
import { SqlProvider } from './store/SqlContext.jsx';
import { PlaybookProvider } from './store/PlaybookContext.jsx';
import { TasksProvider } from './store/TasksContext.jsx';

/*
  The first route-level code split in the app, and the reason is size rather
  than principle. Every other page is a list, a form or a chart built from the
  same handful of shared components; System Design ships a canvas engine, a DBML
  parser and its own stylesheet, and none of that should be downloaded by
  someone who opens the roadmap. Both pages share one chunk family, and the
  project cards warm the workspace chunk on hover (see DesignHome).
*/
const DesignHome = lazy(() => import('./pages/DesignHome.jsx').then((m) => ({ default: m.DesignHome })));
const DesignWorkspace = lazy(() =>
  import('./pages/DesignWorkspace.jsx').then((m) => ({ default: m.DesignWorkspace })),
);
const lazyPage = (element) => (
  <Suspense fallback={<div className="loading">Loading…</div>}>{element}</Suspense>
);

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
                {/*
                  Playbook mounts its own provider on the route, like Pro Coder
                  below and for the same reason: nothing outside this page reads
                  the plan, so a fetch on every session for a page most of them
                  never open would be a request spent on nothing.

                  It used to be gated to one account. It is an ordinary module
                  now — every role gets it unless a super admin hides it — so
                  `has('playbook')` is the same hidden-module check as every
                  other line here, and a deployment that hides it falls through
                  to the roadmap exactly as the rest do.
                */}
                {has('playbook') && (
                  <Route
                    path="/playbook"
                    element={
                      <PlaybookProvider>
                        <Playbook />
                      </PlaybookProvider>
                    }
                  />
                )}
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
                {/* Route-level provider, for the reason the ladder's is: the bank
                    is a hundred and twenty statements and a WASM engine, and
                    nothing outside this page reads either. */}
                {has('sql') && (
                  <Route
                    path="/sql"
                    element={
                      <SqlProvider>
                        <SqlLab />
                      </SqlProvider>
                    }
                  />
                )}
                {/* No provider of its own: the drill reads the roadmap that is
                    already in memory, and a run is one POST when you stop. */}
                {has('practice') && <Route path="/practice" element={<Practice />} />}
                {has('feedback') && <Route path="/feedback" element={<Feedback />} />}
                {has('design') && <Route path="/design" element={lazyPage(<DesignHome />)} />}
                <Route path="/docs" element={<Docs />} />
                <Route path="/profile" element={<Profile />} />
                {/* Guards itself. A learner who types /admin is redirected home, so
                    the route is indistinguishable from one that does not exist. */}
                <Route path="/admin" element={<Admin />} />
                <Route path="/admin/:section" element={<Admin />} />
              </Route>
              {/*
                Outside the shell on purpose: a board wants the whole window, the
                way Figma's editor does, so there is no sidebar, top bar or chat
                bubble to share it with. Still inside the providers, so the
                session and toasts behave exactly as they do everywhere else.
              */}
              {has('design') && (
                <Route path="/design/:projectId/:boardId?" element={lazyPage(<DesignWorkspace />)} />
              )}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AttemptTimerProvider>
        </TasksProvider>
      </ChatProvider>
    </RoadmapProvider>
  );
}
