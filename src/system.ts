/**
 * Host machine status collectors. Everything comes from Node `os` and
 * `fs.statfs` — no shell, no native addons, no child processes, so the plugin
 * stays read-only and works on any platform DSH runs on.
 */
import { statfs } from 'node:fs/promises'
import {
  arch,
  cpus,
  freemem,
  hostname,
  loadavg,
  networkInterfaces,
  platform,
  release,
  totalmem,
  type as osType,
  uptime,
} from 'node:os'

export interface CpuTimesSnapshot {
  idle: number
  total: number
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
    /** Busy percent since the previous query; null when it cannot be judged. */
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

/** Per-core cumulative CPU times (milliseconds since boot). */
export function snapshotCpuTimes(): CpuTimesSnapshot[] {
  return cpus().map((cpu) => {
    const times = cpu.times
    return {
      idle: times.idle,
      total: times.user + times.nice + times.sys + times.idle + times.irq,
    }
  })
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

/**
 * Busy percent between two snapshots. Returns null when the counters cannot
 * be compared (empty machine, core-count change, counter reset).
 */
export function computeCpuUsagePercent(
  previous: readonly CpuTimesSnapshot[],
  next: readonly CpuTimesSnapshot[],
): number | null {
  const count = Math.min(previous.length, next.length)
  if (count === 0) return null
  let idleDelta = 0
  let totalDelta = 0
  for (let index = 0; index < count; index++) {
    const before = previous[index]!
    const after = next[index]!
    const total = after.total - before.total
    const idle = after.idle - before.idle
    if (total <= 0 || idle < 0 || idle > total) return null
    totalDelta += total
    idleDelta += idle
  }
  if (totalDelta <= 0) return null
  const busy = 1 - idleDelta / totalDelta
  return round1(Math.min(1, Math.max(0, busy)) * 100)
}

/** Candidate mount points: fixed drive letters on Windows, `/` elsewhere. */
function candidateMounts(): string[] {
  if (platform() !== 'win32') return ['/']
  const mounts: string[] = []
  for (let code = 67; code <= 90; code++) { // C..Z
    mounts.push(`${String.fromCharCode(code)}:\\`)
  }
  return mounts
}

/** Fixed disks that answer statfs; unreadable / absent mounts are skipped. */
export async function collectDisks(): Promise<DiskStatus[]> {
  const disks: DiskStatus[] = []
  for (const mount of candidateMounts()) {
    try {
      const stats = await statfs(mount)
      const totalBytes = stats.blocks * stats.bsize
      const freeBytes = stats.bavail * stats.bsize
      if (totalBytes <= 0) continue
      disks.push({
        mount,
        totalBytes,
        freeBytes,
        usedPercent: round1(((totalBytes - freeBytes) / totalBytes) * 100),
      })
    } catch {
      // Absent drive letter or unreadable mount — not a status.
    }
  }
  return disks
}

/** Non-internal addresses per interface (loopback is noise for this view). */
export function collectNetwork(): NetworkEntry[] {
  const entries: NetworkEntry[] = []
  for (const [name, addresses] of Object.entries(networkInterfaces())) {
    const visible = (addresses ?? [])
      .filter(address => !address.internal)
      .map(address => `${address.family === 'IPv4' ? 'IPv4' : 'IPv6'} ${address.address}`)
    if (visible.length > 0) entries.push({ name, addresses: visible })
  }
  return entries
}

export async function collectSystemStatus(cpuUsagePercent: number | null): Promise<SystemStatus> {
  const totalBytes = totalmem()
  const freeBytes = freemem()
  const cpuList = cpus()
  return {
    hostname: hostname(),
    platform: platform(),
    arch: arch(),
    osType: osType(),
    osRelease: release(),
    uptimeSeconds: Math.round(uptime()),
    loadAverage: loadavg(),
    cpu: {
      model: cpuList[0]?.model ?? 'unknown',
      cores: cpuList.length,
      usagePercent: cpuUsagePercent,
    },
    memory: {
      totalBytes,
      freeBytes,
      usedBytes: totalBytes - freeBytes,
      usedPercent: totalBytes > 0 ? round1(((totalBytes - freeBytes) / totalBytes) * 100) : 0,
    },
    disks: await collectDisks(),
    network: collectNetwork(),
    process: {
      pid: process.pid,
      nodeVersion: process.version,
      uptimeSeconds: Math.round(process.uptime()),
      rssBytes: process.memoryUsage().rss,
    },
    collectedAt: new Date().toISOString(),
  }
}
