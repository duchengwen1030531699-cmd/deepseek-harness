---
description: "DeepSeek 部署的侧栏账户余额读出口；由 Host 查询余额，浏览器不会取得 API 密钥。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-balance

[English](README.md) | 中文

## 概述

本包在侧栏底部添加余额条。它显示简要账户余额、打开详情面板并支持手动刷新。Host 解析 `DEEPSEEK_API_KEY` 并调用 DeepSeek 余额接口，因此浏览器只收到清洗后的结果而不会取得凭据。适用于需要快速查看余额的 Web 部署；显示值不是账单记录。

## 目录

- [使用此包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [延伸阅读](#further-exploration)
- [模型体验](#model-experience)
- [已知限制和延后工作](#known-limitations-and-deferred-work)
- [开发者注记](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

将本包加入同时提供 `webServer`、`credentials`、侧栏和客户端渲染器的 Web bundle。随附的 Web patch 将它挂载为 `ui-balance`；浏览器请求余额时它读取 `DEEPSEEK_API_KEY`，未配置密钥时返回错误视图。

### Configure refresh behavior

插件接受 `baseUrl` 和 `refreshIntervalSeconds`。健康结果默认缓存 30 秒；刷新操作会绕过缓存。浏览器使用 `/api/balance` 获取普通更新，使用 `/api/balance/refresh` 强制更新。

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>实现细节 — 点击展开</summary>

Host 半拥有 `BalanceReader`，它为每次查询解析凭据、验证提供商响应、合并并发请求并注册两条精确 Web 路由。Client 半占用 `sidebar.footer.action`，并为该部署遮蔽可选的 Cordis 控制器单元。注册代码见 [`src/index.ts`](src/index.ts) 和 [`src/client/index.ts`](src/client/index.ts)。

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [ui-sidebar](../ui-sidebar/README.zh.md) — 声明并渲染侧栏底部操作槽位。
- [credentials](../../credentials/credentials/README.zh.md) — 解析 Host 持有的 API 密钥。
- [webserver](../../host/webserver/README.zh.md) — 拥有 HTTP 路由表。

-----

<a id="model-experience"></a>
## Model Experience

### Balance readout

#### What the model sees

`BalanceReader` 不会把任何内容送入模型请求；本包只注册浏览器展示和 Host HTTP 路由。

#### Token effect

无；余额视图不写入会话历史，也不参与提示词组装。

#### KV Cache effect

无；本包不贡献提供商请求内容。

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

该读出口是便捷展示面，Host API 保持最小范围。

- **非实时** — 提供商数值和健康结果缓存都可能滞后于计费。
- **凭据名称固定** — Host 只解析 `DEEPSEEK_API_KEY`。
- **全部署侧栏底部替换** — 挂载本包期间会隐藏 `cordis-panel` 底部单元。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文 — 点击展开</summary>

None.

</details>
