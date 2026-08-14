/**
 * Prompt-optimize composer button plugin, browser half — one entry in the
 * 'conversation.input.model.tools' seat, immediately right of the model
 * select. The button reads the live draft from the session standard kit,
 * calls the Host `promptOptimizer.optimize` Remote, and replaces the draft
 * with the optimized prompt on success. Failures are silent no-ops on the
 * draft: the draft stays untouched so the user keeps their original text.
 */
// Type-only: pulls the generated Remote API and ctx.remote merge through the
// Client assembly boundary.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the ui-conversation SlotMap merge (the input.model.tools seat).
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { PromptOptimizeButton } from './PromptOptimizeButton.tsx'
import type { PromptOptimizeInjected } from './slots.ts'
import { optimize } from './controller.ts'
import { en, zh, type PromptOptimizerKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The prompt-optimize button copy. */
    'prompt-optimizer': PromptOptimizerKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'prompt-optimizer'

/** Required services: the contribution registry, the Remote mount, and locale. */
export const inject = ['remote', 'remote.promptOptimizer', 'slots', 'locale']

/**
 * Client plugin body: register the dictionaries, then the composer tool-row
 * entry over the Host Remote.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-prompt-optimizer: dictionaries')

  ctx.slots.inject('conversation.input.model.tools', () => ctx.slots.register({
    name: 'conversation.input.model.tools',
    id: 'prompt-optimizer',
    order: 10,
    locale: NS,
    inject: (sessionId): PromptOptimizeInjected => ({
      optimize: text => optimize(ctx.remote.promptOptimizer, sessionId, text),
    }),
  }, PromptOptimizeButton))
}
