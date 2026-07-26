// Shared dark mode detection + mark URL utilities.
// Used by Layout, AccountSwitcher, NoAccessScreen, user-menu-standalone, Login.

var SVG_MARK_PRODUCTS = ['admin','studios','signal','mode','hub','privacyai','sprint-mode','sprint-capital','platform','dev','docs','investors','nomada']

export function isDarkMode(): boolean {
  if (typeof document === 'undefined') return false
  var dt = document.documentElement.getAttribute('data-theme')
  if (dt === 'dark') return true
  if (dt === 'light') return false
  return !!(typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
}

export function getDarkMarkUrl(product: string | undefined): string | null {
  if (!product) return null
  if (SVG_MARK_PRODUCTS.indexOf(product) === -1) return null
  return 'https://api.sprintmode.ai/brand/' + product + '-mark-dark.svg?v=4'
}

export function getLightMarkUrl(product: string | undefined): string | null {
  if (!product) return null
  if (SVG_MARK_PRODUCTS.indexOf(product) === -1) return null
  return 'https://api.sprintmode.ai/portals/' + product + '/logo_mark.svg?v=4'
}

// Get the appropriate mark URL (light or dark) for the current mode
export function getThemedMarkUrl(product: string | undefined): string | null {
  if (!product) return null
  if (SVG_MARK_PRODUCTS.indexOf(product) === -1) return null
  return isDarkMode() ? getDarkMarkUrl(product) : getLightMarkUrl(product)
}

// Extract subdomain from a logo_mark_url like:
// https://api.sprintmode.ai/portals/{subdomain}/logo_mark.png
export function subdomainFromMarkUrl(url: string | null | undefined): string | null {
  if (!url) return null
  var m = url.match(/\/portals\/([^/]+)\//)
  return m ? m[1] : null
}

// Get the themed mark URL from a logo_mark_url (convenience)
export function themedMarkFromLogoUrl(logoMarkUrl: string | null | undefined): string | null {
  return getThemedMarkUrl(subdomainFromMarkUrl(logoMarkUrl) || undefined)
}

// Legacy compat
export function darkMarkFromLogoUrl(logoMarkUrl: string | null | undefined): string | null {
  return getDarkMarkUrl(subdomainFromMarkUrl(logoMarkUrl) || undefined)
}
