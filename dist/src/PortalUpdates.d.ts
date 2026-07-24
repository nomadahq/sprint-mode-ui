import { default as React } from 'react';
import { Attachment } from './UpdateAttachments.js';
export interface UpdateItem {
    id: string;
    title: string;
    body?: string;
    update_type?: string;
    published_at?: string;
    author_name?: string;
    attachments?: Attachment[] | string | null;
}
export interface PortalUpdatesProps {
    api: (path: string, opts?: Record<string, unknown>) => Promise<{
        data?: {
            items?: UpdateItem[];
        };
    }>;
    title?: string;
    subtitle?: string;
    emptyMessage?: string;
}
export declare function PortalUpdates({ api, title, subtitle, emptyMessage }: PortalUpdatesProps): React.JSX.Element;
