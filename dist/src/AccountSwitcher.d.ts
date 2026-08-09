import { default as React } from 'react';
export interface AccountSwitcherProps {
    /** API base URL (empty string for same-origin) */
    apiBase?: string;
    /** Portal subdomain — sent as X-SM-Product so the API resolves THIS
     *  portal's session cookie. Without it the linked-accounts fetch reads
     *  the wrong cookie and returns nothing on non-admin portals (Waffle). */
    product?: string;
}
export declare function AccountSwitcher(props: AccountSwitcherProps): React.FunctionComponentElement<React.FragmentProps> | null;
