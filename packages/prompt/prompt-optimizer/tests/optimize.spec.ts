import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import SessionStore, { SessionId, Session } from '@deepseek-ai/dsh-session'
import type { Agent } from '@deepseek-ai/dsh-agent'
import LlmRuntime, { LlmAdapter } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'
import { PromptOptimizerService } from '../src/index.ts'
import type { Config } from '../src/index.ts'

class RecordingAdapter extends LlmAdapter {
  readonly requests: GenerateOptions[] = []

  constructor(private readonly script: readonly StreamChunk[]) {
    super()
  }

  override async * stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    this.requests.push(options)
    yield * this.script
  }
}

const SCRIPT: StreamChunk[] = [
  { type: 'block-start', index: 0, blockType: 'text' },
  { type: 'text-delta', index: 0, text: '请编写一个 Python 脚本，' },
  { type: 'text-delta', index: 0, text: '读取 CSV 并输出统计。' },
  { type: 'finish', reason: { kind: 'stop' } },
]

const FAILING_SCRIPT: StreamChunk[] = [
  { type: 'block-start', index: 0, blockType: 'text' },
  { type: 'finish', reason: { kind: 'error', failure: { code: 'UPSTREAM', message: 'provider failed' } } },
]

const CONFIG: Config = {
  maxInputBytes: 1_000,
  maxOutputTokens: 256,
  timeoutMs: 5_000,
  provider: 'current-route',
  model: 'current-model',
}

let nextSession = 0

function stubAgent(): Agent {
  const id = SessionId(`prompt-optimize-${++nextSession}`)
  const session = Session.create(id)
  session.append('turn/start', { turn: 1 })
  const agent: Agent = {
    id,
    options: {},
    session,
    inbox: null as never,
    status: 'idle',
    ctx: new Context(),
    send: () => {},
    followup: () => {},
    steer: () => ({ outcome: Promise.resolve({ status: 'rejected' as const }) }),
    inject: () => {},
    cancel() {},
    runMaintenance: task => task(new AbortController().signal),
    whenIdle: () => Promise.resolve(),
  }
  return agent
}

async function withService(script: readonly StreamChunk[]): Promise<{
  ctx: Context
  adapter: RecordingAdapter
  service: PromptOptimizerService
  dispose: () => Promise<void>
}> {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(LlmRuntime)
  const adapter = new RecordingAdapter(script)
  ctx.llm.registerAdapter(['current-route'], adapter)
  const fiber = ctx.plugin(PromptOptimizerService, CONFIG)
  await fiber
  const service = ctx.promptOptimizer
  return {
    ctx,
    adapter,
    service,
    dispose: async () => { await fiber.dispose() },
  }
}

describe('PromptOptimizerService', () => {
  it('rejects a partial explicit route during service construction', () => {
    const ctx = new Context()
    const { model: _model, ...withoutModel } = CONFIG
    const { provider: _provider, ...withoutProvider } = CONFIG
    expect(() => new PromptOptimizerService(ctx, { ...withoutModel, provider: 'configured' }))
      .toThrow('prompt-optimizer: provider and model must be supplied together')
    expect(() => new PromptOptimizerService(ctx, { ...withoutProvider, model: 'configured' }))
      .toThrow('prompt-optimizer: provider and model must be supplied together')
  })

  it('optimizes a draft and records the exact auxiliary request on the session log', async () => {
    const { service, adapter, dispose } = await withService(SCRIPT)
    try {
      const agent = stubAgent()
      const result = await service.optimize(agent, { text: '写个脚本读csv' })

      expect(result).toEqual({
        ok: true,
        value: { prompt: '请编写一个 Python 脚本，读取 CSV 并输出统计。' },
      })
      expect(adapter.requests).toHaveLength(1)
      const options = adapter.requests[0]!
      expect(options.provider).toBe('current-route')
      expect(options.model).toBe('current-model')
      expect(options.maxTokens).toBe(256)
      expect(options.system).toContain('Rewrite the supplied natural-language request')
      expect(agent.session.events.some(event => event.type === 'session/prompt-optimize-request')).toBe(true)
      const recorded = agent.session.events.find(event => event.type === 'session/prompt-optimize-request')
      expect(recorded?.data).toMatchObject({
        route: { provider: 'current-route', model: 'current-model' },
        maxTokens: 256,
      })
    } finally {
      await dispose()
    }
  })

  it('rejects empty and whitespace-only drafts', async () => {
    const { service, dispose } = await withService(SCRIPT)
    try {
      const agent = stubAgent()
      expect(await service.optimize(agent, { text: '   ' })).toEqual({ ok: false, error: { code: 'empty' } })
      expect(await service.optimize(agent, { text: '' })).toEqual({ ok: false, error: { code: 'empty' } })
    } finally {
      await dispose()
    }
  })

  it('returns llm-failed when the model stream ends in error', async () => {
    const { service, dispose } = await withService(FAILING_SCRIPT)
    try {
      const agent = stubAgent()
      const result = await service.optimize(agent, { text: '优化这段文本' })
      expect(result).toMatchObject({
        ok: false,
        error: { code: 'llm-failed', message: expect.any(String) as unknown },
      })
    } finally {
      await dispose()
    }
  })

  it('rejects oversized input', async () => {
    const { service, dispose } = await withService(SCRIPT)
    try {
      const agent = stubAgent()
      const result = await service.optimize(agent, { text: 'x'.repeat(2_000) })
      expect(result).toMatchObject({
        ok: false,
        error: { code: 'llm-failed', message: expect.stringContaining('maxInputBytes') as unknown },
      })
    } finally {
      await dispose()
    }
  })
})
