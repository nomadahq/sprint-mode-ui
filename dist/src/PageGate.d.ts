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
 * Page-level access decision — pure canViewSection semantics (single decision
 * path with Layout nav filtering). Parent inheritance applies ONLY when the
 * child key is absent from the row (canViewSection's own rule).
 *
 * Deliberately NO blanket "explicitly denied dot-prefix parent overrides a
 * granted child" rule: a dot prefix is a namespace, not a hierarchy. Live
 * counter-example (studios): bare `studios` is the SM-internal section key,
 * explicitly denied on every customer role, while `studios.billing` is a
 * customer page those roles hold a grant for — the prefix rule would deny it.
 * The registry's parent_key column is the real hierarchy and is enforced
 * server-side; the Layout route guard's parent check is nav-structure-scoped
 * and stays where the nav structure exists.
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
