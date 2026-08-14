/** Package-owned invariant companion for `@deepseek-ai/dsh-prompt-optimizer`. @module @deepseek-ai/dsh-prompt-optimizer/invariant */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-prompt-optimizer'

/** Cordis companion plugin name. */
export const name = 'prompt-optimizer-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: the auxiliary request record is an append-only
 * `session/prompt-optimize-request` surface event on the Session log, owned by
 * dsh-session; the Remote service owns no independent durable state relation.
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
