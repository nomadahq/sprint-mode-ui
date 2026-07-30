import { default as React } from 'react';
import { InboxItem } from './InboxRow.js';
export interface PortalUpdatesV2Props {
    api: (path: string, opts?: Record<string, unknown>) => Promise<Record<string, unknown>>;
    subdomain?: string;
    title?: string;
    subtitle?: string;
    shortcutKey?: string;
    userContactId?: string;
    onNavigate?: (path: string) => void;
    /** WAFFLE-AUDIT-1: optional per-row action slot passed through to InboxRow
     *  (e.g. a "file to Waffle" button). Host portal owns the behavior. */
    rowAction?: (item: InboxItem) => React.ReactNode;
}
export declare function PortalUpdatesV2({ api, subdomain, title, subtitle: _subtitle, shortcutKey, userContactId: _userContactId, onNavigate, rowAction }: PortalUpdatesV2Props): React.JSX.Element;
