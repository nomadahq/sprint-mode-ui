// src/InboxRow.tsx
// INBOX-UX-1: Shared row component for the unified inbox feed.
// Renders a single update or notification entry with unread dot, category pill,
// title, body snippet, author, action link, and timestamp.
//
// Props:
//   item           — row from GET /api/portal/updates or GET /api/notifications
//   onRead         — called when row is clicked; should POST /api/notifications/:id/read
//   onNavigate     — optional deeplink handler (navigate-type items)
//   onClick        — if provided, replaces default onRead+onNavigate behavior
//   category       — pill styling { label, bg, color } for the category indicator
//   expanded       — when true, renders expandedContent below the row
//   expandedContent — React node to render inside expanded area

import React from 'react'

export interface InboxItem {
  id: string
  title: string
  body?: string | null
  update_type?: string | null
  notification_type?: string | null
  audience?: string | null
  comm_type?: string | null
  action_url?: string | null
  action_label?: string | null
  published_at?: string | null
  created_at?: string | null
  read_at?: string | null
  dismissed_at?: string | null
  author_name?: string | null
  attachments?: unknown
  source_system?: string | null
  priority?: string | null
  thread_id?: string | null
}

export interface CategoryPill {
  label: string
  bg: string
  color: string
}

interface InboxRowProps {
  item: InboxItem
  onRead?: (id: string) => void
  onNavigate?: (url: string) => void
  onClick?: () => void
  category?: CategoryPill
  expanded?: boolean
  expandedContent?: React.ReactNode
  /** WAFFLE-AUDIT-1: optional per-row action rendered after the author/action
   *  line (e.g. a "file to Waffle" button). Host portals own the behavior;
   *  the row only reserves the slot. Clicks inside the slot should call
   *  stopPropagation to avoid triggering the row's read/navigate. */
  rowAction?: (item: InboxItem) => React.ReactNode
}

function formatRelative(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return ''
  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Fallback type labels when no category prop is provided (backward compat)
const TYPE_LABELS: Record<string, string> = {
  flash_update: 'Flash',
  board_update: 'Board',
  milestone: 'Milestone',
  sprint_report: 'Sprint',
  announcement: 'Announce',
  ai_weekly: 'AI Weekly',
  policy: 'Policy',
  culture: 'Culture',
  general: 'General',
  notification: 'Notification',
  support_reply: 'Reply',
  system_event: 'System',
  bug_comment: 'Bug',
}

const TYPE_COLORS: Record<string, string> = {
  flash_update: 'var(--blue)',
  board_update: 'var(--purple, #7c3aed)',
  milestone: 'var(--green)',
  sprint_report: 'var(--blue)',
  ai_weekly: 'var(--purple, #7c3aed)',
  announcement: 'var(--orange, #f97316)',
  notification: 'var(--text-2, #6b7280)',
  support_reply: 'var(--blue)',
  bug_comment: 'var(--red)',
  system_event: 'var(--text-2, #6b7280)',
}

export function InboxRow({ item, onRead, onNavigate, onClick, category, expanded, expandedContent, rowAction }: InboxRowProps) {
  const isUnread = !item.read_at && !item.dismissed_at
  const timestamp = item.published_at || item.created_at

  function handleClick() {
    if (onClick) {
      onClick()
      return
    }
    if (onRead) onRead(item.id)
    if (item.action_url && onNavigate) onNavigate(item.action_url)
  }

  // Category pill or legacy type badge
  var pillEl: React.ReactNode
  if (category) {
    pillEl = (
      <span style={{
        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
        background: category.bg, color: category.color,
        textTransform: 'uppercase', whiteSpace: 'nowrap', flexShrink: 0,
        letterSpacing: '.3px',
      }}>{category.label}</span>
    )
  } else {
    const typeKey = item.update_type || item.notification_type || item.comm_type || 'general'
    const typeLabel = TYPE_LABELS[typeKey] || typeKey
    const typeColor = TYPE_COLORS[typeKey] || 'var(--text-2, #6b7280)'
    pillEl = (
      <span style={{
        fontSize: 11, fontWeight: 600, color: typeColor,
        textTransform: 'uppercase', letterSpacing: '.5px', flexShrink: 0,
      } as React.CSSProperties}>{typeLabel}</span>
    )
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick() }}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          padding: '14px 16px',
          borderBottom: expanded ? 'none' : '1px solid var(--border, #e5e7eb)',
          background: isUnread ? 'var(--surface-1, rgba(0,0,0,.03))' : 'transparent',
          cursor: 'pointer',
          transition: 'background 0.1s',
          outline: 'none',
        } as React.CSSProperties}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.background = 'var(--surface-1, rgba(0,0,0,.04))'
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.background = isUnread
            ? 'var(--surface-1, rgba(0,0,0,.03))'
            : 'transparent'
        }}
      >
        {/* Unread dot */}
        <div style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: isUnread ? 'var(--accent, var(--blue, #2362ea))' : 'transparent',
          flexShrink: 0,
          marginTop: 6,
        } as React.CSSProperties} />

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 } as React.CSSProperties}>
          {/* Header row: category pill + timestamp */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 4,
          } as React.CSSProperties}>
            {pillEl}
            <span style={{
              fontSize: 11,
              color: 'var(--muted, var(--text-2, #6b7280))',
              marginLeft: 'auto',
              flexShrink: 0,
            } as React.CSSProperties}>
              {formatRelative(timestamp)}
            </span>
          </div>

          {/* Title */}
          <div style={{
            fontSize: 14,
            fontWeight: isUnread ? 600 : 400,
            color: 'var(--foreground, var(--text-0, inherit))',
            lineHeight: 1.4,
            marginBottom: item.body ? 4 : 0,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          } as React.CSSProperties}>
            {item.title}
          </div>

          {/* Body snippet */}
          {item.body && !expanded && (
            <div style={{
              fontSize: 13,
              color: 'var(--muted, var(--text-2, #6b7280))',
              lineHeight: 1.45,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            } as React.CSSProperties}>
              {item.body}
            </div>
          )}

          {/* Author + action */}
          {(item.author_name || item.action_label) && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 6,
            } as React.CSSProperties}>
              {item.author_name && (
                <span style={{ fontSize: 12, color: 'var(--muted, var(--text-2, #6b7280))' } as React.CSSProperties}>
                  {item.author_name}
                </span>
              )}
              {item.action_label && item.action_url && (
                <span style={{
                  fontSize: 12,
                  color: 'var(--accent, var(--blue, #2362ea))',
                  marginLeft: 'auto',
                  fontWeight: 500,
                } as React.CSSProperties}>
                  {item.action_label} &#8594;
                </span>
              )}
            </div>
          )}

          {/* WAFFLE-AUDIT-1: optional host-provided row action */}
          {rowAction && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 } as React.CSSProperties}>
              {rowAction(item)}
            </div>
          )}
        </div>
      </div>

      {/* Expanded content (rendered by parent) */}
      {expanded && expandedContent && (
        <div style={{
          padding: '0 16px 14px 36px',
          borderBottom: '1px solid var(--border, #e5e7eb)',
          background: 'var(--surface-1, rgba(0,0,0,.02))',
        }}>
          {expandedContent}
        </div>
      )}
    </div>
  )
}

export default InboxRow
