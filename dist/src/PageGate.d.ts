import { default as React } from 'react';
import { SessionData } from './api.js';
import { Permissions } from './Layout.js';
export interface PageGateProps {
    /** Registry permission key for this page, {portal}.{page} (or a grandfathered bare key). */
    permKey: string;
    /** Session override; defaults to Layout's SessionContext. */
    session?: SessionData | null;
    /** Rendered when access is denied. Defaults to the standard section-denied panel. */
    fallback?: React.ReactNode;
    children?: React.ReactNode;
}
/**
 * Page-level access decision. canViewSection semantics, plus: an explicitly
 * denied parent key ({portal} for {portal}.{page}) denies the child even when
 * the child key itself is granted — mirrors the Layout route guard.
 */
export declare function canViewPage(perms: Permissions | null, role: string | null | undefined, permKey: string | undefined): boolean;
/**
 * Standard denied panel — visually identical to the Layout route guard's
 * inline panel ("Section not available"). Kept here so PageGate has no render
 * dependency on Layout internals.
 */
export declare function SectionDeniedPanel(): React.DetailedReactHTMLElement<{
    style: {
        display: "flex";
        alignItems: "center";
        justifyContent: "center";
        height: string;
        fontFamily: "var(--font, system-ui, sans-serif)";
    };
    'data-testid': string;
}, HTMLElement>;
export declare function PageGate(props: PageGateProps): React.FunctionComponentElement<React.FragmentProps>;
