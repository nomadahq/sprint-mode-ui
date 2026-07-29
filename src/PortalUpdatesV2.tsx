import React, { useState, useEffect, useCallback, useRef } from 'react'
import { UpdateAttachments, Attachment } from './UpdateAttachments.tsx'
import { InboxRow, CategoryPill } from './InboxRow.tsx'
import type { InboxItem } from './InboxRow.tsx'

// ─── Types ──────────────────────────────────────────────────────────────────────

interface UpdateItem {
  id: string
  title: string
  body?: string
  update_type?: string
  comm_type?: string
  published_at?: string
  author_name?: string
  read_at?: string
  notification_type?: string
  priority?: string
  source_system?: string
  action_url?: string
  action_label?: string
  attachments?: Attachment[] | string | null
  thread_id?: string
}


interface SupportThread {
  id: string
  subject?: string
  status?: string
  message_count?: number
  last_message?: string
  last_role?: string
  created_at?: string
  updated_at?: string
  request_status?: string
  product?: string
  contact_name?: string
  contact_email?: string
  contact_id?: string
  company_id?: string
}

interface SupportMessage {
  id: string
  role: string
  content: string
  created_at?: string
  attachments?: string | Attachment[] | null
}

interface AdminThreadDetail {
  thread: SupportThread & Record<string, unknown>
  messages: SupportMessage[]
  context?: {
    contact?: Record<string, unknown>
    company?: Record<string, unknown>
    engagement?: Record<string, unknown>
  }
}


export interface PortalUpdatesV2Props {
  api: (path: string, opts?: Record<string, unknown>) => Promise<Record<string, unknown>>
  subdomain?: string
  title?: string
  subtitle?: string
  shortcutKey?: string
  userContactId?: string
  onNavigate?: (path: string) => void
}

// ─── Category system ────────────────────────────────────────────────────────────

var CATEGORY_PILLS: Record<string, CategoryPill> = {
  lead:       { label: 'Lead',      bg: '#E1F5EE', color: '#0F6E56' },
  contract:   { label: 'Contract',  bg: '#EEEDFE', color: '#3C3489' },
  screening:  { label: 'Screening', bg: '#E6F1FB', color: '#0C447C' },
  signal:     { label: 'Signal',    bg: 'hsla(340,55%,47%,.1)', color: 'hsl(340,55%,47%)' },
  mode:       { label: 'Mode',      bg: 'hsla(160,84%,39%,.1)', color: 'hsl(160,84%,39%)' },
  support:    { label: 'Support',   bg: '#FAEEDA', color: '#633806' },
  alert:      { label: 'Alert',     bg: '#FCEBEB', color: '#791F1F' },
  platform:   { label: 'Platform',  bg: '#E6F1FB', color: '#0C447C' },
  people:     { label: 'People',    bg: '#EEEDFE', color: '#3C3489' },
  finance:    { label: 'Finance',   bg: '#FAEEDA', color: '#633806' },
  bug:        { label: 'Bug',       bg: '#FCEBEB', color: '#791F1F' },
  update:     { label: 'Update',    bg: '#EAF3DE', color: '#27500A' },
  ai_weekly:  { label: 'AI Weekly', bg: '#EEEDFE', color: '#3C3489' },
  sprint:     { label: 'Sprint',    bg: '#EEEDFE', color: '#3C3489' },
  milestone:  { label: 'Milestone', bg: '#EAF3DE', color: '#27500A' },
  announce:   { label: 'Announce',  bg: '#E6F1FB', color: '#0C447C' },
  flash:      { label: 'Flash',     bg: '#FCEBEB', color: '#791F1F' },
  board:      { label: 'Board',     bg: '#E6F1FB', color: '#0C447C' },
  policy:     { label: 'Policy',    bg: '#FAEEDA', color: '#633806' },
  culture:    { label: 'Culture',   bg: '#E1F5EE', color: '#085041' },
  task:       { label: 'Task',      bg: '#E6F1FB', color: '#0C447C' },
  report:     { label: 'Report',    bg: '#E9EFFC', color: '#2362ea' },
  test:       { label: 'Test',      bg: '#f3f4f6', color: '#6b7280' },
  general:    { label: 'General',   bg: '#f3f4f6', color: '#6b7280' },
}

function getCategory(item: UpdateItem): string {
  var nt = item.notification_type || ''
  var ct = item.comm_type || ''
  var ut = item.update_type || ''

  // notification_type overrides
  if (nt === 'sales' || nt === 'lead_submitted' || nt === 'lead_reply' || nt === 'lead_interested') return 'lead'
  if (nt === 'contract_sent' || nt === 'contract_signed' || nt === 'contract_declined') return 'contract'
  if (nt === 'screening_scheduled') return 'screening'
  if (nt === 'signal_anomaly') return 'signal'
  if (nt === 'mode_scan_complete') return 'mode'
  if (nt === 'chat_escalated' || nt === 'support_reply') return 'support'
  if (nt === 'guardrail_flag') return 'alert'
  if (nt.indexOf('portal_') === 0) return 'platform'
  if (nt.indexOf('deel_') === 0) return 'people'
  if (nt === 'payment_failed' || nt === 'invoice_overdue') return 'finance'
  if (nt === 'action_item_assigned') return 'task'
  if (nt === 'team_update_published') return 'update'
  if (nt === 'push_test') return 'test'

  // comm_type fallback
  if (ct === 'bug_comment') return 'bug'

  // update_type fallback for content updates
  if (ut === 'ai_weekly') return 'ai_weekly'
  if (ut === 'sprint_report') return 'sprint'
  if (ut === 'milestone') return 'milestone'
  if (ut === 'announcement') return 'announce'
  if (ut === 'flash_update') return 'flash'
  if (ut === 'quarterly_update') return 'report'
  if (ut === 'monthly_flash') return 'flash'
  if (ut === 'board_update') return 'board'
  if (ut === 'policy') return 'policy'
  if (ut === 'culture') return 'culture'

  return 'general'
}

// Navigate-type categories: clicking the row navigates away
var _NAVIGATE_CATEGORIES = new Set(['lead', 'contract', 'screening', 'signal', 'mode', 'bug', 'alert', 'platform', 'people', 'finance', 'task'])

// Expand-type categories: clicking the row expands body + attachments inline
var EXPAND_CATEGORIES = new Set(['support', 'update', 'ai_weekly', 'sprint', 'milestone', 'announce', 'flash', 'board', 'policy', 'culture', 'general', 'test'])

// ─── Helpers ────────────────────────────────────────────────────────────────────

function relativeTime(iso: string | undefined): string {
  if (!iso) return ''
  var diff = Date.now() - new Date(iso).getTime()
  var m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return m + 'm ago'
  var h = Math.floor(m / 60)
  if (h < 24) return h + 'h ago'
  var d = Math.floor(h / 24)
  if (d < 30) return d + 'd ago'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Sub-components ─────────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div style={{
      textAlign: 'center', padding: '48px 24px',
      border: '1px solid var(--border, #e5e7eb)', borderRadius: 'var(--radius, 8px)',
      color: 'var(--muted, var(--text-3, #9ca3af))',
    }}>
      <div style={{ fontSize: 13 }}>{message}</div>
    </div>
  )
}

// ─── Filter bar ─────────────────────────────────────────────────────────────────

interface FilterBarProps {
  readFilter: 'all' | 'unread'
  onReadFilterChange: (v: 'all' | 'unread') => void
  categories: { key: string; label: string; unreadCount: number; bg: string; color: string }[]
  selectedCategories: Set<string>
  onCategoryToggle: (key: string) => void
}

function FilterBar({ readFilter, onReadFilterChange, categories, selectedCategories, onCategoryToggle }: FilterBarProps) {
  var pillBase: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
    cursor: 'pointer', border: 'none', fontFamily: 'inherit',
    textTransform: 'uppercase', letterSpacing: '.3px',
    transition: 'background .12s, color .12s, box-shadow .12s',
    display: 'inline-flex', alignItems: 'center', gap: 5,
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
      {/* Section 1: All / Unread — mutually exclusive */}
      <button
        onClick={function() { onReadFilterChange('all') }}
        style={Object.assign({}, pillBase, {
          background: readFilter === 'all' ? 'var(--accent, var(--blue, #2362ea))' : 'var(--bg-subtle, #f3f4f6)',
          color: readFilter === 'all' ? '#fff' : 'var(--muted, #6b7280)',
        })}
      >All</button>
      <button
        onClick={function() { onReadFilterChange('unread') }}
        style={Object.assign({}, pillBase, {
          background: readFilter === 'unread' ? 'var(--accent, var(--blue, #2362ea))' : 'var(--bg-subtle, #f3f4f6)',
          color: readFilter === 'unread' ? '#fff' : 'var(--muted, #6b7280)',
        })}
      >Unread</button>

      {/* Divider */}
      {categories.length > 0 && (
        <span style={{ width: 1, height: 16, background: 'var(--border, #e5e7eb)', flexShrink: 0 }} />
      )}

      {/* Section 2: Category chips — multi-select */}
      {categories.map(function(cat) {
        var isSelected = selectedCategories.has(cat.key)
        return (
          <button
            key={cat.key}
            onClick={function() { onCategoryToggle(cat.key) }}
            style={Object.assign({}, pillBase, {
              background: isSelected ? cat.bg : 'var(--bg-subtle, #f3f4f6)',
              color: isSelected ? cat.color : 'var(--muted, #6b7280)',
              boxShadow: isSelected ? 'inset 0 0 0 1px ' + cat.color + '33' : 'none',
            })}
          >
            {cat.label}
            {cat.unreadCount > 0 && (
              <span style={{
                fontSize: 9, fontWeight: 700,
                minWidth: 14, height: 14, borderRadius: 7,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: isSelected ? cat.color : 'var(--muted, #9ca3af)',
                color: '#fff', padding: '0 4px',
              }}>{cat.unreadCount}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ─── Feed section ───────────────────────────────────────────────────────────────

function FeedSection({ items, api, onNavigate, isTeam, subdomain }: {
  items: UpdateItem[]
  api: PortalUpdatesV2Props['api']
  onNavigate?: (path: string) => void
  isTeam?: boolean
  subdomain?: string
}) {
  var [readFilter, setReadFilter] = useState<'all' | 'unread'>('all')
  var [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set())
  var [expandedId, setExpandedId] = useState<string | null>(null)

  // Support thread inline state
  var [threadDetail, setThreadDetail] = useState<AdminThreadDetail | null>(null)
  var [threadLoading, setThreadLoading] = useState(false)
  var [replyText, setReplyText] = useState('')
  var [sending, setSending] = useState(false)
  var [threadAttachments, setThreadAttachments] = useState<Attachment[]>([])
  var [uploading, setUploading] = useState(false)
  var fileInputRef = useRef<HTMLInputElement>(null)

  // Build category list from items in the feed
  var categoryMap = new Map<string, { unreadCount: number }>()
  items.forEach(function(item) {
    var cat = getCategory(item)
    var entry = categoryMap.get(cat)
    if (!entry) {
      entry = { unreadCount: 0 }
      categoryMap.set(cat, entry)
    }
    if (!item.read_at) entry.unreadCount++
  })

  var categoryChips = Array.from(categoryMap.entries())
    .map(function(e) {
      var pill = CATEGORY_PILLS[e[0]] || CATEGORY_PILLS.general
      return { key: e[0], label: pill.label, bg: pill.bg, color: pill.color, unreadCount: e[1].unreadCount }
    })
    .sort(function(a, b) { return b.unreadCount - a.unreadCount })

  function toggleCategory(key: string) {
    setSelectedCategories(function(prev) {
      var next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Apply filters
  var filtered = items.filter(function(item) {
    if (readFilter === 'unread' && item.read_at) return false
    if (selectedCategories.size > 0) {
      var cat = getCategory(item)
      if (!selectedCategories.has(cat)) return false
    }
    return true
  })

  function handleRead(id: string) {
    api('/api/notifications/' + id + '/read', { method: 'POST' }).catch(function() {})
  }

  function getSignedUrl(updateId: string, attId: string) {
    return api('/api/updates/' + updateId + '/attachments/' + attId + '/url') as Promise<{ url?: string; data?: { url?: string } }>
  }

  function getThreadSignedUrl(_updateId: string, attId: string) {
    if (!expandedId) return Promise.resolve({} as { url?: string; data?: { url?: string } })
    var expandedItem = items.find(function(i) { return i.id === expandedId })
    var tid = expandedItem?.thread_id
    if (!tid) return Promise.resolve({} as { url?: string; data?: { url?: string } })
    if (isTeam) {
      return api('/api/support/threads/' + tid + '/attachments/' + attId + '/url') as Promise<{ url?: string; data?: { url?: string } }>
    }
    if (subdomain) {
      return api('/api/portals/' + subdomain + '/support/threads/' + tid + '/attachments/' + attId + '/url') as Promise<{ url?: string; data?: { url?: string } }>
    }
    return Promise.resolve({} as { url?: string; data?: { url?: string } })
  }

  function loadSupportThread(threadId: string) {
    setThreadLoading(true)
    setThreadDetail(null)
    var endpoint = isTeam
      ? '/api/support/threads/' + threadId
      : subdomain
        ? '/api/portals/' + subdomain + '/support/threads/' + threadId
        : null
    if (!endpoint) { setThreadLoading(false); return }
    api(endpoint).then(function(res) {
      if (res.ok) {
        // Admin endpoint returns { thread, messages, context }
        // Portal endpoint returns { messages } or similar
        var data = res.data as AdminThreadDetail | { messages?: SupportMessage[] }
        if ('thread' in data) {
          setThreadDetail(data as AdminThreadDetail)
        } else {
          // Wrap portal response into AdminThreadDetail shape
          setThreadDetail({ thread: {} as AdminThreadDetail['thread'], messages: (data as { messages?: SupportMessage[] }).messages || [], context: undefined })
        }
      }
      setThreadLoading(false)
    }).catch(function() { setThreadLoading(false) })
  }

  function sendSupportReply(threadId: string) {
    if (!replyText.trim() || sending) return
    setSending(true)
    var endpoint = isTeam
      ? '/api/support/threads/' + threadId + '/reply'
      : subdomain
        ? '/api/portals/' + subdomain + '/support/threads/' + threadId + '/reply'
        : null
    if (!endpoint) { setSending(false); return }
    api(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: replyText.trim(), attachments: threadAttachments.length > 0 ? JSON.stringify(threadAttachments) : undefined }),
    }).then(function() {
      setReplyText(''); setThreadAttachments([]); setSending(false)
      loadSupportThread(threadId)
    }).catch(function() { setSending(false) })
  }

  function uploadThreadFile(file: File, threadId: string) {
    if (uploading) return
    setUploading(true)
    var fd = new FormData(); fd.append('file', file)
    var endpoint = isTeam
      ? '/api/support/threads/' + threadId + '/attachments'
      : subdomain
        ? '/api/portals/' + subdomain + '/support/threads/' + threadId + '/attachments'
        : null
    if (!endpoint) { setUploading(false); return }
    fetch(endpoint, { method: 'POST', credentials: 'include', body: fd })
      .then(function(r) { return r.json() })
      .then(function(res: Record<string, unknown>) {
        if (res.ok && res.data) {
          var att = (res.data as Record<string, unknown>).attachment as Attachment
          setThreadAttachments(function(prev) { return prev.concat(att) })
        }
        setUploading(false)
      }).catch(function() { setUploading(false) })
  }

  function handleItemClick(item: UpdateItem) {
    var cat = getCategory(item)
    handleRead(item.id)

    // Support items with thread_id: expand inline with thread detail
    if (cat === 'support' && item.thread_id) {
      if (expandedId === item.id) {
        setExpandedId(null)
        setThreadDetail(null)
        setReplyText(''); setThreadAttachments([])
      } else {
        setExpandedId(item.id)
        loadSupportThread(item.thread_id)
        setReplyText(''); setThreadAttachments([])
      }
      return
    }

    if (EXPAND_CATEGORIES.has(cat)) {
      setExpandedId(function(prev) { return prev === item.id ? null : item.id })
      setThreadDetail(null)
    } else if (item.action_url && onNavigate) {
      onNavigate(item.action_url)
    }
  }

  return (
    <div>
      <FilterBar
        readFilter={readFilter}
        onReadFilterChange={setReadFilter}
        categories={categoryChips}
        selectedCategories={selectedCategories}
        onCategoryToggle={toggleCategory}
      />
      {filtered.length === 0 ? (
        <EmptyState message={readFilter === 'unread' ? 'No unread items' : 'No updates yet'} />
      ) : (
        <div style={{ border: '1px solid var(--border, #e5e7eb)', borderRadius: 'var(--radius, 8px)', overflow: 'hidden' }}>
          {filtered.map(function(item) {
            var cat = getCategory(item)
            var pill = CATEGORY_PILLS[cat] || CATEGORY_PILLS.general
            var isExpanded = expandedId === item.id
            var isSupportThread = cat === 'support' && item.thread_id && isExpanded

            var expandedContent: React.ReactNode = null
            if (isExpanded && isSupportThread) {
              // ── Inline support thread ──────────────────────────────────────
              expandedContent = (
                <div>
                  {threadLoading && !threadDetail ? (
                    <div style={{ textAlign: 'center', padding: 20, fontSize: 12, color: 'var(--muted, #9ca3af)' }}>Loading thread...</div>
                  ) : threadDetail ? (
                    <div>
                      {/* Context bar (admin only) */}
                      {threadDetail.context?.company && (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                          <span onClick={function() { if (onNavigate) onNavigate('/crm/' + String((threadDetail!.context!.company as Record<string, unknown>).id)) }}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', background: 'var(--bg-subtle, #f3f4f6)', border: '1px solid var(--border, #e5e7eb)', borderRadius: 99, fontSize: 11, color: 'var(--accent, #7c5cbf)', cursor: 'pointer' }}>
                            {String((threadDetail.context.company as Record<string, unknown>).name || 'Company')}
                          </span>
                        </div>
                      )}
                      {/* Messages */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                        {(threadDetail.messages || []).map(function(msg) {
                          var isUser = msg.role === 'user'
                          var isBot = msg.role === 'assistant'
                          var isHuman = msg.role === 'human'
                          if (!isUser && !isBot && !isHuman) {
                            return <div key={msg.id} style={{ display: 'flex', justifyContent: 'center' }}>
                              <span style={{ padding: '3px 12px', background: 'var(--bg-subtle, #f3f4f6)', border: '1px solid var(--border, #e5e7eb)', borderRadius: 99, fontSize: 11, color: 'var(--muted, #6b7280)' }}>{msg.content}</span>
                            </div>
                          }
                          return (
                            <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start' }}>
                              {!isUser && <div style={{ fontSize: 11, color: isHuman ? 'var(--accent, #7c5cbf)' : 'var(--muted, #9ca3af)', marginBottom: 4 }}>
                                {isBot ? 'AI · Support' : 'Team'}
                              </div>}
                              <div style={{
                                maxWidth: '85%', padding: '8px 12px', fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap',
                                borderRadius: 10,
                                borderBottomRightRadius: isUser ? 3 : 10,
                                borderBottomLeftRadius: !isUser ? 3 : 10,
                                background: isUser ? 'var(--accent, #7c5cbf)' : isHuman ? 'var(--accent-soft, #EEEDFE)' : 'var(--bg-0, transparent)',
                                color: isUser ? '#fff' : isHuman ? 'var(--accent, #7c5cbf)' : 'var(--foreground, inherit)',
                                border: isHuman ? '1px solid hsla(262,60%,55%,.2)' : isUser ? 'none' : '1px solid var(--border, #e5e7eb)',
                                marginLeft: isUser ? 'auto' : 0, marginRight: isUser ? 0 : 'auto',
                              }}>{msg.content}</div>
                              {msg.attachments && (
                                <div style={{ maxWidth: '85%', marginLeft: isUser ? 'auto' : 0 }}>
                                  <UpdateAttachments attachments={msg.attachments} updateId={item.thread_id || item.id} getSignedUrl={getThreadSignedUrl} compact />
                                </div>
                              )}
                              <div style={{ fontSize: 10, color: 'var(--muted, #9ca3af)', marginTop: 3, padding: '0 2px' }}>{relativeTime(msg.created_at)}</div>
                            </div>
                          )
                        })}
                      </div>
                      {/* Reply bar */}
                      <div style={{ borderTop: '1px solid var(--border, #e5e7eb)', paddingTop: 8 }}
                        onDragOver={function(e) { e.preventDefault() }}
                        onDrop={function(e) { e.preventDefault(); var f = e.dataTransfer.files && e.dataTransfer.files[0]; if (f && item.thread_id) uploadThreadFile(f, item.thread_id) }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <button onClick={function() { fileInputRef.current && fileInputRef.current.click() }} disabled={uploading} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: uploading ? 'default' : 'pointer',
                            border: '1px solid var(--border, #e5e7eb)', background: 'var(--bg-0, transparent)',
                            color: 'var(--muted, #6b7280)', fontFamily: 'inherit', opacity: uploading ? 0.5 : 1,
                          }}>{uploading ? 'Uploading...' : 'Attach file'}</button>
                          <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={function(e) {
                            var f = e.target.files && e.target.files[0]
                            if (f && item.thread_id) uploadThreadFile(f, item.thread_id)
                            if (fileInputRef.current) fileInputRef.current.value = ''
                          }} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.zip,.mp4,.mov" />
                        </div>
                        {threadAttachments.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                            {threadAttachments.map(function(att) {
                              return <span key={att.id} style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, fontSize: 11,
                                border: '1px solid var(--border, #e5e7eb)', background: 'var(--bg-subtle, #f9fafb)', color: 'var(--foreground, #374151)',
                              }}>
                                {att.filename || att.id}
                                <span onClick={function() { setThreadAttachments(function(prev) { return prev.filter(function(a) { return a.id !== att.id }) }) }}
                                  style={{ cursor: 'pointer', color: 'var(--muted, #9ca3af)', fontSize: 13, lineHeight: 1 }}>x</span>
                              </span>
                            })}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input type="text" value={replyText} onChange={function(e) { setReplyText(e.target.value) }}
                            onKeyDown={function(e) { if (e.key === 'Enter' && !e.shiftKey && item.thread_id) sendSupportReply(item.thread_id) }}
                            placeholder="Reply to this thread..." disabled={sending}
                            style={{ flex: 1, fontSize: 13, padding: '8px 10px', border: '1px solid var(--border, #e5e7eb)', borderRadius: 6, background: 'var(--bg-0, transparent)', color: 'var(--foreground, #111)', fontFamily: 'inherit' }}
                          />
                          <button onClick={function() { if (item.thread_id) sendSupportReply(item.thread_id) }} disabled={sending || !replyText.trim()} style={{
                            padding: '6px 14px', borderRadius: 6, border: 'none',
                            background: 'var(--accent, #7c5cbf)', color: '#fff', fontSize: 12, fontWeight: 500,
                            cursor: 'pointer', fontFamily: 'inherit', opacity: sending || !replyText.trim() ? 0.5 : 1,
                          }}>Send</button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: 'var(--muted, #9ca3af)', padding: '8px 0' }}>Thread not found</div>
                  )}
                  <button onClick={function(e) { e.stopPropagation(); setExpandedId(null); setThreadDetail(null); setReplyText(''); setThreadAttachments([]) }}
                    style={{ fontSize: 11, color: 'var(--muted, var(--text-3, #9ca3af))', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', fontFamily: 'inherit', marginTop: 4 }}>
                    Collapse
                  </button>
                </div>
              )
            } else if (isExpanded) {
              // ── Standard expand (body + attachments) ───────────────────────
              expandedContent = (
                <div>
                  {item.body && (
                    <div style={{
                      fontSize: 13, lineHeight: 1.6,
                      color: 'var(--foreground, var(--text-1, #374151))',
                      whiteSpace: 'pre-wrap', marginBottom: 8,
                    }}>{item.body}</div>
                  )}
                  <UpdateAttachments
                    attachments={item.attachments}
                    updateId={item.id}
                    getSignedUrl={getSignedUrl}
                  />
                  <button
                    onClick={function(e) { e.stopPropagation(); setExpandedId(null) }}
                    style={{
                      fontSize: 11, color: 'var(--muted, var(--text-3, #9ca3af))',
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: '4px 0', fontFamily: 'inherit', marginTop: 4,
                    }}
                  >Collapse</button>
                </div>
              )
            }

            return (
              <InboxRow
                key={item.id}
                item={item as InboxItem}
                category={pill}
                onClick={function() { handleItemClick(item) }}
                expanded={isExpanded}
                expandedContent={expandedContent}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}


// ─── Main component ─────────────────────────────────────────────────────────────

export function PortalUpdatesV2({ api, subdomain, title, subtitle: _subtitle, shortcutKey, userContactId: _userContactId, onNavigate }: PortalUpdatesV2Props) {
  var [loading, setLoading] = useState(true)
  var [error, setError] = useState<string | null>(null)
  var [audiences, setAudiences] = useState<string[]>([])
  var [feedItems, setFeedItems] = useState<UpdateItem[]>([])

  var isTeam = audiences.includes('team')
  var effectiveOnNavigate = onNavigate || (isTeam ? function(path: string) { window.open('https://admin.sprintmode.ai' + path, '_blank') } : undefined)

  var load = useCallback(function() {
    setLoading(true)
    setError(null)
    api('/api/portal/updates').then(function(res: Record<string, unknown>) {
      var d = res.data as { items?: UpdateItem[]; audiences?: string[] } | undefined
      setFeedItems(d?.items || [])
      setAudiences(d?.audiences || ['clients'])
      setLoading(false)
    }).catch(function(e: Error) { setError(e.message || 'Failed to load'); setLoading(false) })
  }, [api])

  useEffect(function() { load() }, [load])

  if (loading) {
    return (
      <div style={{ padding: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <div style={{
            width: 24, height: 24,
            border: '2px solid var(--border, #e5e7eb)',
            borderTopColor: 'var(--accent, #7c5cbf)',
            borderRadius: '50%',
            animation: 'pu2-spin 0.7s linear infinite',
          }} />
          <style>{`@keyframes pu2-spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 0 }}>
        <div style={{ padding: 24, color: 'var(--red, #ef4444)', fontSize: 14 }}>{error}</div>
      </div>
    )
  }

  return (
    <div style={{ padding: 0 }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--foreground, var(--text-0, inherit))', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
          {title || 'Inbox'}
          {shortcutKey && <kbd style={{ fontSize: 10, padding: '1px 5px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-subtle, var(--bg))', color: 'var(--muted)', lineHeight: 1.4, fontFamily: 'var(--font-mono,monospace)', fontWeight: 400 }}>
            {typeof navigator !== 'undefined' && navigator.platform && navigator.platform.indexOf('Mac') !== -1 ? '\u2318' + shortcutKey.toUpperCase() : 'Ctrl+' + shortcutKey.toUpperCase()}
          </kbd>}
        </h1>
      </div>
      <FeedSection items={feedItems} api={api} onNavigate={effectiveOnNavigate} isTeam={isTeam} subdomain={subdomain} />
    </div>
  )
}
