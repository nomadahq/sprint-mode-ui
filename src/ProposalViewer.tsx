import React, { useState, useEffect, useRef } from 'react'

/**
 * ProposalViewer — shared component for rendering proposals in client portals.
 * Used by sm-studios, sm-mode, sm-signal, and any future portal with proposals.
 *
 * Handles:
 * - CSS injection from content_html (design system classes)
 * - Section rendering with Geist Mono labels
 * - IntersectionObserver scroll tracking
 * - Acceptance section (signature type → next-steps explanation)
 * - Accept/Decline with decline-requires-comment
 * - Comments thread with reply
 *
 * Portal-specific concerns (API calls, DocuSeal, session) stay in each portal.
 * Pass callbacks and data via props.
 */

export interface ProposalViewerSection {
  key: string
  title: string
  type: string
  content: string
}

export interface ProposalViewerComment {
  id: string
  author_name?: string
  author_type?: string
  body: string
  created_at?: string
}

export interface ProposalViewerProps {
  /** The proposal object — needs content_html, status, signature_required, signature_status */
  proposal: {
    content_html?: string | null
    status?: string
    signature_required?: boolean | number
    signature_status?: string
    [key: string]: any
  }
  /** Parsed content_sections array */
  sections: ProposalViewerSection[]
  /** Comments array */
  comments?: ProposalViewerComment[]
  /** Called when a section scrolls into view. Non-fatal if omitted. */
  onTrackSection?: (sectionKey: string) => void
  /** Called when user clicks Accept. Omit to hide Accept button. */
  onAccept?: () => Promise<void> | void
  /** Called when user clicks Decline with reason. Omit to hide Decline button. */
  onDecline?: (reason: string) => Promise<void> | void
  /** Called when user posts a comment. Omit to hide reply box. */
  onPostComment?: (body: string) => Promise<void> | void
  /** Optional: render prop for DocuSeal signature embed (portal-specific) */
  renderSignature?: () => React.ReactNode
  /** Whether the proposal has already been decided (accepted/declined) */
  decided?: string | false
  /** Called after accept/decline to update parent state */
  onDecided?: (decision: string) => void
  /** Back button handler */
  onBack?: () => void
  /** Accent color override (defaults to portal CSS var) */
  accent?: string
}

function fmtCommentDate(d: any) {
  if (!d) return ''
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) } catch { return d }
}

export function ProposalViewer({
  proposal,
  sections,
  comments = [],
  onTrackSection,
  onAccept,
  onDecline,
  onPostComment,
  renderSignature,
  decided: decidedProp = false,
  onDecided,
  onBack,
}: ProposalViewerProps) {
  var [decided, setDecided] = useState<string | false>(decidedProp)
  var [declineStep, setDeclineStep] = useState(0)
  var [commentBody, setCommentBody] = useState('')
  var [posting, setPosting] = useState(false)
  var [localComments, setLocalComments] = useState<ProposalViewerComment[]>(comments)
  var trackedRef = useRef<Set<string>>(new Set())

  // Sync comments prop
  useEffect(function () { setLocalComments(comments) }, [comments])
  useEffect(function () { setDecided(decidedProp) }, [decidedProp])

  // Scroll-based section tracking
  useEffect(function () {
    if (sections.length === 0 || !onTrackSection) return
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var key = (entry.target as HTMLElement).dataset.sectionKey
          if (key && !trackedRef.current.has(key)) {
            trackedRef.current.add(key)
            onTrackSection(key)
          }
        }
      })
    }, { threshold: 0.3 })

    var els = document.querySelectorAll('[data-section-key]')
    els.forEach(function (el) { observer.observe(el) })
    return function () { observer.disconnect() }
  }, [sections, onTrackSection])

  async function handleAccept() {
    if (decided || !onAccept) return
    if (!window.confirm('Accept this proposal? This will generate an MSA and Sales Order for signing.')) return
    try {
      await onAccept()
      setDecided('accepted')
      if (onDecided) onDecided('accepted')
    } catch { alert('Something went wrong.') }
  }

  async function handleDecline() {
    if (decided || !onDecline) return
    var reasonEl = document.getElementById('sp-decline-reason')
    var reason = reasonEl ? (reasonEl as HTMLInputElement).value.trim() : ''
    if (!reason) { alert('Please provide a reason for declining.'); return }
    try {
      await onDecline(reason)
      setDecided('declined')
      if (onDecided) onDecided('declined')
    } catch { alert('Something went wrong.') }
  }

  async function postComment() {
    if (!commentBody.trim() || !onPostComment) return
    setPosting(true)
    try {
      await onPostComment(commentBody.trim())
      setCommentBody('')
    } catch { /* non-fatal */ }
    setPosting(false)
  }

  var sigRequired = proposal.signature_required
  var sigStatus = proposal.signature_status

  // Extract CSS from content_html
  var proposalCss = ''
  if (proposal.content_html) {
    var styleMatch = (proposal.content_html as string).match(/<style[\s\S]*?<\/style>/i)
    if (styleMatch) proposalCss = styleMatch[0]
  }

  return (
    <div style={{ maxWidth: 780, margin: '0 auto', padding: '24px 24px 80px' }}>
      {/* Back button */}
      {onBack && (
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 13, marginBottom: 20, padding: 0, fontWeight: 500 }}>&larr; Back to proposals</button>
      )}

      {/* Status banners */}
      {proposal.status === 'accepted' && !decided && (
        <div style={{ padding: '10px 16px', background: 'var(--green-light, #f0fdf4)', border: '1px solid var(--green, #22c55e)', borderRadius: 8, marginBottom: 20, fontSize: 13, fontWeight: 600, color: 'var(--green, #22c55e)', textAlign: 'center' as any }}>
          This proposal has been accepted
        </div>
      )}
      {decided && (
        <div style={{ padding: '20px', background: decided === 'accepted' ? 'var(--green-light, #f0fdf4)' : 'var(--red-light, #fef2f2)', border: '1px solid ' + (decided === 'accepted' ? 'var(--green, #22c55e)' : 'var(--red, #dc2626)'), borderRadius: 8, marginBottom: 20, textAlign: 'center' as any }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{decided === 'accepted' ? 'Proposal Accepted' : 'Proposal Declined'}</div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>{decided === 'accepted' ? 'Our team will be in touch shortly.' : 'Thank you for your time.'}</div>
        </div>
      )}

      {/* Inject proposal CSS — design system classes for section content */}
      {proposalCss && <div dangerouslySetInnerHTML={{ __html: proposalCss }} />}

      {/* Continuous scroll — all sections */}
      {sections.map(function (section) {
        if (section.type === 'signature') {
          return (
            <div key={section.key} data-section-key={section.key} style={{ marginBottom: 32, paddingTop: 24, borderTop: '2px solid var(--border)' }}>
              <div style={{
                fontFamily: "'Geist Mono', monospace", fontSize: 9, fontWeight: 600,
                letterSpacing: '0.1em', textTransform: 'uppercase' as any,
                color: 'var(--accent)', marginBottom: 8,
              }}>{section.title}</div>
              <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--foreground)', marginBottom: 20 }}>
                <p>Accepting this proposal is the first step. Upon acceptance:</p>
                <p style={{ margin: '8px 0 4px' }}>1. A Master Service Agreement (MSA) and Sales Order will be generated for formal execution via DocuSeal</p>
                <p style={{ margin: '4px 0' }}>2. Your project lead will schedule a kickoff call within 3 business days</p>
                <p style={{ margin: '4px 0' }}>3. Environment access and team introductions will be arranged</p>
                <p style={{ marginTop: 16, fontSize: 12, color: 'var(--muted)' }}>Questions? Contact <a href="mailto:studios@sprintmode.ai" style={{ color: 'var(--accent)', textDecoration: 'none' }}>studios@sprintmode.ai</a></p>
              </div>
              {!!sigRequired && sigStatus === 'signed' && (
                <div style={{ padding: '16px 20px', background: 'var(--green-light, #f0fdf4)', border: '1px solid var(--green, #22c55e)', borderRadius: 8, color: 'var(--green, #22c55e)', fontWeight: 700 }}>Signed</div>
              )}
              {renderSignature && renderSignature()}
            </div>
          )
        }

        return (
          <div key={section.key} data-section-key={section.key} style={{ marginBottom: 28 }}>
            <div style={{
              fontFamily: "'Geist Mono', monospace", fontSize: 9, fontWeight: 600,
              letterSpacing: '0.1em', textTransform: 'uppercase' as any,
              color: 'var(--accent)', marginBottom: 8,
            }}>{section.title}</div>
            <div
              dangerouslySetInnerHTML={{ __html: section.content || '<p style="color:var(--muted)">This section is being prepared.</p>' }}
              style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--foreground)' }}
            />
          </div>
        )
      })}

      {/* Accept / Decline CTA */}
      {proposal.status !== 'accepted' && proposal.status !== 'declined' && !decided && (onAccept || onDecline) && (
        <div style={{ marginTop: 32, paddingTop: 24, borderTop: '2px solid var(--border)', textAlign: 'center' as any }}>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            {onAccept && (!sigRequired || sigStatus === 'signed') && (
              <button onClick={handleAccept} style={{ padding: '10px 28px', borderRadius: 8, fontSize: 14, fontWeight: 700, background: 'var(--green, #22c55e)', color: '#fff', border: 'none', cursor: 'pointer' }}>Accept proposal</button>
            )}
            {onDecline && (
              <button onClick={function () {
                if (declineStep === 0) { setDeclineStep(1) }
                else { handleDecline() }
              }} style={{ padding: '10px 28px', borderRadius: 8, fontSize: 14, fontWeight: 500, background: 'transparent', color: 'var(--red, #dc2626)', border: '1px solid var(--red, #dc2626)', cursor: 'pointer' }}>
                {declineStep === 0 ? 'Decline' : 'Confirm decline'}
              </button>
            )}
          </div>
          {declineStep === 1 && (
            <div style={{ marginTop: 12 }}>
              <textarea id="sp-decline-reason" placeholder="Please share why you're declining..." autoComplete="off" data-1p-ignore data-lpignore="true" style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', resize: 'vertical' as any, minHeight: 60, background: 'var(--bg-card, #fff)', color: 'var(--foreground)', boxSizing: 'border-box' as any }}></textarea>
            </div>
          )}
        </div>
      )}

      {/* Comment thread */}
      <div style={{ marginTop: 40, paddingTop: 24, borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Comments</div>
        {localComments.length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>No comments yet.</div>
        )}
        {localComments.map(function (c) {
          return (
            <div key={c.id} style={{ marginBottom: 12, padding: '10px 14px', background: c.author_type === 'client' ? 'var(--amber-light, #fffbeb)' : 'var(--bg-1, #f8f9fa)', borderRadius: 8, borderLeft: c.author_type === 'client' ? '3px solid var(--amber, #f59e0b)' : 'none' } as React.CSSProperties}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 } as React.CSSProperties}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{c.author_name || 'Unknown'} {c.author_type === 'client' && <span style={{ fontSize: 10, color: 'var(--amber, #f59e0b)', fontWeight: 700 }}>CLIENT</span>}</span>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>{fmtCommentDate(c.created_at)}</span>
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--foreground)' }}>{c.body}</div>
            </div>
          )
        })}
        {onPostComment && (
          <div style={{ display: 'flex', gap: 8, marginTop: 8 } as React.CSSProperties}>
            <textarea
              value={commentBody}
              onChange={function (e: any) { setCommentBody((e.target as any).value) }}
              placeholder="Add a comment..."
              rows={2}
              autoComplete="off"
              data-1p-ignore
              data-lpignore="true"
              style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', resize: 'vertical' as any, background: 'var(--bg-card, #fff)', color: 'var(--foreground)', boxSizing: 'border-box' as any }}
            ></textarea>
            <button
              onClick={postComment}
              disabled={posting || !commentBody.trim()}
              style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', alignSelf: 'flex-end', opacity: posting || !commentBody.trim() ? 0.5 : 1 }}
            >
              {posting ? 'Sending...' : 'Reply'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
