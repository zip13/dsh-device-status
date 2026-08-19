import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import * as plugin from '../src/index.ts'
import { inject as clientInject } from '../src/client/inject.ts'
import { ERROR_COPY } from '../src/client/api.ts'

describe('plugin export shape', () => {
  it('is a namespace plugin (no default export)', () => {
    expect('default' in plugin).toBe(false)
    expect(plugin.name).toBe('dsh-device-status')
    expect(plugin.inject).toEqual(['webServer', 'loader'])
    expect(typeof plugin.apply).toBe('function')
  })

  it('keeps the client inactive without betterSidebar', () => {
    expect(clientInject).toEqual(['betterSidebar'])
  })

  it('does not register a model-facing tool', () => {
    const manifest = JSON.parse(readFileSync(new URL('../dsh.plugin.json', import.meta.url), 'utf8')) as {
      contributes: { tools: unknown[] }
    }
    expect(manifest.contributes.tools).toEqual([])
  })

  it('has copy for the wire error codes', () => {
    expect(ERROR_COPY['forbidden']).toBeTruthy()
    expect(ERROR_COPY['method-error']).toBeTruthy()
    expect(ERROR_COPY['network']).toBeTruthy()
  })
})
