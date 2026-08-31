# Agent Note: 静态侧栏余额读出口

Status: implemented

[English](2026-08-14-static-sidebar-balance-readout.md) | 中文

## 问题

Web 客户端需要一个在页面刷新后仍存在的侧栏余额读出口。浏览器界面不能读取 DeepSeek API 密钥，并且该部署不需要在同一侧栏底部区域显示 Cordis 控制器。

## 决策

`@deepseek-ai/dsh-client-ui-balance` 是一个双半 Web 包。它的 Host 半为每次请求解析 `DEEPSEEK_API_KEY`，通过 `BalanceReader` 查询提供商，并通过 `/api/balance` 与 `/api/balance/refresh` 提供清洗后的结果。

它的 Client 半在 `sidebar.footer.action` 注册余额条，并在包挂载期间遮蔽 `cordis-panel` 占用者。Web bundle 将该包作为 `ui-balance` 组合。

## 考虑过的替代方案

**由浏览器直接请求提供商。** 不采用，因为浏览器不能取得 API 密钥。

**让 Cordis 控制器与余额条并列。** 不采用，因为该部署只把侧栏底部用于余额表面；槽位遮蔽属于本包，并会在释放时结束。

## 后果

余额表面能跨刷新存在，并且只接收清洗后的结果。数值是经过缓存的提供商参考而不是账单来源；使用这一 Web 组合的所有会话都会隐藏控制器单元。

Host 和 Client 测试覆盖读取器缓存、路由释放、渲染和刷新行为。
