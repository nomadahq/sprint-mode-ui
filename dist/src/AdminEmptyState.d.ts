import { default as React } from 'react';
export interface AdminEmptyStateProps {
    /** The portal's display name, e.g. "Waffle", "Signal". */
    portalName: string;
    /** The active role's display name or key, e.g. "CAIO", "Owner". */
    roleDisplayName: string;
    /**
     * When the identity also holds a customer role on this portal, pass the
     * role key so the Swap button can be rendered. Omit or pass null/undefined
     * to suppress the button entirely.
     */
    customerRole?: string | null;
    /**
     * Callback fired when the user clicks [Swap to <customerRole>].
     * The host portal is responsible for calling /auth/swap-role or
     * redirecting — this component only triggers the action.
     */
    onSwapToCustomerRole?: (role: string) => void;
    /** Customer role display name override; falls back to customerRole key. */
    customerRoleDisplayName?: string | null;
}
export declare function AdminEmptyState(props: AdminEmptyStateProps): React.DetailedReactHTMLElement<{
    style: {
        display: "flex";
        alignItems: "center";
        justifyContent: "center";
        minHeight: string;
        fontFamily: "var(--font, system-ui, -apple-system, sans-serif)";
        padding: string;
    };
    'data-testid': string;
}, HTMLElement>;
