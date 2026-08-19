/**
 * Typed fetch wrapper over `/device-status/api`. Reads always POST JSON
 * (CSRF content-type), same as the host expects.
 */
export class DeviceStatusApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

export interface DiskStatus {
  mount: string
  totalBytes: number
  freeBytes: number
  usedPercent: number
}

export interface NetworkEntry {
  name: string
  addresses: string[]
}

export interface SystemStatus {
  hostname: string
  platform: string
  arch: string
  osType: string
  osRelease: string
  uptimeSeconds: number
  loadAverage: number[]
  cpu: {
    model: string
    cores: number
    usagePercent: number | null
  }
  memory: {
    totalBytes: number
    freeBytes: number
    usedBytes: number
    usedPercent: number
  }
  disks: DiskStatus[]
  network: NetworkEntry[]
  process: {
    pid: number
    nodeVersion: string
    uptimeSeconds: number
    rssBytes: number
  }
  collectedAt: string
}

async function call<T>(method: string, payload: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/device-status/api/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    })
  } catch (error) {
    throw new DeviceStatusApiError('network', error instanceof Error ? error.message : String(error))
  }
  const parsed: { ok?: boolean; value?: unknown; error?: { code?: string; message?: string } } | null
    = await response.json().catch(() => null)
  if (!response.ok || parsed === null || parsed.ok !== true || parsed.value === undefined) {
    throw new DeviceStatusApiError(
      parsed?.error?.code ?? 'http',
      parsed?.error?.message ?? `HTTP ${response.status}`,
    )
  }
  return parsed.value as T
}

export const deviceStatusApi = {
  system: (signal?: AbortSignal) =>
    call<SystemStatus>('system', {}, signal),
}

/** User-facing copy for wire error codes. */
export const ERROR_COPY: Record<string, string> = {
  forbidden: '请求被拒绝（跨站或 Host 不受信任）。',
  'method-error': '请求方式不被允许。',
  'bad-request': '请求格式不正确。',
  'not-found': '设备状态接口不存在（插件版本不匹配？）。',
  network: '无法联系本机 dsh。',
}

export function messageForError(error: DeviceStatusApiError): string {
  return ERROR_COPY[error.code] ?? error.message
}
