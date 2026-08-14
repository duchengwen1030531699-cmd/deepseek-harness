/**
 * Prompt optimizer: rewrite a draft natural-language request into a
 * well-formed prompt through the harness LLM route.
 * @module @deepseek-ai/dsh-prompt-optimizer
 */

import { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { GenerateOptions, Message } from '@deepseek-ai/dsh-llm'
import { BlockAssembler, createUserMessage, deepFreeze } from '@deepseek-ai/dsh-llm'
import type { Agent, ModelSelection } from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-agent-default-model'
import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol'
import { deadline, MAX_TIMER_DELAY_MS } from '@deepseek-ai/dsh-timeout'
import type {
  PromptOptimizeFailure,
  PromptOptimizeRejected,
  PromptOptimizeRequest,
  PromptOptimizeResult,
  PromptOptimizeValue,
} from './types.ts'

export type * from './types.ts'

/** Capability-owned timeout reason code for auxiliary prompt-optimize requests. */
export const PROMPT_OPTIMIZE_TIMEOUT_CODE = 'PROMPT_OPTIMIZE_TIMEOUT'

/** Exact model-visible request recorded before one auxiliary prompt-optimize dispatch. */
export interface PromptOptimizeLlmRequestEventData {
  /** Exact auxiliary LLM route. */
  readonly route: { provider: string; model: string }
  /** Exact auxiliary system prompt. */
  readonly system: string
  /** Exact auxiliary message list. */
  readonly messages: Message[]
  /** Exact auxiliary output-token cap. */
  readonly maxTokens: number
}

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    /** Log-only pre-dispatch record of one prompt-optimize model request. */
    'session/prompt-optimize-request': PromptOptimizeLlmRequestEventData
  }
}

/** Required deployment policy for the prompt-optimizer. */
export interface Config {
  /** Maximum UTF-8 bytes in the final framed user prompt. */
  readonly maxInputBytes: number
  /** Auxiliary generation output-token cap. */
  readonly maxOutputTokens: number
  /** End-to-end auxiliary request deadline in milliseconds. */
  readonly timeoutMs: number
  /** Optional explicit provider route; must be paired with `model`. */
  readonly provider?: string
  /** Optional explicit model id; must be paired with `provider`. */
  readonly model?: string
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    promptOptimizer: PromptOptimizerService
  }
}

/** Stable language-aware system instruction for prompt optimization. */
function systemPrompt(): string {
  return [
    'You are a prompt engineering assistant.',
    'Rewrite the supplied natural-language request into a clear, structured, and professional prompt.',
    'Preserve every requirement and constraint the user stated; add only structural clarity.',
    'Return only the optimized prompt as plain text, with no quotes, prefix, explanation, Markdown, XML, or terminal control codes. No code is allowed.',
    'Use the language of the input text.',
  ].join('\n')
}

/** Frame the draft as JSON so user text cannot break structural delimiters. */
function frameText(text: string): string {
  return `Optimize this request into a well-formed prompt:\n${JSON.stringify(text)}`
}

/** Resolve the explicit pair or the Agent's current model selection. */
function resolveRoute(
  ctx: Context,
  provider: string | undefined,
  model: string | undefined,
  agent: Agent,
): { provider: string; model: string } | undefined {
  if (provider !== undefined && model !== undefined) {
    return { provider, model }
  }
  const header = agent.session.requestHeader()?.config
  if (header !== undefined) return { provider: header.provider, model: header.model }
  const defaults = ctx.get('agentDefaultModel')
  if (defaults === undefined) return undefined
  const selection: ModelSelection = defaults.currentSelection()
  return { provider: selection.provider, model: selection.model }
}

/** Reject an incomplete explicit model route during service construction. */
function resolveConfig(config: Config): Config {
  if ((config.provider === undefined) !== (config.model === undefined)) {
    throw new Error('prompt-optimizer: provider and model must be supplied together')
  }
  return config
}

/** Translate terminal finish reasons into an auxiliary-call failure. */
function finishError(finish: { kind: string }): Error | undefined {
  switch (finish.kind) {
    case 'stop':
      return undefined
    case 'error':
    case 'aborted':
      return new Error(`prompt-optimize model request ${finish.kind}`)
    case 'max-tokens':
      return new Error('prompt-optimize output reached maxOutputTokens')
    case 'tool-calls':
      return new Error('prompt-optimize model unexpectedly requested a tool')
    default:
      return new Error(`prompt-optimize unsupported finish reason "${finish.kind}"`)
  }
}

/**
 * The prompt-optimizer Remote service. Resolves the session's Agent, records
 * the exact auxiliary model request on the session log, and returns the
 * normalized optimized prompt.
 */
export class PromptOptimizerService extends TypertRemoteService {
  static inject = ['llm', 'sessions']

  static Config: z<Config> = z.object({
    maxInputBytes: z.number().step(1).min(1).required(),
    maxOutputTokens: z.number().step(1).min(1).required(),
    timeoutMs: z.number().step(1).min(1).max(MAX_TIMER_DELAY_MS).required(),
    provider: z.string(),
    model: z.string(),
  })

  private readonly maxInputBytes: number
  private readonly maxOutputTokens: number
  private readonly timeoutMs: number
  private readonly provider: string | undefined
  private readonly model: string | undefined

  /**
   * @param ctx - Host context carrying the LLM service and session store.
   * @param config - required byte, token, timeout, and optional route policy.
   */
  constructor(ctx: Context, config: Config) {
    const resolved = resolveConfig(config)
    super(ctx, 'promptOptimizer')
    this.maxInputBytes = resolved.maxInputBytes
    this.maxOutputTokens = resolved.maxOutputTokens
    this.timeoutMs = resolved.timeoutMs
    this.provider = resolved.provider
    this.model = resolved.model
  }

  /** Build the frozen failure branch. */
  private rejected<E extends PromptOptimizeFailure>(error: E): PromptOptimizeRejected<E> {
    return { ok: false, error }
  }

  /**
   * Optimize one draft into a well-formed prompt.
   * @param agent - exact live Agent resolved from the wire identity.
   * @param request - the raw draft text.
   * @returns the optimized prompt or a stable business failure.
   */
  @Remote('optimize')
  async optimize(agent: Agent, request: PromptOptimizeRequest): Promise<PromptOptimizeResult> {
    const text = request.text.trim()
    if (text === '') return this.rejected({ code: 'empty' })
    const framedInput = frameText(text)
    const inputBytes = Buffer.byteLength(framedInput, 'utf8')
    if (inputBytes > this.maxInputBytes) {
      return this.rejected({ code: 'llm-failed', message: `input is ${inputBytes} bytes, exceeding maxInputBytes ${this.maxInputBytes}` })
    }
    const route = resolveRoute(this.ctx, this.provider, this.model, agent)
    if (route === undefined) return this.rejected({ code: 'route-unavailable' })
    const messages: Message[] = [createUserMessage({
      content: [{ type: 'text', text: framedInput }],
      source: { kind: 'plugin', plugin: 'dsh-prompt-optimizer' },
    })]
    const system = systemPrompt()
    using callDeadline = deadline(new AbortController().signal, this.timeoutMs, PROMPT_OPTIMIZE_TIMEOUT_CODE)
    const options: GenerateOptions = deepFreeze({
      provider: route.provider,
      model: route.model,
      messages,
      system,
      maxTokens: this.maxOutputTokens,
      sessionId: agent.session.id,
      signal: callDeadline.signal,
    })
    agent.session.append('session/prompt-optimize-request', {
      route,
      system,
      messages,
      maxTokens: this.maxOutputTokens,
    })
    callDeadline.signal.throwIfAborted()
    const assembler = new BlockAssembler()
    try {
      for await (const chunk of this.ctx.llm.stream(options)) {
        callDeadline.signal.throwIfAborted()
        assembler.push(chunk)
      }
    } catch (error: unknown) {
      return this.rejected({
        code: 'llm-failed',
        message: error instanceof Error ? error.message : String(error),
      })
    }
    callDeadline.signal.throwIfAborted()
    const terminalError = finishError(assembler.finish)
    if (terminalError !== undefined) return this.rejected({ code: 'llm-failed', message: terminalError.message })
    const blocks = assembler.blocks()
    if (blocks.some(block => block.type === 'tool-call')) {
      return this.rejected({ code: 'llm-failed', message: 'prompt-optimize output must contain text only' })
    }
    const prompt = blocks
      .filter((block): block is Extract<(typeof blocks)[number], { type: 'text' }> => block.type === 'text')
      .map(block => block.text)
      .join(' ')
      .trim()
    if (prompt === '') return this.rejected({ code: 'llm-failed', message: 'prompt-optimize model produced no text' })
    return { ok: true, value: deepFreeze<PromptOptimizeValue>({ prompt }) }
  }
}

export default PromptOptimizerService
