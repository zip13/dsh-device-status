/**
 * Device Status tab: host machine CPU / memory / disk / network / uptime.
 * Polls only while the tab is visible; manual refresh button for on-demand
 * reads. Read-only — there is nothing to confirm and nothing to mutate.
 */
import { useCallback, useEffect, useState } from 'react'
import type { DeviceStatusTabComponentProps } from '../context-types.ts'
import {
  DeviceStatusApiError,
  deviceStatusApi,
  messageForError,
  type SystemStatus,
} from './api.ts'
import css from './status-panel.module.css'

const POLL_MS = 3000

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value >= 100 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`
}

function formatUptime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—'
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (days > 0) return `${days} 天 ${hours} 小时`
  if (hours > 0) return `${hours} 小时 ${minutes} 分钟`
  return `${minutes} 分钟`
}

function Meter(props: { percent: number | null; danger?: number }) {
  if (props.percent === null) return <span className={css.muted}>…</span>
  const level = props.danger !== undefined && props.percent >= props.danger ? css.meterFillDanger : ''
  return (
    <div className={css.meter}>
      <div className={css.meterTrack}>
        <div className={`${css.meterFill} ${level}`} style={{ width: `${props.percent}%` }} />
      </div>
      <span className={css.meterValue}>{props.percent.toFixed(1)}%</span>
    </div>
  )
}

export function StatusPanel(props: DeviceStatusTabComponentProps) {
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      setStatus(await deviceStatusApi.system())
    } catch (caught) {
      setError(caught instanceof DeviceStatusApiError ? messageForError(caught) : String(caught))
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    if (!props.visible) return
    void refresh()
    const timer = setInterval(() => {
      void refresh()
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [props.visible, refresh])

  return (
    <div className={css.root}>
      <div className={css.headerRow}>
        <span className={css.muted}>
          {status !== null ? `更新于 ${new Date(status.collectedAt).toLocaleTimeString()}` : '读取中…'}
        </span>
        <button type="button" className={css.button} onClick={() => void refresh()} disabled={busy}>
          {busy ? '刷新中…' : '刷新'}
        </button>
      </div>

      {error !== null && <div className={css.error}>{error}</div>}

      <section className={css.section}>
        <div className={css.label}>系统</div>
        <div className={css.row}>
          <span className={css.strong}>{status?.hostname ?? '…'}</span>
          <span className={css.muted}>
            {status !== null ? `${status.osType} ${status.osRelease} · ${status.platform}/${status.arch}` : ''}
          </span>
        </div>
        <div className={css.row}>
          <span className={css.muted}>运行时长 {status !== null ? formatUptime(status.uptimeSeconds) : '…'}</span>
          {status !== null && status.platform !== 'win32' && (
            <span className={css.muted}>
              负载 {status.loadAverage.map(value => value.toFixed(2)).join(' / ')}
            </span>
          )}
        </div>
      </section>

      <section className={css.section}>
        <div className={css.label}>CPU</div>
        <div className={css.row}>
          <span className={css.strong}>{status?.cpu.model ?? '…'}</span>
          <span className={css.muted}>{status !== null ? `${status.cpu.cores} 核` : ''}</span>
        </div>
        <Meter percent={status?.cpu.usagePercent ?? null} danger={90} />
      </section>

      <section className={css.section}>
        <div className={css.label}>内存</div>
        <Meter percent={status?.memory.usedPercent ?? null} danger={90} />
        {status !== null && (
          <div className={css.muted}>
            已用 {formatBytes(status.memory.usedBytes)} / 共 {formatBytes(status.memory.totalBytes)}
          </div>
        )}
      </section>

      <section className={css.section}>
        <div className={css.label}>磁盘</div>
        {status === null || status.disks.length === 0 ? (
          <p className={css.empty}>没有可读取的磁盘。</p>
        ) : (
          <div className={css.diskList}>
            {status.disks.map(disk => (
              <div key={disk.mount} className={css.diskItem}>
                <div className={css.row}>
                  <span className={css.strong}>{disk.mount}</span>
                  <span className={css.muted}>
                    可用 {formatBytes(disk.freeBytes)} / 共 {formatBytes(disk.totalBytes)}
                  </span>
                </div>
                <Meter percent={disk.usedPercent} danger={90} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={css.section}>
        <div className={css.label}>网络</div>
        {status === null || status.network.length === 0 ? (
          <p className={css.empty}>没有非回环网络接口。</p>
        ) : (
          <div className={css.diskList}>
            {status.network.map(entry => (
              <div key={entry.name} className={css.netItem}>
                <span className={css.strong}>{entry.name}</span>
                <span className={css.muted}>{entry.addresses.join(' · ')}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={css.section}>
        <div className={css.label}>DSH 进程</div>
        {status !== null && (
          <div className={css.muted}>
            pid {status.process.pid} · {status.process.nodeVersion} · RSS {formatBytes(status.process.rssBytes)}
            · 已运行 {formatUptime(status.process.uptimeSeconds)}
          </div>
        )}
      </section>
    </div>
  )
}
