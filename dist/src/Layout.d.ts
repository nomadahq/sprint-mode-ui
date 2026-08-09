import { default as React } from 'react';
import { SessionData } from './api.js';
declare global {
    interface Window {
        __SM_SESSION?: SessionData & {
            portals?: Record<string, {
                access?: boolean;
                view_as?: boolean;
                name?: string;
                portal_type?: string;
                brand_color?: string | null;
                brand_tint?: string | null;
                icon_key?: string | null;
                logo_mark_url?: string | null;
                custom_domain?: string | null;
            }>;
        };
    }
}
export interface CmdKItemMeta {
    badge?: string;
    badgeColor?: string;
    detail?: string;
    breadcrumbs?: string[];
    snippet?: string;
}
export interface CmdKItem {
    label: string;
    to: string;
    section?: string;
    subsection?: string;
    keywords?: string;
    step?: number;
    Icon?: React.ComponentType;
    disabled?: boolean;
    meta?: CmdKItemMeta;
}
export interface WaffleSearchRow {
    id: string;
    display_id?: string | null;
    title?: string | null;
    status?: string | null;
    product?: string | null;
    type?: string | null;
    tags?: string | null;
    subsystem?: string | null;
}
export declare function mapBugsToCmdKItems(rows: WaffleSearchRow[]): CmdKItem[];
export interface CmdKProps {
    open: boolean;
    onClose: () => void;
    items?: CmdKItem[];
    onNavigate?: (to: string) => void;
    placeholder?: string;
    onSearch?: (query: string) => Promise<{
        items: CmdKItem[];
        total?: number;
    }>;
    recentKey?: string;
}
export interface NavItem {
    to: string;
    label: string;
    icon?: string;
    Icon?: React.ComponentType | null;
    exact?: boolean;
    external?: boolean;
    disabled?: boolean;
    step?: number;
    completed?: boolean;
    locked?: boolean;
    permKey?: string;
    href?: string;
}
export interface NavSection {
    key?: string;
    label: string;
    items: NavItem[];
    sectionIcon?: React.ReactNode;
    sectionColor?: string;
    product?: string;
    flat?: boolean;
    type?: string;
    /** Render this (non-flat) section collapsed until the user opens it.
     *  User toggles persist to localStorage and win over this default;
     *  a child route becoming active still auto-opens the group. */
    defaultCollapsed?: boolean;
}
export interface HeaderCta {
    label: string;
    onClick: () => void;
    variant?: 'outline' | 'filled';
}
export interface LayoutProps {
    navConfig?: Record<string, {
        label: string;
        items: NavItem[];
    }>;
    navSections?: (NavSection & {
        type?: string;
        heading?: string;
    })[];
    /** Unfiltered nav sections for route-level permission checking.
     * When the parent component pre-filters navSections (e.g. filterNavByPermissions),
     * denied items are removed and the route guard can't find them. Pass the ORIGINAL
     * unfiltered sections here so the route guard can block direct URL navigation
     * to denied routes. Falls back to navSections if not provided. */
    routeGuardNav?: (NavSection & {
        type?: string;
        heading?: string;
    })[];
    navBottom?: NavItem[];
    session?: SessionData | null;
    children?: React.ReactNode;
    logoSrc?: string;
    logoAlt?: string;
    title?: string;
    headerRight?: React.ReactNode;
    sidebarBottom?: React.ReactNode;
    viewAsEnabled?: boolean;
    viewAsApi?: string;
    viewAsDetailApi?: string;
    headerIcon?: React.ReactNode;
    onLogout?: string;
    profilePath?: string;
    cmdK?: boolean | {
        placeholder?: string;
    };
    cmdKItems?: CmdKItem[];
    onSearch?: (query: string) => Promise<{
        items: CmdKItem[];
        total?: number;
    }>;
    recentKey?: string;
    showCompanyName?: boolean;
    byLine?: string;
    userMenuExtra?: React.ReactNode;
    notificationApiBase?: string;
    notificationHref?: string;
    headerCta?: HeaderCta;
    viewAsAnyRole?: boolean;
    onViewAsChange?: (viewAs: ViewAsUser | null) => void;
    onViewAsTeamChange?: (viewAs: ViewAsUser | null) => void;
    bugPanel?: boolean | number;
    bugPanelAdmin?: boolean;
    bugPanelLabel?: string;
    /** WAFFLE-3.5: forwarded to the embedded panel — its MCP Keys button navigates here instead of opening the modal. */
    bugPanelMcpKeysHref?: string;
    portalSubdomain?: string;
    viewAsClientNav?: (NavSection & {
        type?: string;
        heading?: string;
    })[];
}
export declare function useSession(): SessionData | null;
export interface ViewAsUser {
    email: string;
    name: string;
    company_id?: string;
    company_name?: string;
    portal_role?: string;
    role?: string;
    role_type?: string;
    products?: string[];
    id?: string;
    permissions?: string | Record<string, unknown>;
}
export declare var ViewAsContext: React.Context<ViewAsUser | null>;
export declare function useViewAs(): ViewAsUser | null;
export declare var ViewAsTeamContext: React.Context<ViewAsUser | null>;
export declare function useViewAsTeam(): ViewAsUser | null;
export declare function useTheme(): {
    mode: "auto" | "dark" | "light";
    isDark: boolean;
    setMode: (m: "light" | "dark" | "auto") => void;
    toggle: () => void;
};
export declare function CmdK(props: CmdKProps): React.FunctionComponentElement<React.FragmentProps> | null;
export declare function PortalSwitcher(): null;
export interface Permissions {
    sections?: Record<string, {
        view?: boolean;
        login?: boolean;
    }>;
    products?: Record<string, boolean>;
}
export declare function parsePerms(session: SessionData | ViewAsUser | null): Permissions | null;
export declare function canViewSection(perms: Permissions | null, role: string | null | undefined, key: string | undefined): boolean;
declare const Layout: React.FC<LayoutProps>;
export default Layout;
