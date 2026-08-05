import { default as React } from 'react';
interface NotificationPrefsProps {
    apiBase?: string;
    portal?: string;
    mode?: 'simple' | 'full';
    title?: string;
    subtitle?: string;
}
export declare function NotificationPrefs(props: NotificationPrefsProps): React.DetailedReactHTMLElement<{
    style: {
        padding: number;
        display: "flex";
        alignItems: "center";
        justifyContent: "center";
        color: "var(--muted)";
    };
}, HTMLElement> | React.DetailedReactHTMLElement<{
    style: {
        maxWidth: number;
        padding: number;
    };
}, HTMLElement>;
export {};
