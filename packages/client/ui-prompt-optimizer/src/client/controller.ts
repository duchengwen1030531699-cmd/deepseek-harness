/**
 * Browser-local wrapper over the prompt-optimizer Host Remote. The generated
 * face resolves the session's Agent from the wire id. This controller folds
 * both carrier envelopes and rejected transport promises into the outer
 * `ok: false` branch, then reads the business envelope.
 * @module @deepseek-ai/dsh-client-ui-prompt-optimizer/client/controller
 */

import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { SessionId } from '@deepseek-ai/dsh-client-connection/client'
import type {
  PromptOptimizeFailure,
  PromptOptimizeResult,
  PromptOptimizeValue,
} from '@deepseek-ai/dsh-prompt-optimizer/types'

/** The one Remote call this controller needs. */
export interface PromptOptimizerRemote {
  optimize: (sessionId: SessionId, request: { text: string }) => Promise<RemoteResult<PromptOptimizeResult>>
}

/** Settled action shape rendered by the optimize button. */
export type OptimizeOutcome =
  | { ok: true; value: PromptOptimizeValue }
  | { ok: false; error: PromptOptimizeFailure | { code: 'transport'; message: string } }

/**
 * Wrap one Remote call into the settled outcome shape.
 * @param remote - the promptOptimizer Remote namespace.
 * @param sessionId - Session whose Agent the Host resolves for the call.
 * @param text - the raw draft text to optimize.
 * @returns the settled outcome (prompt, or a stable failure).
 */
export async function optimize(
  remote: PromptOptimizerRemote,
  sessionId: SessionId,
  text: string,
): Promise<OptimizeOutcome> {
  let carried: RemoteResult<PromptOptimizeResult>
  try {
    carried = await remote.optimize(sessionId, { text })
  } catch (error: unknown) {
    return {
      ok: false,
      error: { code: 'transport', message: error instanceof Error ? error.message : String(error) },
    }
  }
  if (!carried.ok) {
    return { ok: false, error: { code: 'transport', message: carried.error.message } }
  }
  const result = carried.value
  if (result.ok) return { ok: true, value: result.value }
  return { ok: false, error: result.error }
}
