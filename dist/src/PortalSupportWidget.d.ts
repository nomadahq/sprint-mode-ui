import { default as React } from 'react';
export interface PortalSupportWidgetProps {
    subdomain: string;
    apiBase?: string;
    brandColor?: string;
    /** Suppress the floating launcher; panel opens only via the sm-support:open event. */
    hideLauncher?: boolean;
    /** Render inner contents only (tabs + body, no fab/panel/header) for hosting inside another shell. */
    embedded?: boolean;
    /** Tab to start on ('chat' | 'tickets' | 'form'). */
    initialTab?: string;
}
export declare const PortalSupportWidget: React.FC<PortalSupportWidgetProps>;
