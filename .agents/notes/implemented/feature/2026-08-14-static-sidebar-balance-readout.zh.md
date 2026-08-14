# Agent Note: 侧栏静态余额读出口（刷新后仍生效）

Status: implemented

[English](2026-08-14-static-sidebar-balance-readout.md) | 中文

## 问题

动态 Cordis 插件的 Client 半在页面刷新后不自动恢复（设计使然："a refresh starts clean"），因此此前用动态插件实现的侧栏余额条与控制器遮蔽每次刷新都失效；同时用户不再需要侧栏的动态插件控制器（`cordis-panel`）。需要把余额读出口固化为静态 web 客户端插件，使余额条与控制器遮蔽随每次页面启动自动生效。

## 决策

**新增静态双半包 `packages/client/ui-balance`（`@deepseek-ai/dsh-client-ui-balance`）。** 节点半（`src/index.ts`）通过 credentials 通道按次解析 `DEEPSEEK_API_KEY`，以 `redirect: 'error'` 调用官方 Get User Balance 接口，经两条精确 webServer 路由（`/api/balance`、`/api/balance/refresh`）对外提供清洗后的视图；密钥不离开 Host，余额非实时且标注"仅供参考"。浏览器半（`src/client/`）在 `sidebar.footer.action` 注册常驻余额条（宽栏 `余额 ¥136.33`、窄栏 `¥`），点击展开详情面板（总/充值/赠送/状态/更新时间 + 原地刷新），并以 `priority: -1` 遮蔽内置 `cordis-panel` 单元格（最低优先级渲染；同优先级重复注册会抛错）。

**装配面与先例对齐。** 加入 `dsh.client` roster（`cordis.patch.yml`）、web-app 依赖、client 聚合引用；双半包在 host 聚合中通过 `tsconfig.host.json` 引用参与类型检查（与 `api/gateway`、`api/remotes` 的双面包引用一致）。Host 查询逻辑抽为 `BalanceReader`（缓存 30s、错误视图不复用、并发去重），与路由注册分离，单元与组件测试覆盖到 100%（防御性分支按规范加 v8 ignore）。

## 曾考虑的替代方案

**继续用动态插件。** 不采用：动态 Client 半按设计不跨刷新存活，无法满足"刷新后仍生效"。

**修改部署组合移除 `ui-cordis`。** 不采用：全局禁用整个扩展影响面过大；用空组件遮蔽其单元格既满足需求又可逆（卸载本包即还原）。

## 后果

使用该 bundle 的部署在每次页面启动时自动显示侧栏余额条，控制器单元格被空组件取代（审批仍以会话内卡片呈现，这是全部署级效果，已在 README Known Limitations 记录）。本包不写会话事件、不产生模型可见输入、无 KV 缓存影响。
