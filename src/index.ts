/**
 * dsh-device-status host half: fenced, read-only JSON API for host machine
 * status (CPU / memory / disk / network / uptime). No model-facing tool —
 * this is a human-view sidebar tab; the agent does not need it.
 */
import type { Context } from './context-types.ts'
import {
  collectSystemStatus,
  computeCpuUsagePercent,
  snapshotCpuTimes,
} from './system.ts'
import { isTrustedApiRequest } from './trust-fence.ts'
import {
  DeviceStatusError,
  readJsonBody,
  requireJsonPost,
  writeError,
  writeJson,
  writeOk,
} from './wire.ts'

export { name } from './identity.ts'
export const inject = ['webServer', 'loader']

export const API_PREFIX = '/device-status/api'

export {
  collectDisks,
  collectNetwork,
  collectSystemStatus,
  computeCpuUsagePercent,
  snapshotCpuTimes,
} from './system.ts'
export type {
  CpuTimesSnapshot,
  DiskStatus,
  NetworkEntry,
  SystemStatus,
} from './system.ts'
export { isLoopbackHostname, isTrustedApiRequest } from './trust-fence.ts'

function trustedHostsOf(ctx: Context): string[] {
  for (const entry of ctx.loader.entries()) {
    if (entry.options.name === 'connection') {
      const config = entry.options.config
      return config?.trustedHosts ?? []
    }
  }
  return []
}

const FIRST_SAMPLE_WINDOW_MS = 150

type ApiMethod = (ctx: Context, payload: unknown) => Promise<unknown> | unknown

function buildApi(): Record<string, ApiMethod> {
  // CPU usage is a delta between two counter snapshots. The baseline is taken
  // at plugin load; each query reports the average since the previous query.
  // A first query right after load (counters unmoved) falls back to a short
  // measurement window so the panel never shows a fake 0%.
  let previous = snapshotCpuTimes()
  const nextUsage = async (): Promise<number | null> => {
    const next = snapshotCpuTimes()
    const usage = computeCpuUsagePercent(previous, next)
    previous = next
    if (usage !== null) return usage
    await new Promise(resolve => setTimeout(resolve, FIRST_SAMPLE_WINDOW_MS))
    const again = snapshotCpuTimes()
    const retry = computeCpuUsagePercent(next, again)
    previous = again
    return retry
  }
  return {
    system: async () => collectSystemStatus(await nextUsage()),
    ping: () => ({ pong: true }),
  }
}

export function apply(ctx: Context): void {
  const api = buildApi()
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: API_PREFIX,
    handler: async (req, res) => {
      if (!isTrustedApiRequest(req, trustedHostsOf(ctx))) {
        writeJson(res, 403, { ok: false, error: { code: 'forbidden', message: 'forbidden' } })
        return
      }
      try {
        requireJsonPost(req)
        const pathname = new URL(req.url ?? '/', 'http://dsh.internal').pathname
        const method = pathname.startsWith(`${API_PREFIX}/`) ? pathname.slice(`${API_PREFIX}/`.length) : undefined
        if (method === undefined || method.includes('/')) {
          throw new DeviceStatusError('not-found', 'unknown device-status API method', 404)
        }
        const payload = await readJsonBody(req)
        const handler = api[method]
        if (handler === undefined) {
          throw new DeviceStatusError('not-found', `unknown device-status API method "${method}"`, 404)
        }
        writeOk(res, await handler(ctx, payload))
      } catch (error) {
        writeError(res, error)
      }
    },
  }), 'dsh-device-status: /device-status/api routes')
}
