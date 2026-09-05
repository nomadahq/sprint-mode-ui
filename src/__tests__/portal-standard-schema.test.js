// @vitest-environment node
//
// Validates portal-standard.json against portal-standard.schema.json.
// This is a small hand-written validator covering the subset of JSON Schema
// keywords the standard's schema actually uses -- no runtime dependency
// (ajv or similar) is added for it.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const standard = JSON.parse(readFileSync(new URL('../../portal-standard.json', import.meta.url), 'utf8'))
const schema = JSON.parse(readFileSync(new URL('../../portal-standard.schema.json', import.meta.url), 'utf8'))

function typeOf(value) {
  if (Array.isArray(value)) return 'array'
  if (value === null) return 'null'
  return typeof value
}

// Returns a list of human-readable error strings; empty means valid.
function validate(node, value, path = '$') {
  const errors = []
  if (!node || typeof node !== 'object') return errors

  if (node.type) {
    const actual = typeOf(value)
    const expectedType = node.type === 'integer' ? 'number' : node.type
    if (expectedType !== actual || (node.type === 'integer' && !Number.isInteger(value))) {
      errors.push(`${path}: expected type ${node.type}, got ${actual}`)
      return errors
    }
  }

  if (node.enum && !node.enum.includes(value)) {
    errors.push(`${path}: ${JSON.stringify(value)} is not one of ${JSON.stringify(node.enum)}`)
  }

  if (typeof value === 'string') {
    if (node.pattern && !new RegExp(node.pattern).test(value)) {
      errors.push(`${path}: "${value}" does not match pattern ${node.pattern}`)
    }
    if (typeof node.minLength === 'number' && value.length < node.minLength) {
      errors.push(`${path}: shorter than minLength ${node.minLength}`)
    }
  }

  if (typeof value === 'number') {
    if (typeof node.minimum === 'number' && value < node.minimum) errors.push(`${path}: below minimum ${node.minimum}`)
    if (typeof node.maximum === 'number' && value > node.maximum) errors.push(`${path}: above maximum ${node.maximum}`)
  }

  if (Array.isArray(value)) {
    if (typeof node.minItems === 'number' && value.length < node.minItems) {
      errors.push(`${path}: has ${value.length} items, fewer than minItems ${node.minItems}`)
    }
    if (typeof node.maxItems === 'number' && value.length > node.maxItems) {
      errors.push(`${path}: has ${value.length} items, more than maxItems ${node.maxItems}`)
    }
    if (node.uniqueItems) {
      const seen = new Set()
      value.forEach((item, i) => {
        const key = JSON.stringify(item)
        if (seen.has(key)) errors.push(`${path}[${i}]: duplicate item ${key}`)
        seen.add(key)
      })
    }
    if (node.items) {
      value.forEach((item, i) => errors.push(...validate(node.items, item, `${path}[${i}]`)))
    }
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const req of node.required || []) {
      if (!(req in value)) errors.push(`${path}: missing required property "${req}"`)
    }
    if (node.additionalProperties === false) {
      const allowed = new Set(Object.keys(node.properties || {}))
      for (const key of Object.keys(value)) {
        if (!allowed.has(key)) errors.push(`${path}: unexpected property "${key}"`)
      }
    }
    for (const [key, propSchema] of Object.entries(node.properties || {})) {
      if (key in value) errors.push(...validate(propSchema, value[key], `${path}.${key}`))
    }
  }

  return errors
}

describe('portal-standard.json validates against portal-standard.schema.json', () => {
  it('has no schema violations', () => {
    const errors = validate(schema, standard)
    expect(errors).toEqual([])
  })

  it('carries exactly 29 checks with ids 1..29 and unique keys', () => {
    expect(standard.checks).toHaveLength(29)
    expect(standard.checks.map((c) => c.id)).toEqual(Array.from({ length: 29 }, (_, i) => i + 1))
    expect(new Set(standard.checks.map((c) => c.key)).size).toBe(29)
  })

  it('marks only checks 2, 14 and 29 as a_warns_only, per the approved lines', () => {
    const warnOnly = standard.checks.filter((c) => c.a_warns_only).map((c) => c.id)
    expect(warnOnly).toEqual([2, 14, 29])
  })

  it('every gates entry is a non-empty subset of A, N, S', () => {
    for (const check of standard.checks) {
      expect(check.gates.length).toBeGreaterThan(0)
      for (const gate of check.gates) {
        expect(['A', 'N', 'S']).toContain(gate)
      }
    }
  })
})
