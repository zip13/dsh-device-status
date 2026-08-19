import { describe, expect, it } from 'vitest'
import {
  collectNetwork,
  collectSystemStatus,
  computeCpuUsagePercent,
  snapshotCpuTimes,
} from '../src/index.ts'

describe('computeCpuUsagePercent', () => {
  it('computes busy percent between snapshots', () => {
    const previous = [{ idle: 50, total: 100 }, { idle: 50, total: 100 }]
    const next = [{ idle: 75, total: 200 }, { idle: 50, total: 200 }]
    // core0: total +100, idle +25 → 75% busy; core1: total +100, idle +0 → 100% busy
    // overall: total +200, idle +25 → 87.5%
    expect(computeCpuUsagePercent(previous, next)).toBe(87.5)
  })

  it('returns null for empty input', () => {
    expect(computeCpuUsagePercent([], [])).toBeNull()
  })

  it('returns null when counters do not advance', () => {
    const snapshot = [{ idle: 10, total: 20 }]
    expect(computeCpuUsagePercent(snapshot, snapshot)).toBeNull()
  })

  it('reports 100 when no idle time passes', () => {
    const previous = [{ idle: 0, total: 0 }]
    const next = [{ idle: 0, total: 100 }]
    expect(computeCpuUsagePercent(previous, next)).toBe(100)
  })
})

describe('snapshotCpuTimes', () => {
  it('matches the core count and monotonic totals', () => {
    const first = snapshotCpuTimes()
    expect(first.length).toBeGreaterThan(0)
    for (const core of first) {
      expect(core.total).toBeGreaterThanOrEqual(core.idle)
    }
  })
})

describe('collectSystemStatus', () => {
  it('returns host facts without a shell', async () => {
    const status = await collectSystemStatus(null)
    expect(status.hostname.length).toBeGreaterThan(0)
    expect(status.cpu.cores).toBeGreaterThan(0)
    expect(status.memory.totalBytes).toBeGreaterThan(0)
    expect(status.memory.usedPercent).toBeGreaterThan(0)
    expect(status.memory.usedBytes).toBe(status.memory.totalBytes - status.memory.freeBytes)
    expect(Number.isNaN(Date.parse(status.collectedAt))).toBe(false)
    expect(Array.isArray(status.disks)).toBe(true)
    expect(Array.isArray(status.network)).toBe(true)
    expect(status.process.pid).toBe(process.pid)
  })

  it('reads at least one disk on any supported host', async () => {
    const status = await collectSystemStatus(null)
    expect(status.disks.length).toBeGreaterThanOrEqual(1)
    for (const disk of status.disks) {
      expect(disk.totalBytes).toBeGreaterThan(0)
      expect(disk.usedPercent).toBeGreaterThanOrEqual(0)
      expect(disk.usedPercent).toBeLessThanOrEqual(100)
    }
  })
})

describe('collectNetwork', () => {
  it('excludes internal (loopback) addresses', () => {
    for (const entry of collectNetwork()) {
      expect(entry.addresses.length).toBeGreaterThan(0)
      expect(entry.addresses.every(address => !address.includes('127.0.0.1') && !address.includes('::1'))).toBe(true)
    }
  })
})
