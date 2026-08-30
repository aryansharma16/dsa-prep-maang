import { useMemo } from 'react';
import { useAuth } from '../store/AuthContext.jsx';
import { planFor } from './plan.js';

/**
 * The plan, in the reading this account should see.
 *
 * Two readings exist — see `voiced()` in plan.js. The personal one is for the
 * account the plan was written for, which is the `super_admin` pinned to
 * SUPER_ADMIN_EMAIL; everybody else gets the generic one.
 *
 * The role, not a capability. There used to be a `playbook` capability and it
 * went when the module opened up to every role, and re-adding one here would
 * claim more than this does: a capability is a question about what an account
 * may *do*, and this only decides which of two sentences it reads. Both ship in
 * the bundle regardless, so a capability would dress a presentation choice up
 * as a boundary it is not.
 *
 * Memoised on the role rather than the user object, so a changed avatar or a
 * refreshed session does not hand every component below a new plan and rerender
 * the page.
 */
export function usePlan() {
  const { user } = useAuth();
  const own = user?.role === 'super_admin';
  return useMemo(() => planFor(own), [own]);
}
