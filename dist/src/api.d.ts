export interface SessionData {
    ok: boolean;
    contact_id?: string;
    email?: string;
    name?: string;
    company_name?: string;
    company_id?: string;
    role?: string;
    portal_role?: string;
    photo?: string;
    products?: string[];
    permissions?: string | Record<string, unknown>;
    is_sm_team?: boolean;
    my_roles?: {
        role: string;
        display_name: string;
        role_type?: string | null;
        is_default: boolean;
        is_active: boolean;
    }[];
    acting_role?: {
        portal: string;
        role: string;
    };
    role_display_name?: string;
    title?: string | null;
    user_id?: string;
    emails?: {
        email: string;
        is_primary: boolean;
        email_type?: string;
        last_sign_in_at?: string | null;
    }[];
    viewing_as?: {
        contact_id?: string;
        email?: string;
        name?: string;
        company_id?: string;
        company_name?: string;
        portal_role?: string;
        products?: string[];
    };
    portals?: Record<string, {
        access: boolean;
        view_as?: string | false;
        name?: string;
        portal_type?: string;
        brand_color?: string | null;
        brand_tint?: string | null;
        icon_key?: string | null;
        logo_mark_url?: string | null;
        custom_domain?: string | null;
    }>;
    [key: string]: unknown;
}
export interface ApiResponse<T = unknown> {
    ok: boolean;
    data?: T;
    error?: string;
}
export interface ApiOptions {
    method?: string;
    body?: unknown;
}
/** Sentinel returned by getSession when the user is authenticated but their
 *  role does not have login access to this portal (403 + reason: 'not_authorized'). */
export declare var ACCESS_DENIED: SessionData;
export declare function getSession(): Promise<SessionData | null>;
export declare function clearSession(): void;
export declare function api(path: string, opts?: ApiOptions): Promise<ApiResponse>;
export declare function formatCurrency(cents: number | null | undefined): string;
export declare function formatDate(str: string | null | undefined): string;
export declare function formatRelative(str: string | null | undefined): string;
export declare function escapeHtml(str: string | null | undefined): string;
