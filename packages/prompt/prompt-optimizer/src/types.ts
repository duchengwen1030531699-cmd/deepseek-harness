/**
 * Public request, value, and failure vocabulary for the prompt-optimizer
 * Remote boundary. This module contains types only so the generated Remote
 * client can consume it without importing Host runtime code.
 * @module @deepseek-ai/dsh-prompt-optimizer/types
 */

/** The current prompt-optimizer output. */
export interface PromptOptimizeValue {
  /** The optimized prompt, verbatim model output after normalization. */
  readonly prompt: string
}

/** Optimize one draft natural-language request into a well-formed prompt. */
export interface PromptOptimizeRequest {
  /** The raw draft text the user typed. */
  readonly text: string
}

/** The draft is empty or whitespace-only. */
export interface PromptOptimizeEmpty {
  readonly code: 'empty'
}

/** No usable LLM route could be resolved for the request. */
export interface PromptOptimizeRouteUnavailable {
  readonly code: 'route-unavailable'
}

/** The auxiliary model call failed or produced no usable text. */
export interface PromptOptimizeLlmFailed {
  readonly code: 'llm-failed'
  /** Provider or adapter failure message. */
  readonly message: string
}

/** Stable failures of the optimize operation. */
export type PromptOptimizeFailure =
  | PromptOptimizeEmpty
  | PromptOptimizeRouteUnavailable
  | PromptOptimizeLlmFailed

/** Successful public operation result. */
export interface PromptOptimizeSuccess<T> {
  readonly ok: true
  readonly value: T
}

/** Rejected public operation result with a stable business failure. */
export interface PromptOptimizeRejected<E extends PromptOptimizeFailure> {
  readonly ok: false
  readonly error: E
}

/** Result returned by the prompt-optimizer `optimize` operation. */
export type PromptOptimizeResult =
  | PromptOptimizeSuccess<PromptOptimizeValue>
  | PromptOptimizeRejected<PromptOptimizeFailure>
