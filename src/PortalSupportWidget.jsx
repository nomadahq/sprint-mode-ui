// src/PortalSupportWidget.jsx
// Shared support widget — chat (AI-powered) + ticket form + ticket history.
// COMMS-UNIFY-1d Phase 8.
//
// Usage:
//   import { PortalSupportWidget } from '@nomadahq/sm-ui'
//   <PortalSupportWidget subdomain="studios" apiBase="" />
//
// Two modes based on portal_configs.chatbot:
//   chatbot=1 → Chat tab (AI + escalation link) + My Tickets tab
//   chatbot=0 → New Ticket tab + My Tickets tab
//
// Debug trace: shown on AI responses for admin users or when ?debug=1 is in URL.

import React, { useState, useEffect, useRef } from 'react'

// ── Icons ─────────────────────────────────────────────────────────────────────

function ChatIcon() {
  return React.createElement('svg', { width:20, height:20, viewBox:'0 0 24 24', fill:'none', stroke:'currentColor', strokeWidth:2, strokeLinecap:'round', strokeLinejoin:'round', 'aria-hidden':'true' },
    React.createElement('path', { d:'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' })
  )
}

function CloseIcon() {
  return React.createElement('svg', { width:18, height:18, viewBox:'0 0 24 24', fill:'none', stroke:'currentColor', strokeWidth:2, strokeLinecap:'round', strokeLinejoin:'round', 'aria-hidden':'true' },
    React.createElement('line', { x1:18, y1:6, x2:6, y2:18 }),
    React.createElement('line', { x1:6, y1:6, x2:18, y2:18 })
  )
}

function SendIcon() {
  return React.createElement('svg', { width:16, height:16, viewBox:'0 0 24 24', fill:'none', stroke:'currentColor', strokeWidth:2, strokeLinecap:'round', strokeLinejoin:'round', 'aria-hidden':'true' },
    React.createElement('line', { x1:22, y1:2, x2:11, y2:13 }),
    React.createElement('polygon', { points:'22 2 15 22 11 13 2 9 22 2' })
  )
}

function TicketIcon() {
  return React.createElement('svg', { width:14, height:14, viewBox:'0 0 24 24', fill:'none', stroke:'currentColor', strokeWidth:2, strokeLinecap:'round', strokeLinejoin:'round', 'aria-hidden':'true' },
    React.createElement('path', { d:'M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z' })
  )
}

function BugIcon() {
  return React.createElement('svg', { width:11, height:11, viewBox:'0 0 24 24', fill:'none', stroke:'currentColor', strokeWidth:2, strokeLinecap:'round', strokeLinejoin:'round', 'aria-hidden':'true' },
    React.createElement('rect', { x:8, y:2, width:8, height:4, rx:1, ry:1 }),
    React.createElement('path', { d:'M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2' })
  )
}

// ── Styles (inline, no external CSS needed) ──────────────────────────────────

var Z = 999990
var s = {
  fab: { position:'fixed', bottom:20, right:20, width:52, height:52, borderRadius:'50%', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', zIndex:Z, boxShadow:'0 2px 12px rgba(0,0,0,.18)', transition:'transform .2s' },
  panel: { position:'fixed', bottom:80, right:20, width:340, maxHeight:'70vh', borderRadius:12, overflow:'hidden', zIndex:Z, boxShadow:'0 4px 24px rgba(0,0,0,.15)', display:'flex', flexDirection:'column' },
  hdr: { padding:'10px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:'1px solid var(--border, #e5e7eb)' },
  tabs: { display:'flex', borderBottom:'1px solid var(--border, #e5e7eb)' },
  tab: { flex:1, padding:'8px 0', fontSize:12, fontWeight:500, textAlign:'center', cursor:'pointer', border:'none', background:'none', fontFamily:'inherit', borderBottom:'2px solid transparent' },
  tabActive: { borderBottomColor:'var(--accent, #2362ea)', color:'var(--text-1, #111)' },
  tabInactive: { color:'var(--text-3, #999)' },
  body: { flex:1, overflowY:'auto', minHeight:160 },
  msgAi: { padding:'7px 10px', borderRadius:10, fontSize:12, maxWidth:'85%', lineHeight:1.4, background:'var(--bg-2, #f3f4f6)', color:'var(--text-1, #111)', alignSelf:'flex-start', position:'relative' },
  msgUser: { padding:'7px 10px', borderRadius:10, fontSize:12, maxWidth:'85%', lineHeight:1.4, background:'var(--accent, #2362ea)', color:'#fff', alignSelf:'flex-end' },
  inputBar: { padding:'8px 10px', borderTop:'1px solid var(--border, #e5e7eb)', display:'flex', gap:6, alignItems:'center' },
  input: { flex:1, border:'1px solid var(--border, #e5e7eb)', borderRadius:16, padding:'6px 12px', fontSize:12, background:'var(--bg-1, #fff)', color:'var(--text-1, #111)', fontFamily:'inherit', outline:'none' },
  sendBtn: { width:28, height:28, borderRadius:'50%', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' },
  traceBtn: { background:'none', border:'1px solid var(--border, #e5e7eb)', borderRadius:4, padding:'1px 5px', fontSize:9, cursor:'pointer', color:'var(--text-3, #999)', fontFamily:'inherit', display:'inline-flex', alignItems:'center', gap:3 },
  label: { fontSize:12, fontWeight:500, display:'block', marginBottom:4, marginTop:10 },
  fieldInput: { width:'100%', border:'1px solid var(--border, #e5e7eb)', borderRadius:6, padding:'7px 10px', fontSize:12, fontFamily:'inherit', boxSizing:'border-box' },
}

// ── Widget ────────────────────────────────────────────────────────────────────

export function PortalSupportWidget(props) {
  var subdomain = props.subdomain || ''
  var apiBase = props.apiBase || ''
  var brandColor = props.brandColor || 'var(--accent, #2362ea)'

  var _open = useState(false); var open = _open[0]; var setOpen = _open[1]
  var _tab = useState('chat'); var tab = _tab[0]; var setTab = _tab[1]

  // Programmatic open: window.dispatchEvent(new CustomEvent('sm-support:open',
  // { detail: { tab: 'chat' | 'tickets' | 'form' } })) — lets portal pages
  // (e.g. Signal Connect support card) open the built widget instead of
  // duplicating ticket UI.
  useEffect(function() {
    function onOpen(e) {
      setOpen(true)
      var t = e && e.detail && e.detail.tab
      if (t) { setTab(t); if (t === 'tickets') loadTickets() }
    }
    window.addEventListener('sm-support:open', onOpen)
    return function() { window.removeEventListener('sm-support:open', onOpen) }
  }, [])
  var _chatEnabled = useState(null); var chatEnabled = _chatEnabled[0]; var setChatEnabled = _chatEnabled[1]
  var _messages = useState([]); var messages = _messages[0]; var setMessages = _messages[1]
  var _input = useState(''); var input = _input[0]; var setInput = _input[1]
  var _sending = useState(false); var sending = _sending[0]; var setSending = _sending[1]
  var _tickets = useState([]); var tickets = _tickets[0]; var setTickets = _tickets[1]
  var _ticketsLoading = useState(false); var ticketsLoading = _ticketsLoading[0]; var setTicketsLoading = _ticketsLoading[1]
  var _showTicketForm = useState(false); var _showTicketFormVal = _showTicketForm[0]; var setShowTicketForm = _showTicketForm[1]
  var _ticketSubject = useState(''); var ticketSubject = _ticketSubject[0]; var setTicketSubject = _ticketSubject[1]
  var _ticketBody = useState(''); var ticketBody = _ticketBody[0]; var setTicketBody = _ticketBody[1]
  var _ticketSending = useState(false); var ticketSending = _ticketSending[0]; var setTicketSending = _ticketSending[1]
  var messagesEndRef = useRef(null)

  var isDebug = typeof window !== 'undefined' && window.location.search.indexOf('debug=1') !== -1

  // Load config
  useEffect(function() {
    fetch(apiBase + '/api/portals/' + subdomain + '/config', { credentials: 'include' })
      .then(function(r) { return r.ok ? r.json() : null })
      .then(function(d) {
        if (d && d.ok !== false) {
          var cfg = d.data || d
          setChatEnabled(cfg.chatbot === 1 || cfg.chatbot === true)
          if (!(cfg.chatbot === 1 || cfg.chatbot === true)) setTab('form')
        }
      })
      .catch(function() { setChatEnabled(false); setTab('form') })
  }, [subdomain, apiBase])

  // Load welcome message
  useEffect(function() {
    if (chatEnabled && messages.length === 0) {
      setMessages([{ role: 'assistant', content: 'Hi! How can I help you today?', id: 'welcome' }])
    }
  }, [chatEnabled])

  // Scroll to bottom on new messages
  useEffect(function() {
    if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Load tickets when tab switches
  function loadTickets() {
    setTicketsLoading(true)
    fetch(apiBase + '/api/portals/' + subdomain + '/support/threads', { credentials: 'include' })
      .then(function(r) { return r.ok ? r.json() : null })
      .then(function(d) {
        if (d && d.ok) setTickets(d.data || [])
      })
      .catch(function() {})
      .finally(function() { setTicketsLoading(false) })
  }

  function handleTabChange(t) {
    setTab(t)
    if (t === 'tickets') loadTickets()
  }

  // Send chat message
  function sendMessage() {
    if (!input.trim() || sending) return
    var userMsg = { role: 'user', content: input.trim(), id: 'u_' + Date.now() }
    var updatedMessages = messages.concat([userMsg])
    setMessages(updatedMessages)
    setInput('')
    setSending(true)

    var chatMessages = updatedMessages
      .filter(function(m) { return m.id !== 'welcome' })
      .map(function(m) { return { role: m.role, content: m.content } })

    var url = apiBase + '/api/portals/' + subdomain + '/chat' + (isDebug ? '?debug=1' : '')
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ messages: chatMessages }),
    })
      .then(function(r) { return r.json() })
      .then(function(d) {
        if (d.ok) {
          var aiMsg = { role: 'assistant', content: d.message, id: 'a_' + Date.now() }
          if (d._debug) aiMsg._debug = d._debug
          setMessages(function(prev) { return prev.concat([aiMsg]) })
        } else {
          setMessages(function(prev) { return prev.concat([{ role: 'assistant', content: d.error || 'Sorry, something went wrong.', id: 'err_' + Date.now() }]) })
        }
      })
      .catch(function() {
        setMessages(function(prev) { return prev.concat([{ role: 'assistant', content: 'Connection error. Please try again.', id: 'err_' + Date.now() }]) })
      })
      .finally(function() { setSending(false) })
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // Submit ticket
  function submitTicket() {
    if (!ticketSubject.trim()) return
    setTicketSending(true)
    fetch(apiBase + '/api/portals/' + subdomain + '/support/thread', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ subject: ticketSubject.trim(), message: ticketBody.trim(), category: 'general' }),
    })
      .then(function(r) { return r.json() })
      .then(function(d) {
        if (d.ok) {
          setTicketSubject('')
          setTicketBody('')
          setShowTicketForm(false)
          handleTabChange('tickets')
        } else {
          alert('Failed: ' + (d.error || 'Unknown error'))
        }
      })
      .catch(function() { alert('Connection error') })
      .finally(function() { setTicketSending(false) })
  }

  // Copy debug trace
  function copyDebug(debugData) {
    if (!debugData) return
    var text = Object.entries(debugData).map(function(e) { return e[0] + ': ' + JSON.stringify(e[1]) }).join('\n')
    navigator.clipboard.writeText(text).catch(function() {})
  }

  if (chatEnabled === null) return null // still loading config

  var bg = 'var(--bg-1, #fff)'
  var text1 = 'var(--text-1, #111)'

  // ── Render ──

  // FAB button
  var fab = React.createElement('button', {
    onClick: function() { setOpen(!open) },
    style: Object.assign({}, s.fab, { background: brandColor, color: '#fff', transform: open ? 'scale(0.9)' : 'scale(1)' }),
    'aria-label': open ? 'Close support' : 'Open support',
  }, open ? React.createElement(CloseIcon) : React.createElement(ChatIcon))

  if (!open) return fab

  // Panel
  return React.createElement(React.Fragment, null,
    fab,
    React.createElement('div', { style: Object.assign({}, s.panel, { background: bg, color: text1 }) },

      // Header
      React.createElement('div', { style: s.hdr },
        React.createElement('span', { style: { fontSize:13, fontWeight:500 } },
          chatEnabled ? 'Support' : 'Contact support'
        ),
        React.createElement('button', {
          onClick: function() { setOpen(false) },
          style: { background:'none', border:'none', cursor:'pointer', color:'var(--text-3, #999)', padding:2 },
          'aria-label': 'Close',
        }, React.createElement(CloseIcon))
      ),

      // Tabs
      React.createElement('div', { style: s.tabs },
        chatEnabled && React.createElement('button', {
          style: Object.assign({}, s.tab, tab === 'chat' ? s.tabActive : s.tabInactive),
          onClick: function() { handleTabChange('chat') },
        }, 'Chat'),
        !chatEnabled && React.createElement('button', {
          style: Object.assign({}, s.tab, tab === 'form' ? s.tabActive : s.tabInactive),
          onClick: function() { handleTabChange('form') },
        }, 'New ticket'),
        React.createElement('button', {
          style: Object.assign({}, s.tab, tab === 'tickets' ? s.tabActive : s.tabInactive),
          onClick: function() { handleTabChange('tickets') },
        }, React.createElement(TicketIcon), ' My tickets')
      ),

      // Tab content
      React.createElement('div', { style: s.body },

        // Chat tab
        tab === 'chat' && React.createElement('div', { style: { display:'flex', flexDirection:'column', height:'100%' } },
          React.createElement('div', { style: { flex:1, padding:'10px 12px', display:'flex', flexDirection:'column', gap:8, overflowY:'auto', minHeight:160 } },
            messages.map(function(msg) {
              var isAi = msg.role === 'assistant'
              return React.createElement('div', { key: msg.id, style: { display:'flex', flexDirection:'column' } },
                React.createElement('div', { style: isAi ? s.msgAi : s.msgUser }, msg.content),
                // Debug trace on AI messages
                isAi && msg._debug && isDebug && React.createElement('div', { style: { alignSelf:'flex-start', marginTop:2, display:'flex', gap:4 } },
                  React.createElement('button', {
                    style: s.traceBtn,
                    onClick: function() { copyDebug(msg._debug) },
                  }, React.createElement(BugIcon), ' Copy trace')
                )
              )
            }),
            sending && React.createElement('div', { style: Object.assign({}, s.msgAi, { opacity:.6 }) }, 'Typing...'),
            React.createElement('div', { ref: messagesEndRef })
          ),
          // Escalation link
          React.createElement('div', {
            style: { textAlign:'center', padding:'4px 0', fontSize:11, cursor:'pointer', color:'var(--accent, #2362ea)' },
            onClick: function() { setShowTicketForm(true); setTab('form') },
          }, 'Need human help? Submit a ticket'),
          // Input bar
          React.createElement('div', { style: s.inputBar },
            React.createElement('input', {
              style: s.input,
              placeholder: 'Ask a question...',
              value: input,
              onChange: function(e) { setInput(e.target.value) },
              onKeyDown: handleKeyDown,
              disabled: sending,
            }),
            React.createElement('button', {
              style: Object.assign({}, s.sendBtn, { background: brandColor, color:'#fff', opacity: sending || !input.trim() ? .5 : 1 }),
              onClick: sendMessage,
              disabled: sending || !input.trim(),
              'aria-label': 'Send',
            }, React.createElement(SendIcon))
          )
        ),

        // Ticket form tab
        tab === 'form' && React.createElement('div', { style: { padding:14 } },
          React.createElement('label', { style: Object.assign({}, s.label, { marginTop:0 }) }, 'Subject'),
          React.createElement('input', {
            style: s.fieldInput,
            placeholder: 'Brief description',
            value: ticketSubject,
            onChange: function(e) { setTicketSubject(e.target.value) },
          }),
          React.createElement('label', { style: s.label }, 'Description'),
          React.createElement('textarea', {
            style: Object.assign({}, s.fieldInput, { height:72, resize:'vertical' }),
            placeholder: 'Tell us what\'s going on...',
            value: ticketBody,
            onChange: function(e) { setTicketBody(e.target.value) },
          }),
          React.createElement('button', {
            onClick: submitTicket,
            disabled: ticketSending || !ticketSubject.trim(),
            style: { marginTop:12, width:'100%', padding:8, borderRadius:6, border:'none', background: brandColor, color:'#fff', fontSize:13, fontWeight:500, cursor:'pointer', fontFamily:'inherit', opacity: ticketSending || !ticketSubject.trim() ? .5 : 1 },
          }, ticketSending ? 'Submitting...' : 'Submit ticket')
        ),

        // Tickets tab
        tab === 'tickets' && React.createElement('div', null,
          ticketsLoading
            ? React.createElement('div', { style: { padding:20, textAlign:'center', fontSize:12, color:'var(--text-3, #999)' } }, 'Loading...')
            : tickets.length === 0
              ? React.createElement('div', { style: { padding:20, textAlign:'center', fontSize:12, color:'var(--text-3, #999)' } }, 'No tickets yet')
              : tickets.map(function(t) {
                  return React.createElement('div', {
                    key: t.id,
                    style: { padding:'8px 12px', borderBottom:'1px solid var(--border, #e5e7eb)', fontSize:12, cursor:'pointer' },
                  },
                    React.createElement('div', { style: { fontWeight:500, color: text1, marginBottom:2 } }, t.subject || t.purpose || 'Support request'),
                    React.createElement('div', { style: { fontSize:11, color:'var(--text-3, #999)', display:'flex', gap:6, alignItems:'center' } },
                      React.createElement('span', {
                        style: { padding:'1px 6px', borderRadius:8, fontSize:9, fontWeight:600, textTransform:'uppercase',
                          background: t.status === 'resolved' ? 'var(--green-soft, #eaf3de)' : 'var(--accent-soft, #e6f1fb)',
                          color: t.status === 'resolved' ? 'var(--green, #27500a)' : 'var(--accent, #175cd3)',
                        },
                      }, t.status || 'open'),
                      t.updated_at && React.createElement('span', null, new Date(t.updated_at).toLocaleDateString())
                    )
                  )
                }),
          React.createElement('div', { style: { padding:'8px 12px', textAlign:'center' } },
            React.createElement('button', {
              onClick: function() { setTab(chatEnabled ? 'chat' : 'form'); setShowTicketForm(true) },
              style: { background:'none', border:'none', cursor:'pointer', fontSize:11, color:'var(--accent, #2362ea)', fontFamily:'inherit' },
            }, '+ New ticket')
          )
        )
      )
    )
  )
}
