# @deepseek-ai/dsh-client-ui-prompt-optimizer

[English](README.md) | 中文

输入框工具行优化按钮：通过 Host 的 [`@deepseek-ai/dsh-prompt-optimizer`](../../prompt/prompt-optimizer/README.md) Remote 将草稿改写为格式良好的提示词。按钮占据 `conversation.input.model.tools` 席位（由 `dsh-client-ui-conversation` 声明），位于模型选择器右侧，成功后用优化后的提示词替换草稿。

## 组成

- **条目**：`conversation.input.model.tools` 席位中的一个列表条目（`id: 'prompt-optimizer'`，`order: 10`）。
- **注入面**：包装 `promptOptimizer.optimize` Remote 的 `optimize(text)`；会话 id 按会话作用域捕获。
- **行为**：草稿为空或锁定时禁用，辅助请求进行中显示忙碌，失败时静默不操作。响应仅在草稿仍与请求文本一致时替换它，因此请求期间输入的内容保持不变。

## 扩展点

除席位外无其他消费；模型调用由 Host 服务负责。

## Model Experience

### Request context and condition

#### What the model sees

不直接产生内容：模型请求由 Host 的 prompt-optimizer 服务负责（一条携带 JSON 框架化草稿的辅助用户消息加上优化系统指令），由本按钮触发。本插件不贡献任何自身提示词文本。

#### Token effect

无直接影响；Host 辅助请求受其自身 `maxInputBytes` / `maxOutputTokens` 配置约束。

#### KV Cache effect

独立；见 Host 包的 Model Experience。

## Known Limitations and Deferred Work

- **无乐观结果** — 按钮等待完整辅助调用后一次性替换草稿；流式预览留待后续。
- **无撤销** — 替换后的草稿是一次普通的 `setDraft` 事务，遵循输入框的撤销行为。
