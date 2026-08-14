/**
 * The prompt-optimizer entry's injected face. The target
 * 'conversation.input.model.tools' slot is declared and typed by
 * ui-conversation; this package only contributes the entry, so no SlotMap
 * merge lives here. Inject carries the single optimize verb over the Host
 * Remote; the component reads the draft and writes the result through the
 * framework standard kit (useInput / inputActions).
 * @module @deepseek-ai/dsh-client-ui-prompt-optimizer/client/slots
 */

import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from './locales.ts'
import type { OptimizeOutcome } from './controller.ts'

/** Injected business face of one composer optimize button. */
export interface PromptOptimizeInjected {
  /**
   * Optimize one draft through the Host Remote.
   * @param text - the raw draft text.
   * @returns the settled outcome (prompt, or a stable failure).
   */
  optimize: (text: string) => Promise<OptimizeOutcome>
}

/** Full props of the composer optimize button entry. */
export type PromptOptimizeButtonProps =
  PropsRuntime<'conversation.input.model.tools'>
  & PromptOptimizeInjected
  & PropsLocale<'prompt-optimizer'>
