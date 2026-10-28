# dsh-nord × dsh 0.2.1-rc.4 兼容性核查

- 审计对象：`dsh-nord` 0.4.1（本仓库工作树），原基线 dsh `0.2.1-rc.2`
- 目标版本：dsh `0.2.1-rc.4`（`D:\deepseek-harness` 标签 `dsh-v0.2.1-rc.4`；npm `next` 指向此版本）
- 审计日期：2026-10-28
- 结论：**契约面未变，源码无需改动。** 插件依赖的 13 个 `@deepseek-ai` 包里，10 个只有
  `package.json` 的版本号变化；有实质改动的两处（`ui-conversation`、`ui-primitives`）都是
  新增，插件的调用面一个都没动。依赖基线已升到 `0.2.1-rc.4`。

---

## 1. 差异范围

`dsh-v0.2.1-rc.2..dsh-v0.2.1-rc.4` 共 15 个提交（rc.2→rc.3 六个、rc.3→rc.4 九个），
绝大多数文件只是 monorepo 各包的 `version` 字段 bump。

| 插件依赖 | rc.2 → rc.4 状态 |
|---|---|
| `ui-theme`（主题 token、`overrideTokens`） | **只有版本号**。`design-platform.css` 与 `base.css` 零 diff，插件覆盖的 132 个 token 名全部仍被定义 |
| `ui-settings`（`settings.section` 槽位） | **只有版本号** |
| `ui-slots` / `ui-renderer`（槽位出口、`div[data-slot]` 锚点） | **只有版本号**（出口的 `display: contents` 内联样式照旧） |
| `ui-session`（`useProjection` 座位） | **只有版本号** |
| `ui-locale` / `dsh-client-store` | **只有版本号** |
| `dsh-settings` / `dsh-credentials` / `dsh-host-webserver` | **只有版本号**（Host 三包零 diff） |
| `ui-chat`（dock 出厂条目） | **只有版本号**（`activity` / `usage` 两个 pill 的顺序未变） |
| `ui-conversation` | 有实质改动，**全部是新增**：新槽位 `conversation.session.header.views.actions`、标题栏 tab 行改成可换行 + 「更多」菜单、输入框草稿的 `whenDraftExists` |
| `ui-primitives` | 有实质改动，**全部是新增**：`MenuItemButton` 多一个 `current`（`aria-current`）、`Menu` 多一个 `minWidthFromAnchor`（默认关）、Tooltip 定位抽成独立模块、新增 `IconAppsAdd*` |
| `vendor/cordis` 4.0.5 / `vendor/schemastery` 3.18.5 | 零 diff，版本号不变 |

逐项看插件实际站在哪里：

- **dock 槽位**：`conversation.composer.dock` 契约与 `.dock` 样式零 diff；标题栏那批改动
  （tab 行换行、More 菜单）落在会话 header，与 composer 下方那行无关。
- **设置页**：`settings.section` 槽位零 diff，`ui-settings` 整包只有版本号变化。
  插件用的是 `Switch` / `Input` / `Menu`，其中 `Menu` 的两处变化都是可选参数。
- **主题层**：`ctx.theme.overrideTokens()` 与 `ThemePresenter` 写 body 内联样式的路径未变。
- **字体层**：插件在 0.2.1 起本来就整体让位，不写任何字体 token；`base.css` 的 body 级
  声明也零 diff。
- **余额路由**：`webServer.register` 未变。

**上游升级指南**（rc.3 六篇 + rc.4 一篇）逐条映射后均不适用：`independent-session-forks`、
`session-follow-activation`、`generated-worktree-names`、`attachment-read-access`、
`ptc-caller-cancellation`、`cua-bundle-id-consent`、`model-listing-refresh` —— 插件既不碰
分叉与会话跟随，也没有模型列表缓存的持有者，更不调附件读取。

## 2. 验证记录

| 路 | 方法 | 结果 |
|---|---|---|
| 类型 | `npm run typecheck`（依赖已升到 `0.2.1-rc.4`） | 0 诊断 |
| 单测 | `npm test` | 38/38（含新增的 `npm pack --json` 解析规格） |
| 构建 | `npm run build` | 通过，`lib/client.js` 84.15 kB |
| 设置页探针 | `verify-settings.mjs`（本机 dsh 0.2.1-rc.4 + 隔离 `DSH_HOME` + headless Edge） | **全部通过**：左栏入口与顺序、通用已清空、独立页几何、调色板图标、页脚版本、字体委托（选择器 0 个、body 不是 Maple）、零 console 报错 |
| 接口探针 | `verify-compat.mjs`（同上） | 8/9 通过：模块加载器、两枚插件样式表、字体委托、明暗两套 token 各 9 项、dock 槽位与 `:has()` 规则、余额读数、明细面板容器；**「用量信息」座位未渲染**（见 §3） |
| 对照 | 同一探针在 `0.2.1-rc.2`（npm 另装一份）上跑 | **与 rc.4 完全一致**：同一步、同一句失败 —— 说明这不是 rc.4 的差异 |

## 3. 「用量信息」座位为什么没渲染（**不是** rc.4 的问题）

这一行只在会话的 `modelSelection` 投影有 provider 时出现。投影的 `next` 是
`pending ?? lastUsed`（`session-controller/src/model-selection-projection.ts` 的 `wire.view`），
而**新建的空白会话两者都是 `null`** —— 拿它当夹具，这道断言必然失败。

探针原来的夹具挑选只要求「会话文件 + 投影缓存都在」，于是可能选中一条从未发过请求的会话
（本机 55 份投影缓存里就有 `lastUsed: null` 的空白会话）。在 `0.2.1-rc.2` 上跑同一份探针
得到一模一样的失败，可确认与 rc.4 无关。

这一轮修掉了两处探针缺陷（都与 dsh 版本无关，是 0.4.1 之后没再跑探针留下的账）：

1. **token 抽样表过期。** `TOKENS` 里 `--dsw-alias-label-tertiary`（暗色 `#7B88A1`）与
   `--dsw-alias-state-error-primary`（`#BF616A`）停留在 0.4.1 之前的值；0.4.1 已把前者提亮到
   `#8E9AAD`、把后者改成 `color-mix()`。现已同步（error 那条按计算样式的原文比对，因为自定义
   属性保留声明文本而不是解析后的颜色）。
2. **夹具挑选优先「跑过的会话」。** 现在先按投影缓存里的 `rows.modelSelection.val.lastUsed`
   筛一遍，空白会话只作为兜底。

改完之后 token 抽样与其余各项全绿；「用量信息」那座座位在现有夹具上仍然不渲染，需要一条
**真的发过请求**的会话（外网凭据被隔离 home 挡住时它也不会出现）。这条断言目前挂着，与
dsh 版本无关，等专用夹具补上再收紧。

## 4. 已实施的工程动作

| 位置 | 改动 |
|---|---|
| `package.json` | devDependencies 13 项 `0.2.1-rc.2` → `0.2.1-rc.4`（cordis / schemastery 不变，上游那两包零 diff）；重生成 `package-lock.json` |
| `README.md` / `README.en.md` | 支持的 dsh 与兼容性表更新到 `0.2.1-rc.4` |
| `DEVELOPMENT.md` | 「版本现实」基线改为 `0.2.1-rc.4`，兼容矩阵新增一行并记下这一轮的差异范围 |
| `scripts/shots/verify-compat.mjs` | 见 §3 的两处修正 |
| `CHANGELOG.md` | 「未发布」里记下这一轮 |

## 5. 复现命令

```powershell
# 依赖与静态检查
npm.cmd install --no-audit --no-fund --registry https://registry.npmjs.org/
npm.cmd run typecheck; npm.cmd test

# 真实 shell 上的两个探针（隔离 home + headless Edge + 本地余额 mock）
$env:HTTP_PROXY=''; $env:HTTPS_PROXY=''; $env:NO_PROXY='127.0.0.1,localhost,::1'
node scripts/shots/verify-settings.mjs
node scripts/shots/verify-compat.mjs

# 对照一个旧版本（装在仓库外，靠 DSH_BIN 切）
npm.cmd install --prefix D:\dsh-rc2 @deepseek-ai/dsh@0.2.1-rc.2 --no-audit --no-fund
$env:DSH_BIN='D:\dsh-rc2\node_modules\.bin\dsh.cmd'; node scripts/shots/verify-compat.mjs
```

> 本机注意：`npm` 在这个 PowerShell 会话里解析到 `npm.ps1` shim，直接调用会静默退出 1，
> 用 `npm.cmd`。探针重跑前把 `.shot-lab` 整目录挪走，否则 `--from-default-profile` 的
> 目录替换在 Windows 上会撞 `EPERM`。
