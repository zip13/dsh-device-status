import { describe, expect, it } from 'vitest'
import { isLoopbackHostname, isTrustedApiRequest } from '../src/index.ts'

function request(headers: Record<string, string>): Parameters<typeof isTrustedApiRequest>[0] {
  return { headers } as Parameters<typeof isTrustedApiRequest>[0]
}

describe('isLoopbackHostname', () => {
  it('accepts localhost and 127/8', () => {
    expect(isLoopbackHostname('localhost')).toBe(true)
    expect(isLoopbackHostname('[::1]')).toBe(true)
    expect(isLoopbackHostname('127.0.0.1')).toBe(true)
    expect(isLoopbackHostname('127.1.2.3')).toBe(true)
  })

  it('rejects public names and look-alikes', () => {
    expect(isLoopbackHostname('example.com')).toBe(false)
    expect(isLoopbackHostname('128.0.0.1')).toBe(false)
    expect(isLoopbackHostname('127.0.0.1.evil.com')).toBe(false)
  })
})

describe('isTrustedApiRequest', () => {
  it('rejects a missing Host header', () => {
    expect(isTrustedApiRequest(request({}), [])).toBe(false)
  })

  it('accepts loopback hosts', () => {
    expect(isTrustedApiRequest(request({ host: '127.0.0.1:3080' }), [])).toBe(true)
    expect(isTrustedApiRequest(request({ host: 'localhost:3080' }), [])).toBe(true)
  })

  it('rejects unknown public hosts', () => {
    expect(isTrustedApiRequest(request({ host: 'evil.com' }), [])).toBe(false)
  })

  it('accepts configured trusted authorities', () => {
    expect(isTrustedApiRequest(request({ host: 'dsh.internal:8443' }), ['dsh.internal:8443'])).toBe(true)
    expect(isTrustedApiRequest(request({ host: 'dsh.internal:9000' }), ['dsh.internal:8443'])).toBe(false)
  })

  it('rejects cross-site browser markers', () => {
    expect(isTrustedApiRequest(request({ host: '127.0.0.1:3080', 'sec-fetch-site': 'cross-site' }), [])).toBe(false)
  })

  it('rejects a mismatched Origin', () => {
    expect(isTrustedApiRequest(
      request({ host: '127.0.0.1:3080', origin: 'http://evil.com' }),
      [],
    )).toBe(false)
    expect(isTrustedApiRequest(
      request({ host: '127.0.0.1:3080', origin: 'http://127.0.0.1:3080' }),
      [],
    )).toBe(true)
  })
})
