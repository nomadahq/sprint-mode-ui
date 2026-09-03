import { default as React } from 'react';
export interface SiteHeaderConfig {
    subdomain?: string;
    name?: string;
    brand_color?: string | null;
    brand_tint?: string | null;
    logo_mark_url?: string | null;
    logo_horizontal_url?: string | null;
    logo_dark_url?: string | null;
    [key: string]: unknown;
}
export interface SiteHeaderNavLink {
    label: string;
    href: string;
    external?: boolean;
}
export interface SiteHeaderProps {
    /** Portal subdomain. Everything else (name, brand, logos) resolves from
     *  portal_configs via the public /api/portal/config endpoint. */
    subdomain: string;
    /** Primary nav links rendered in the header. */
    navLinks?: SiteHeaderNavLink[];
    /** Sign-in destination. Omit to hide the sign-in entry. */
    signInHref?: string;
    /** Sign-in label. Default "Sign in". */
    signInLabel?: string;
    /** The "by ..." lockup rendered beside the wordmark. Default "by Sprint Mode".
     *  Pass null to hide it. */
    byline?: string | null;
    /** Where the logo links to. Default "/". */
    homeHref?: string;
    /** Optional element rendered at the far right of the control row. */
    rightSlot?: React.ReactNode;
    /** Override the API base for config resolution. Default api.sprintmode.ai. */
    apiBase?: string;
    /** Pre-resolved config, to skip the network fetch (e.g. SSR/prerender). */
    config?: SiteHeaderConfig | null;
}
export declare function SiteHeader(props: SiteHeaderProps): React.JSX.Element;
export default SiteHeader;
