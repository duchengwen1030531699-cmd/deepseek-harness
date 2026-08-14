# Agent Note: Composer prompt-optimize button over a Host Remote

Status: implemented

[English](2026-08-14-composer-prompt-optimize-button.md) | 中文

## Problem

Web composer 需要在发送前优化草稿，但不能向浏览器暴露 LLM 路由，也不能让模型输入未记录到会话日志。

## Decision

`@deepseek-ai/dsh-prompt-optimizer` 将辅助 LLM 调用作为 `promptOptimizer.optimize` Typert Remote 服务持有。它从 wire identity 解析活动 Agent，以 JSON 封装草稿，在分发前追加精确的 `session/prompt-optimize-request` 记录，并返回归一化文本或稳定失败。生成的 Host 与 Client Remote 产物使用该包直接声明的 `zod` 依赖。

服务只接受同时提供的显式 `provider` 和 `model`，或两者均省略。半配置的路由会在构造时失败，不会静默选择会话或默认路由。

`@deepseek-ai/dsh-client-ui-prompt-optimizer` 通过 `conversation.input.model.tools` 列表 slot 提供 composer 按钮。成功响应仅在草稿仍等于请求文本时替换草稿，因此辅助请求期间的输入优先保留。carrier envelope 与被拒绝的传输 Promise 都会归并为不修改草稿的失败。

## Alternatives considered

**纯客户端改写。** 浏览器不拥有 LLM 路由，也不能追加所需的持久模型请求记录。

**ApiProxy 一元 RPC。** Typert Remote 让业务包贡献端点，无需扩展 gateway 的封闭 RPC 方法映射。

**复用 `conversation.input.right`。** 该 slot 位于模型选择器左侧；专用的伴随控件 slot 提供要求的位置，并保留现有命名 seat。

## Consequences

每次激活都会创建有界且独立记录的辅助请求。Web profile 挂载两个插件半边。按钮没有流式预览；当请求失败、响应过期或配置路由不可用时，当前草稿保持不变。
