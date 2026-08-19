/**
 * Structural types for the cordis services this plugin consumes. A third-party
 * plugin resolves outside the DSH monorepo's single cordis instance, so
 * upstream `declare module 'cordis'` augmentations do not reach this Context.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from 'cordis'

export interface DeviceStatusWebRoute {
  kind: 'exact' | 'prefix'
  path: string
  handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
}

export interface DeviceStatusWebServer {
  register(route: DeviceStatusWebRoute): () => void
}

export interface DeviceStatusLoaderEntry {
  options: { name: string; config?: { trustedHosts?: string[] } }
}

export interface DeviceStatusLoader {
  entries(): Iterable<DeviceStatusLoaderEntry>
}

export interface DeviceStatusTabDescriptor {
  id: string
  title: string | (() => string)
  icon?: unknown | ((size: number) => unknown)
  order?: number
  hidden?: boolean
  single?: boolean
  component: (props: DeviceStatusTabComponentProps) => unknown
}

export interface DeviceStatusTabComponentProps {
  ctx: Context
  scope: { sessionId: string; cwd?: string }
  tab: { id: string; type: string; title: string; path?: string }
  visible: boolean
}

export interface DeviceStatusBetterSidebarService {
  registerTab(descriptor: DeviceStatusTabDescriptor): () => void
  openTab(seed: { type: string; title?: string; id?: string }): void
}

declare module 'cordis' {
  interface Context {
    webServer: DeviceStatusWebServer
    loader: DeviceStatusLoader
    betterSidebar: DeviceStatusBetterSidebarService
    effect(fn: () => void | (() => void), label?: string): void
  }
}

export type { Context }
