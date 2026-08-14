# @deepseek-ai/dsh-prompt-optimizer

[English](README.md) | 中文

将草稿形式的自然语言请求改写为格式良好的提示词，经由 harness 的 LLM 路由完成。该服务是一个 Typert Remote 端点（`ctx.remote.promptOptimizer`），由 Web 客户端的输入框工具行按钮（[`@deepseek-ai/dsh-client-ui-prompt-optimizer`](../../client/ui-prompt-optimizer/README.md)）消费；Host 解析会话的 Agent，在会话日志上记录确切的辅助模型请求，并返回规范化后的优化提示词。

## 服务 API

`PromptOptimizerService` 注册 `promptOptimizer` 服务键和 Remote 命名空间 `promptOptimizer.optimize`：

| 方法 | Wire 端点 | 返回 |
|---|---|---|
| `optimize(agent, { text })` | `promptOptimizer/optimize` | `PromptOptimizeResult` |

该方法接收从 wire 身份解析出的实时 `Agent`（`dsh-host-apiproxy` 配置的 `agent` Typert lookup）；客户端传入会话 id。

### 结果

- `{ ok: true, value: { prompt } }` — 优化后的提示词，即空白规范化后的模型原文。
- `{ ok: false, error: { code: 'empty' } }` — 草稿为空或仅含空白。
- `{ ok: false, error: { code: 'route-unavailable' } }` — 未配置显式 provider/model 对，且会话日志与 `ctx.agentDefaultModel` 均未提供路由。
- `{ ok: false, error: { code: 'llm-failed', message } }` — 辅助模型请求失败、超时、仅产生工具调用，或未产生文本。

## 配置

| 字段 | 必填 | 含义 |
|---|---|---|
| `maxInputBytes` | 是 | 框架化用户提示词的最大 UTF-8 字节数。 |
| `maxOutputTokens` | 是 | 辅助生成的输出 token 上限。 |
| `timeoutMs` | 是 | 端到端辅助请求截止时间。 |
| `provider` / `model` | 否 | 显式路由；两者必须同时提供。 |

无显式路由对时，路由按以下顺序解析：会话最新记录的 `request/header`，然后 `ctx.agentDefaultModel`。三者皆无的部署会收到 `route-unavailable`；只配置一个显式字段会在插件加载时失败。

## 事件

该服务在每次辅助模型请求前追加一条仅日志的预分发记录（仓库级 model-visible⟺logged 规则）：

| 事件 | 负载 |
|---|---|
| `session/prompt-optimize-request` | `{ route, system, messages, maxTokens }` |

## 扩展点

无 — 该插件贡献一个自包含的 Remote 端点。客户端负责输入框入口。

## Model Experience

### Request context and condition

#### What the model sees

每次用户激活输入框的优化按钮时，按已解析路由发送一条携带 JSON 框架化草稿的辅助用户消息，外加稳定的优化系统指令。

##### Verbatim text for the system instruction

```markdown
You are a prompt engineering assistant.
Rewrite the supplied natural-language request into a clear, structured, and professional prompt.
Preserve every requirement and constraint the user stated; add only structural clarity.
Return only the optimized prompt as plain text, with no quotes, prefix, explanation, Markdown, XML, or terminal control codes. No code is allowed.
Use the language of the input text.
```

#### Token effect

条件式：每次点击优化按钮产生一次辅助请求，输入大小受 `maxInputBytes` 限制，输出受 `maxOutputTokens` 限制。

#### KV Cache effect

独立的模型请求：复用路由提供的任何 provider 缓存；框架化 JSON 输入相对自身是追加式的，不复用对话前缀。

## Known Limitations and Deferred Work

- **无客户端流式预览** — 按钮等待完整辅助调用后一次性替换草稿；流式预览留待后续。
- **路由解析基于会话默认** — 从未记录模型请求且无 `agentDefaultModel` 的会话，若无显式 `provider`/`model` 对则无法优化。
