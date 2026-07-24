import { ReactNode } from 'react';
interface FileViewerProps {
  /** Authenticated URL (R2 signed URL or API endpoint) */
  url: string
  /** Filename used for file type detection from extension */
  filename?: string
  /** Max height of the scrollable container (default 800) */
  maxHeight?: number
}

/**
 * Universal file viewer that routes by file extension:
 * - PDF (.pdf) — canvas rendering via PDF.js (CDN)
 * - Images (.png, .jpg, .gif, .webp, .svg) — img tag with zoom + lightbox
 * - Excel (.xlsx, .xls, .csv) — parsed table via SheetJS (CDN)
 * - Word (.docx) — HTML conversion via mammoth (CDN)
 * - Other — download fallback
 */
export declare function FileViewer(props: FileViewerProps): ReactNode

/**
 * Returns true if the filename extension can be previewed inline
 * (PDF, images, Excel, Word). Returns false for download-only types.
 */
export declare function isViewableFile(filename: string | undefined): boolean
