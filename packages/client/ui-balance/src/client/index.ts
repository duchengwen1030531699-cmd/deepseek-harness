/**
 * Sidebar account balance, browser half: mounts the persistent balance strip
 * in the sidebar foot and shadows the shipped cordis plugin controller (the
 * controller is not needed when the balance strip is the foot's only surface).
 *
 * @module @deepseek-ai/dsh-client-ui-balance/client
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Side-effect type import activating the sidebar.footer.action SlotMap merge.
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
// Type-only: pulls the renderer-owned slots service into the Context merge.
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import { BalanceCell } from './BalanceCell.tsx'

/** Required services: the slot registry owns both registrations. */
export const inject = ['slots']

/** Empty occupant replacing the shipped `cordis-panel` cell (see below). */
function CordisPanelShadow(): null {
  return null
}

/**
 * Browser plugin body: register the balance strip on its own cell and shadow
 * the plugin controller cell. Shadowing needs an explicit lower priority:
 * cell shadowing ranks ascending with the lowest rendering, and a same-priority
 * second registration throws (the shipped entry registers at default 0).
 * @param ctx - client root context with the slot registry.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register(
    { name: 'sidebar.footer.action', id: 'account-balance', order: 10 },
    BalanceCell,
  )), 'ui-balance: balance strip')
  ctx.effect(() => ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register(
    { name: 'sidebar.footer.action', id: 'cordis-panel', priority: -1 },
    CordisPanelShadow,
  )), 'ui-balance: cordis controller shadow')
}
