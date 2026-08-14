# @deepseek-ai/dsh-client-ui-balance

[English](README.md) | 中文

侧栏账户余额读出口：侧栏底部常驻一条余额条（宽侧栏显示 `余额 ¥136.33`，窄栏显示 `¥`），点击展开详情面板 —— 总余额 / 充值余额 / 赠送余额 / 账户可用状态 / 更新时间，以及一个原地刷新的按钮。

**密钥始终留在 Host 侧。** 浏览器半只请求两条精确 webServer 路由（`/api/balance`、`/api/balance/refresh`）；节点半在每次查询时通过 credentials 通道解析 `DEEPSEEK_API_KEY`，以 `redirect: 'error'` 调用官方 [查询余额](https://api-docs.deepseek.com/zh-cn/api/get-user-balance/) 接口（重定向不会携带凭据）。读出口只拿到清洗后的视图（`fetchedAt`、`available`、`total`、各币种明细，或错误信息）。

**读出口是参考值，不是账单。** 余额接口并非实时，面板明确标注"非实时，仅供参考"；查询失败或未配置时降级为错误标记（`余额 ?`），不阻塞任何主流程。

**插件控制器单元格被有意遮蔽。** 内置的 `cordis-panel`（动态插件控制器）单元格通过更低的遮蔽优先级被替换为空组件，因为余额条是本部署侧栏底部唯一期望的表面；移除该注册即可一键还原。

## Model Experience

无模型可见影响：本包不增加任何提示词内容、不注册工具、不写入任何会话事件。浏览器读出口渲染 Host 通过两条精确 HTTP 路由提供的 JSON，节点半的提供商查询是 Host 侧副作用，从不进入会话日志。

#### KV Cache effect

无：本包不产生任何提示词输入。

## Known Limitations and Deferred Work

- **路由是未认证的同源只读接口** —— 任何能被 web 服务器接到的请求都可以查询；部署的 trusted-host/网络策略是唯一闸门。返回的是余额视图，绝不是 API Key；按请求鉴权留待后续。
- **余额非实时** —— 提供商自身的数字滞后于计费，节点半还额外缓存健康视图 30 秒（可通过 `refreshIntervalSeconds` 配置）；面板对两者均有说明。
- **不展示费用** —— 余额条只报告账户余额；把会话 token 用量换算为估算花费不在本包范围内。
- **控制器遮蔽是全部署生效的** —— 替换 `cordis-panel` 单元格后，使用该 bundle 的所有会话都看不到动态插件清单/审批表面（审批仍以会话内卡片呈现）；遮蔽仅在本包挂载期间存在。
- **凭据引用固定** —— 按名字 `DEEPSEEK_API_KEY` 解析；可配置引用留待后续。
