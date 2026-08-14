import { default as React } from 'react';
import { SessionData } from './api.js';
export interface ActingRoleChipProps {
    session: SessionData | null;
    /** Base URL for /auth/exit-swap-role (empty string for same-origin proxy). */
    apiBase?: string;
    /** Portal subdomain — sent as X-SM-Product so the right per-door cookie is
     *  re-minted (same contract as the view-as controls). */
    portalSubdomain?: string;
}
export declare function ActingRoleChip(props: ActingRoleChipProps): React.DetailedReactHTMLElement<{
    title: string;
    style: {
        display: "flex";
        alignItems: "center";
        gap: number;
        height: number;
        padding: string;
        border: string;
        borderRadius: number;
        background: string;
        color: "var(--accent)";
        fontSize: number;
        fontWeight: number;
        flexShrink: number;
        boxSizing: "border-box";
    };
}, HTMLElement> | null;
