import { default as React } from 'react';
export interface ProfileCardProps {
    /** Currently only 'self' is supported */
    variant?: 'self';
    /** API base URL (default: https://api.sprintmode.ai) */
    apiBase?: string;
    /** Optional back link href shown above the page title */
    backHref?: string;
    /**
     * Portal subdomain (e.g. 'admin', 'signal', 'investors').
     * UI-POLISH-1: sent as X-SM-Product on every fetch so sm-api reads the
     * correct per-door session cookie post-LOGIN_DOOR_CUTOVER. Without this,
     * /api/profile returns 404 for slim-session users who have no legacy
     * sm_client cookie (regression introduced by FLIP-HOTFIX-1 / FEAT-1915).
     */
    portalSubdomain?: string;
}
export interface ProfileData {
    id?: string;
    full_name?: string;
    email?: string;
    title?: string;
    phone?: string;
    photo_url?: string | null;
    company_name?: string;
    portal_role?: string;
    role?: string;
    hire_date?: string;
    portal_last_login?: string;
    contact_type?: string;
    role_label?: string;
    slack_profile_url?: string;
    gws_groups?: (string | {
        email?: string;
        name?: string;
    })[];
    emails?: {
        email: string;
        is_primary?: number;
        email_type?: string;
    }[];
    payroll?: {
        job_title?: string;
        label?: string;
        date?: string;
        amount?: number;
        currency?: string;
        status?: string;
    }[];
}
export declare function ProfileCard(props: ProfileCardProps): React.JSX.Element;
