import { ReactNode } from 'react';
interface DocumentProps {
  id?: string
  contract_type?: string
  doc_type?: string
  contract_number?: string | number
  pandadoc_document_name?: string
  name?: string
  html_content?: string
  pdf_url?: string
  url?: string
  status?: string
  requires_action?: number | boolean
  start_date?: string
  end_date?: string
  created_at?: string
  sent_at?: string
  viewed_at?: string
  completed_at?: string
  doc_password?: string
  auto_renewal?: boolean | number
  notice_period_days?: number
  payment_terms?: string
  share_class?: string
  year?: string
  source_entity?: string
  target_entity?: string
  [key: string]: unknown
}

type RelatedDoc = DocumentProps

interface DocumentDetailProps {
  document: DocumentProps
  relatedDocs?: RelatedDoc[]
  onDownload?: (doc: DocumentProps, encrypted: boolean) => void
  showProgression?: boolean
  filterKeys?: string[]
}

interface TermCardsProps {
  html: string
  filterKeys?: string[]
}

interface PipelineBarProps {
  status: string
  dates?: {
    created_at?: string
    sent_at?: string
    viewed_at?: string
    completed_at?: string
  }
}

export declare function DocumentDetail(props: DocumentDetailProps): ReactNode
export declare function TermCards(props: TermCardsProps): ReactNode
export declare function PipelineBar(props: PipelineBarProps): ReactNode
export function docTypeLabel(t: string): string;
