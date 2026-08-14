# Prompt Optimizer

[English](prompt-optimizer.md) | 中文

[`@deepseek-ai/dsh-prompt-optimizer`](../../packages/prompt/prompt-optimizer) 将草稿形式的自然语言请求改写为格式良好的提示词，经由 harness 的 LLM 路由完成。该服务是一个 Typert Remote 端点（`ctx.remote.promptOptimizer`）；浏览器消费方是输入框工具行按钮（[`@deepseek-ai/dsh-client-ui-prompt-optimizer`](../../packages/client/ui-prompt-optimizer)），且 `@deepseek-ai/dsh-api-remotes` 挂载生成的贡献，使插件调用 `ctx.remote.promptOptimizer` 而不接触传输层。

Source: [`packages/prompt/prompt-optimizer/src/types.ts`](../../packages/prompt/prompt-optimizer/src/types.ts)

## Public types

```ts type-equiv
/** The current prompt-optimizer output. */
interface PromptOptimizeValue {
  /** The optimized prompt, verbatim model output after normalization. */
  readonly prompt: string
}
```

```ts type-equiv
/** Optimize one draft natural-language request into a well-formed prompt. */
interface PromptOptimizeRequest {
  /** The raw draft text the user typed. */
  readonly text: string
}
```

```ts type-equiv
/** The draft is empty or whitespace-only. */
interface PromptOptimizeEmpty {
  readonly code: 'empty'
}
```

```ts type-equiv
/** No usable LLM route could be resolved for the request. */
interface PromptOptimizeRouteUnavailable {
  readonly code: 'route-unavailable'
}
```

```ts type-equiv
/** The auxiliary model call failed or produced no usable text. */
interface PromptOptimizeLlmFailed {
  readonly code: 'llm-failed'
  /** Provider or adapter failure message. */
  readonly message: string
}
```

```ts type-equiv
/** Stable failures of the optimize operation. */
type PromptOptimizeFailure =
  | PromptOptimizeEmpty
  | PromptOptimizeRouteUnavailable
  | PromptOptimizeLlmFailed
```

```ts type-equiv
/** Successful public operation result. */
interface PromptOptimizeSuccess<T> {
  readonly ok: true
  readonly value: T
}
```

```ts type-equiv
/** Rejected public operation result with a stable business failure. */
interface PromptOptimizeRejected<E extends PromptOptimizeFailure> {
  readonly ok: false
  readonly error: E
}
```

```ts type-equiv
/** Result returned by the prompt-optimizer `optimize` operation. */
type PromptOptimizeResult =
  | PromptOptimizeSuccess<PromptOptimizeValue>
  | PromptOptimizeRejected<PromptOptimizeFailure>
```

## Request framing and route resolution

该服务将草稿框架化为一条辅助用户消息中的 JSON，并以稳定的优化系统指令和配置的 `maxOutputTokens` 上限调用 `ctx.llm.stream`。每次辅助请求前都会追加一条仅日志的 `session/prompt-optimize-request` 事件，记录 `{ route, system, messages, maxTokens }`，满足仓库级 model-visible⟺logged 规则；优化后的提示词作为唯一规范值返回。

路由按以下顺序解析：显式 `provider`/`model` 配置对，否则会话最新记录的 `request/header`，否则 `ctx.agentDefaultModel`。三者皆无的部署收到 `route-unavailable`。

## Failure semantics

空草稿或仅含空白的草稿返回 `empty`。模型流以错误或中止结束、超时（能力码 `PROMPT_OPTIMIZE_TIMEOUT`）、请求工具调用或未产生文本时，返回带失败消息的 `llm-failed`。浏览器中的按钮在任何失败下都保持草稿不变。

## Web surface

[`@deepseek-ai/dsh-client-ui-prompt-optimizer`](../../packages/client/ui-prompt-optimizer) 是浏览器消费方。按钮是 `conversation.input.model.tools` 列表插槽中的 `prompt-optimizer` 条目（order 10），该插槽由 `ui-conversation` 声明，在输入框工具行模型选择器右侧渲染。按钮通过标准 kit（`useInput`）读取实时草稿，通过注入的 `optimize` 动词调用 Remote，成功时通过 `inputActions.setDraft` 替换草稿。

## Boundaries and limitations

- 按钮等待完整辅助调用后一次性替换草稿；无实时流式预览。
- 替换后的草稿是一次普通的 `setDraft` 事务，遵循输入框的撤销行为。
- 路由解析基于会话默认：从未记录模型请求且无 `agentDefaultModel` 的会话，若无显式 `provider`/`model` 对则无法优化。

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — this section is byte-identical in both language sides of the page. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

<a id="ctxpromptoptimizer--promptoptimizerservice"></a>

### `ctx.promptOptimizer` — `PromptOptimizerService`

The prompt-optimizer Remote service. Resolves the session's Agent, records the exact auxiliary model request on the session log, and returns the normalized optimized prompt.

```ts cordis-catalog
/**
 * Optimize one draft into a well-formed prompt.
 * @param agent - exact live Agent resolved from the wire identity.
 * @param request - the raw draft text.
 * @returns the optimized prompt or a stable business failure.
 */
@Remote('optimize') async optimize(agent: Agent, request: PromptOptimizeRequest): Promise<PromptOptimizeResult>
```

Types: [Agent](core.md)

Source: [`packages/prompt/prompt-optimizer/src/index.ts:131`](../../packages/prompt/prompt-optimizer/src/index.ts)
<!-- END GENERATED cordis-surface -->
