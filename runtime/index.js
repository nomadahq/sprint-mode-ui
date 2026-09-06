// runtime/index.js
// FEAT-3170 square 1a: single entry point for the per-portal worker
// framework artifact -- import { createAppGate, createApiProxy } from
// '@sprint-mode/sm-ui/runtime'. See runtime/middleware.js and
// runtime/api-proxy.js for the individual behaviors.

export { createAppGate } from './middleware.js'
export { createApiProxy } from './api-proxy.js'
