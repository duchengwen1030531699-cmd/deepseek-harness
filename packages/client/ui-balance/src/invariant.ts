/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-client-ui-balance`.
 * @module @deepseek-ai/dsh-client-ui-balance/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-client-ui-balance'

/** Cordis companion plugin name. */
export const name = 'ui-balance-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: the package emits no cordis events and owns no mutable
 * cross-plugin relation — the route registrations' register/dispose symmetry
 * is enforced by the webserver package's own route-table lifecycle, and the
 * reader's cache/refresh behavior is exercised directly by its behavior specs.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
