// src/PortalSupportWidget.tsx
// Typed re-export — delegates to PortalSupportWidget.jsx implementation.

import React from 'react'
// @ts-ignore — .jsx source file, types declared below
import { PortalSupportWidget as _Impl } from './PortalSupportWidget.jsx'

export interface PortalSupportWidgetProps {
  subdomain: string
  apiBase?: string
  brandColor?: string
  /** Suppress the floating launcher; panel opens only via the sm-support:open event. */
  hideLauncher?: boolean
  /** Render inner contents only (tabs + body, no fab/panel/header) for hosting inside another shell. */
  embedded?: boolean
  /** Tab to start on ('chat' | 'tickets' | 'form'). */
  initialTab?: string
}

export const PortalSupportWidget: React.FC<PortalSupportWidgetProps> = _Impl
