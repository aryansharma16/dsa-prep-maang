import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { AdminAudit } from '../components/admin/AdminAudit.jsx';
import { AdminChat } from '../components/admin/AdminChat.jsx';
import { AdminFeedback } from '../components/admin/AdminFeedback.jsx';
import { AdminGuides } from '../components/admin/AdminGuides.jsx';
import { AdminModules } from '../components/admin/AdminModules.jsx';
import { AdminMotivation } from '../components/admin/AdminMotivation.jsx';
import { AdminOverview } from '../components/admin/AdminOverview.jsx';
import { AdminPatterns } from '../components/admin/AdminPatterns.jsx';
import { AdminProblems } from '../components/admin/AdminProblems.jsx';
import { AdminSignups } from '../components/admin/AdminSignups.jsx';
import { AdminUsers } from '../components/admin/AdminUsers.jsx';
import { useAuth } from '../store/AuthContext.jsx';
import { ROLE_LABEL, can } from '../store/caps.js';

const SECTIONS = [
  { id: '', label: 'Overview', Component: AdminOverview },
  { id: 'users', label: 'Users', Component: AdminUsers, cap: 'user:read' },
  // Directly under Users because it is the door into that list: every account
  // below now starts as a row here. First of the two queues for the same reason
  // Feedback sits next to it — somebody is waiting at the other end of both,
  // and this one cannot use the app at all until it is answered.
  { id: 'signups', label: 'Requests', Component: AdminSignups, cap: 'signup:read' },
  // Next to Users deliberately: "who is here" and "what they are telling us" are
  // one cluster, and this is the tab with a person waiting at the other end of it.
  { id: 'feedback', label: 'Feedback', Component: AdminFeedback, cap: 'feedback:read' },
  { id: 'problems', label: 'Problems', Component: AdminProblems, cap: 'content:read' },
  { id: 'patterns', label: 'Patterns', Component: AdminPatterns, cap: 'content:read' },
  { id: 'guides', label: 'Guides', Component: AdminGuides, cap: 'content:read' },
  { id: 'motivation', label: 'Motivation', Component: AdminMotivation, cap: 'content:read' },
  // `settings:read`, not `settings:write` — an admin can see whether chat is up
  // and which providers are reachable; the panel itself refuses their edits.
  { id: 'chat', label: 'AI Chat', Component: AdminChat, cap: 'settings:read' },
  // Same reasoning: an admin can see that Notes is hidden on purpose rather
  // than broken, and only the super admin can change it.
  { id: 'modules', label: 'Modules', Component: AdminModules, cap: 'settings:read' },
  { id: 'activity', label: 'Activity', Component: AdminAudit },
];

export function Admin() {
  const { user } = useAuth();
  const { section = '' } = useParams();
  const navigate = useNavigate();

  /*
    Redirect rather than a "not allowed" page. A 403 screen confirms the route
    exists; sending a learner home makes /admin behave exactly like /asdf, which
    the catch-all already does. That is what "must not see it at all" means.
  */
  if (!can(user, 'panel')) return <Navigate to="/" replace />;

  const visible = SECTIONS.filter((s) => !s.cap || can(user, s.cap));
  const active = visible.find((s) => s.id === section) || visible[0];
  const Component = active.Component;

  return (
    <>
      <div className="page-head">
        <h1>
          Admin
          <span className={`role-pill ${user.role}`}>{ROLE_LABEL[user.role]}</span>
        </h1>
        <p>
          {can(user, 'content:write')
            ? 'You own the curriculum, the guides and every account.'
            : 'You can edit guides and manage accounts. The curriculum is the super admin’s.'}
        </p>
      </div>

      <div className="admin-tabs" role="tablist">
        {visible.map((s) => (
          <button
            key={s.id || 'overview'}
            type="button"
            role="tab"
            aria-selected={s.id === active.id}
            className={`admin-tab ${s.id === active.id ? 'on' : ''}`}
            onClick={() => navigate(s.id ? `/admin/${s.id}` : '/admin')}
          >
            {s.label}
          </button>
        ))}
      </div>

      <Component />
    </>
  );
}
