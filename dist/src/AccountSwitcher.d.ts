import { default as React } from 'react';
import { SessionData } from './api.js';
export interface AccountSwitcherProps {
    /** API base URL for the same-origin proxy paths (empty string = same origin) */
    apiBase?: string;
    /** Portal subdomain — sent as X-SM-Product so the API resolves THIS
     *  portal's session cookie. Without it the linked-accounts fetch reads
     *  the wrong cookie and returns nothing on non-admin portals (Waffle). */
    product?: string;
    /** Base URL for the sm-api auth/identity endpoints (/auth/me, /auth/swap-role,
     *  /api/identity/*). Defaults to https://api.sprintmode.ai — the same
     *  contract as the view-as controls. Override on custom-domain portals. */
    authBase?: string;
    /** Session from the shell — used as the initial Roles/emails data source
     *  while the fresh /auth/me fetch is in flight. */
    session?: SessionData | null;
}
export declare function AccountSwitcher(props: AccountSwitcherProps): React.FunctionComponentElement<React.FragmentProps> | null;
