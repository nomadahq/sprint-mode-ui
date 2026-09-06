import { default as React, ReactNode } from 'react';
export interface PortalConfig {
    id?: string;
    subdomain?: string;
    name?: string;
    brand_color?: string | null;
    brand_tint?: string | null;
    logo_url?: string | null;
    favicon_url?: string | null;
    icon_key?: string | null;
    logo_mark_url?: string | null;
    custom_domain?: string | null;
    nav_enabled?: boolean | number;
    billing_enabled?: boolean | number;
    cmdk_enabled?: boolean | number;
    updates_enabled?: boolean | number;
    chat_enabled?: boolean | number;
    [key: string]: unknown;
}
export interface PortalConfigContextValue {
    config: PortalConfig | null;
    loading: boolean;
    error: string | null;
}
export interface PortalConfigProviderProps {
    subdomain: string;
    /** TASK-3229 (D2 one door shape): prefix in front of /api/* routes.
     *  "" routes the portal-config read through the portal's own origin
     *  (proxy). The default stays direct to https://api.sprintmode.ai until
     *  a later square flips every portal to the proxy default. */
    apiBase?: string;
    children: ReactNode;
}
export declare function usePortalConfig(): PortalConfigContextValue;
export declare function PortalConfigProvider({ subdomain, apiBase, children }: PortalConfigProviderProps): React.JSX.Element;
