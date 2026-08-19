// Global compile-time constants injected by consumer vite configs (define:{}).
// The library itself does not define __BUILD_ID__ — consumers do via their
// stamp-version plugin. The typeof guard in useDeployRefresh handles the case
// where a consumer hasn't added the plugin yet (returns null, hook is no-op).
declare var __BUILD_ID__: string | undefined
