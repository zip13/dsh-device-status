import { describe, expect, it } from 'vitest'
import { apply, API_PREFIX } from '../src/index.ts'
import type { Context } from '../src/context-types.ts'

function fakeCtx() {
  const routes: Array<{ path: string; handler: (req: unknown, res: unknown) => Promise<void> }> = []
  const ctx = {
    loader: { entries: () => [] },
    webServer: {
      register: (route: { path: string; handler: (req: unknown, res: unknown) => Promise<void> }) => {
        routes.push(route)
        return () => {}
      },
    },
    effect: (fn: () => unknown) => fn(),
  }
  apply(ctx as unknown as Context)
  return {
    routes,
    handler: routes[0]?.handler,
  }
}

function fakeReq({
  method = 'POST',
  contentType = 'application/json',
  body = '{}',
  url = `${API_PREFIX}/system`,
  host = '127.0.0.1:8080',
}: {
  method?: string
  contentType?: string | undefined
  body?: string
  url?: string
  host?: string | undefined
} = {}) {
  const headers: Record<string, string> = {}
  if (host !== undefined) headers.host = host
  if (contentType !== undefined) headers['content-type'] = contentType
  return {
    method,
    headers,
    url,
    async *[Symbol.asyncIterator]() {
      yield body
    },
  }
}

function fakeRes() {
  return {
    status: 0,
    payload: '',
    writeHead(status: number) { this.status = status },
    end(payload: string) { this.payload = payload },
  }
}

describe('device-status routes', () => {
  it('GET is 405', async () => {
    const res = fakeRes()
    await fakeCtx().handler?.(fakeReq({ method: 'GET' }), res)
    expect(res.status).toBe(405)
    expect(JSON.parse(res.payload).error.code).toBe('method-error')
  })

  it('rejects non-JSON content-type (CSRF)', async () => {
    const res = fakeRes()
    await fakeCtx().handler?.(fakeReq({ contentType: 'text/plain' }), res)
    expect(res.status).toBe(415)
  })

  it('rejects a missing Host (trust fence)', async () => {
    const req = {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      url: `${API_PREFIX}/system`,
      async *[Symbol.asyncIterator]() { yield '{}' },
    }
    const res = fakeRes()
    await fakeCtx().handler?.(req, res)
    expect(res.status).toBe(403)
    expect(JSON.parse(res.payload).error.code).toBe('forbidden')
  })

  it('rejects a cross-site marker (trust fence)', async () => {
    const req = fakeReq()
    req.headers['sec-fetch-site'] = 'cross-site'
    const res = fakeRes()
    await fakeCtx().handler?.(req, res)
    expect(res.status).toBe(403)
  })

  it('unknown method is 404', async () => {
    const res = fakeRes()
    await fakeCtx().handler?.(fakeReq({ url: `${API_PREFIX}/nope` }), res)
    expect(res.status).toBe(404)
    expect(JSON.parse(res.payload).error.code).toBe('not-found')
  })

  it('ping answers pong', async () => {
    const res = fakeRes()
    await fakeCtx().handler?.(fakeReq({ url: `${API_PREFIX}/ping` }), res)
    expect(res.status).toBe(200)
    expect(JSON.parse(res.payload)).toEqual({ ok: true, value: { pong: true } })
  })

  it('system returns host status', async () => {
    const res = fakeRes()
    await fakeCtx().handler?.(fakeReq({ url: `${API_PREFIX}/system` }), res)
    expect(res.status).toBe(200)
    const body = JSON.parse(res.payload) as {
      ok: boolean
      value: {
        hostname: string
        cpu: { cores: number; usagePercent: number | null }
        memory: { totalBytes: number }
        disks: unknown[]
      }
    }
    expect(body.ok).toBe(true)
    expect(body.value.hostname.length).toBeGreaterThan(0)
    expect(body.value.cpu.cores).toBeGreaterThan(0)
    expect(body.value.memory.totalBytes).toBeGreaterThan(0)
    expect(Array.isArray(body.value.disks)).toBe(true)
  })

  it('registers exactly one prefix route, disposable via effect', () => {
    const { routes } = fakeCtx()
    expect(routes.length).toBe(1)
    expect(routes[0]?.path).toBe(API_PREFIX)
  })
})
