// @vitest-environment jsdom
/**
 * ui-prompt-optimizer browser half on a real cordis Context with fake
 * slots/remote/locale faces: the plugin registers the composer tool-row
 * entry at conversation.input.model.tools, the inject face wraps the Host
 * Remote (carrier failure folded, business failure passed through), and
 * registration disposal rides the plugin fiber (HMR safety). The node half
 * and the invariant companion are exercised over the same Context.
 */
import { Context, Service } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { SlotRegistry, type SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import type { PromptOptimizeResult } from '@deepseek-ai/dsh-prompt-optimizer/types'
import { apply, inject } from '../src/client/index.ts'
import type { OptimizeOutcome, PromptOptimizerRemote } from '../src/client/controller.ts'

afterEach(cleanup)

const sid = (k: string): SessionId => k as SessionId

async function bench(options: {
  result?: PromptOptimizeResult
  carrier?: { code: string; message: string; details: object }
  rejection?: Error
} = {}) {
  const ctx = new Context()
  const calls: { sessionId: SessionId; text: string }[] = []
  const remote: PromptOptimizerRemote = {
    optimize: async (sessionId, request) => {
      calls.push({ sessionId, text: request.text })
      if (options.rejection !== undefined) throw options.rejection
      if (options.carrier !== undefined) {
        return Promise.resolve({ ok: false, error: options.carrier })
      }
      return Promise.resolve({ ok: true, value: options.result ?? { ok: true, value: { prompt: 'optimized' } } })
    },
  }
  class RemoteService extends Service {
    constructor(serviceCtx: Context) {
      super(serviceCtx, 'remote')
    }
  }
  new RemoteService(ctx)
  ctx.provide('remote.promptOptimizer', remote)
  await ctx.plugin(SlotRegistry).await()
  ctx.slots.register({
    name: 'root', children: {
      'conversation.input.model.tools': { kind: 'list', scope: 'session' },
    },
  } as never, (() => null) as never)
  ctx.provide('locale', new LocaleRuntime(ctx))
  const fiber = ctx.plugin({ inject: [...inject], apply })
  return {
    ctx,
    fiber,
    calls,
    entry: () => {
      const entry = ctx.slots.entries('conversation.input.model.tools')[0]
      if (entry === undefined) return undefined
      return {
        ...entry.options,
        locale: entry.locale,
        inject: entry.inject as unknown as ((sessionId: SessionId) => { optimize: (text: string) => Promise<OptimizeOutcome> }) | undefined,
      }
    },
  }
}

describe('ui-prompt-optimizer browser plugin', () => {
  it('registers the composer tool-row entry with the locale seat', async () => {
    const b = await bench()
    await b.fiber.await()
    expect(b.entry()).toMatchObject({ id: 'prompt-optimizer', order: 10, locale: 'prompt-optimizer' })
    expect(b.entry()?.inject).toBeTypeOf('function')
  })

  it('inject optimize forwards the session id and returns the business value', async () => {
    const b = await bench()
    await b.fiber.await()
    const injected = b.entry()?.inject?.(sid('s1'))
    const outcome = await injected?.optimize('写个脚本读csv')
    expect(b.calls).toEqual([{ sessionId: sid('s1'), text: '写个脚本读csv' }])
    expect(outcome).toEqual({ ok: true, value: { prompt: 'optimized' } })
  })

  it('folds a carrier failure into the settled outcome', async () => {
    const b = await bench({ carrier: { code: 'internal', message: 'boom', details: {} } })
    await b.fiber.await()
    const injected = b.entry()?.inject?.(sid('s2'))
    const outcome = await injected?.optimize('text')
    expect(outcome).toEqual({ ok: false, error: { code: 'transport', message: 'boom' } })
  })

  it('folds a rejected Remote promise into the settled outcome', async () => {
    const b = await bench({ rejection: new Error('socket closed') })
    await b.fiber.await()
    const injected = b.entry()?.inject?.(sid('s2'))
    const outcome = await injected?.optimize('text')
    expect(outcome).toEqual({ ok: false, error: { code: 'transport', message: 'socket closed' } })
  })

  it('passes a business failure through unchanged', async () => {
    const b = await bench({ result: { ok: false, error: { code: 'empty' } } })
    await b.fiber.await()
    const injected = b.entry()?.inject?.(sid('s3'))
    const outcome = await injected?.optimize('   ')
    expect(outcome).toEqual({ ok: false, error: { code: 'empty' } })
  })

  it('removes its registration when the fiber is disposed (HMR safety)', async () => {
    const b = await bench()
    await b.fiber.await()
    expect(b.ctx.slots.entries('conversation.input.model.tools')).toHaveLength(1)
    await b.fiber.dispose()
    expect(b.ctx.slots.entries('conversation.input.model.tools')).toHaveLength(0)
  })
})
