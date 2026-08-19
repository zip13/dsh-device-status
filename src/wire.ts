/**
 * JSON API wire helpers. Every call requires POST + application/json
 * (CSRF: a cross-site form cannot set that content-type), even reads, so the
 * trust fence and the content-type check share one code path.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'

export type DeviceStatusErrorCode =
  | 'bad-request'
  | 'not-found'
  | 'forbidden'
  | 'method-error'
  | 'internal'

export class DeviceStatusError extends Error {
  constructor(
    readonly code: DeviceStatusErrorCode,
    message: string,
    readonly status = 400,
  ) {
    super(message)
  }
}

const MAX_BODY_BYTES = 1 << 20

export async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of req) {
    const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk
    total += buffer.length
    if (total > MAX_BODY_BYTES) {
      throw new DeviceStatusError('bad-request', 'request body too large')
    }
    chunks.push(buffer)
  }
  const text = Buffer.concat(chunks).toString('utf8')
  if (text.trim() === '') return {}
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new DeviceStatusError('bad-request', 'request body is not valid JSON')
  }
}

export function writeJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(payload)
}

export function writeOk(res: ServerResponse, value: unknown): void {
  writeJson(res, 200, { ok: true, value })
}

export function writeError(res: ServerResponse, error: unknown): void {
  if (error instanceof DeviceStatusError) {
    writeJson(res, error.status, { ok: false, error: { code: error.code, message: error.message } })
    return
  }
  const message = error instanceof Error ? error.message : String(error)
  writeJson(res, 500, { ok: false, error: { code: 'internal', message } })
}

export function requireJsonPost(req: IncomingMessage): void {
  if (req.method !== 'POST') {
    throw new DeviceStatusError('method-error', 'method not allowed', 405)
  }
  const contentType = req.headers['content-type'] ?? ''
  if (!String(contentType).toLowerCase().startsWith('application/json')) {
    throw new DeviceStatusError('method-error', 'unsupported media type', 415)
  }
}
