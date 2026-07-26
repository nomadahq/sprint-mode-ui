// Shared dark mode detection + dark mark URL utilities.
// Used by Layout, AccountSwitcher, NoAccessScreen, user-menu-standalone.

var DARK_MARK_PRODUCTS = ['admin','studios','signal','mode','hub','privacyai','sprint-mode','sprint-capital','platform','dev','docs','investors','nomada','safeshepherd']

export function isDarkMode(): boolean {
  if (typeof document === 'undefined') return false
  var dt = document.documentElement.getAttribute('data-theme')
  if (dt === 'dark') return true
  if (dt === 'light') return false
  return !!(typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
}

export function getDarkMarkUrl(product: string | undefined): string | null {
  if (!product) return null
  if (DARK_MARK_PRODUCTS.indexOf(product) === -1) return null
  return 'https://api.sprintmode.ai/brand/' + product + '-mark-dark.svg'
}

// Extract subdomain from a logo_mark_url like:
// https://api.sprintmode.ai/portals/{subdomain}/logo_mark.png
export function subdomainFromMarkUrl(url: string | null | undefined): string | null {
  if (!url) return null
  var m = url.match(/\/portals\/([^/]+)\//)
  return m ? m[1] : null
}

// Get the dark mark URL from a logo_mark_url (convenience)
export function darkMarkFromLogoUrl(logoMarkUrl: string | null | undefined): string | null {
  return getDarkMarkUrl(subdomainFromMarkUrl(logoMarkUrl) || undefined)
}
