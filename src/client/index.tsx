/**
 * Client half: one better-sidebar tab. Inactive until `betterSidebar` exists.
 * Read-only host status view; no model tools, no mutations.
 */
import type { Context } from '../context-types.ts'
import { inject } from './inject.ts'
import { StatusPanel } from './StatusPanel.tsx'

export { inject }

function DeviceIcon(size: number) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="3" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M5 13.5h6M8 11v2.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M4.5 8.5l1.5-2 1.5 2.5 1.5-3.5 1.5 3"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function apply(ctx: Context): void {
  ctx.effect(() => ctx.betterSidebar.registerTab({
    id: 'dsh-device-status',
    title: () => '设备状态',
    icon: (size: number) => DeviceIcon(size),
    order: 26,
    single: true,
    component: (props) => <StatusPanel {...props} />,
  }), 'dsh-device-status: register sidebar tab')
}
