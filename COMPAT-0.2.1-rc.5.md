# dsh-nord × dsh 0.2.1-rc.5 兼容性核查

- 审计对象：`dsh-nord` 0.4.2（本仓库工作树），原基线 dsh `0.2.1-rc.4`
- 目标版本：dsh `0.2.1-rc.5`（`D:\deepseek-harness` 标签 `dsh-v0.2.1-rc.5`；npm 的 `latest` 与 `next` 都指向此版本）
- 审计日期：2026-10-30
- 结论：**契约面未变，源码无需改动。** 这一版只有 3 个提交：一个整仓 `version` bump，和一个
  思考块（reasoning）渲染的改造。插件依赖的 12 个 `@deepseek-ai/dsh-*` 包里，11 个只有
  `package.json` 的版本号变化，第 12 个（`ui-chat`）根本不在依赖里。改动全部落在
  `conversation.chat.reasoning.body` 这条槽位上，而插件只站在 `settings.section` 与
  `conversation.composer.dock`。依赖基线已升到 `0.2.1-rc.5`。

---

## 1. 差异范围

`dsh-v0.2.1-rc.4..dsh-v0.2.1-rc.5` 只有 3 个提交（外加 rc.4 自己的发布 merge 落在这个区间里）：

```
b830ec950f  Merge pull request #7572 … worktree/release-dsh-0.2.1-rc.5
31cfe2aafe  release(dsh): 0.2.1-rc.5
534dac8c81  fix(web): customize thinking block rendering (#7484)
```

`git diff --stat` 报 368 个文件 / +529 −399，其中 **353 个是各包的 `package.json` 只动 `version` 一行**。
除版本行以外有过改动的文件一共 20 个，全部集中在 `ui-chat` 的思考块，外加两处跟着改的注释与文档：

| 文件 | 改动性质 |
|---|---|
| `ui-chat/src/client/reasoning-text.ts` | **新增**：`reasoningText()`，剥掉 `<signature>…</signature>` 头 |
| `ui-chat/src/client/chat/ReasoningRow.tsx` | 先算显示文本再渲染；整块只有签名时 `return null`；给 Body 槽位多传一个 `rawText` |
| `ui-chat/src/client/contract/slots.ts` | `ReasoningBodyOwnerProps` 从 `{text, running}` 变成 `{rawText, text, running}`；`ReasoningContentInput` 不再继承它（字段仍是 `{text, running, labels}`，结构未变） |
| `ui-chat/src/client/conversation-nodes/process-activity.ts` | 活动摘要里的思考文本也过一遍 `reasoningText()` |
| `ui-chat/src/client/chat/ReasoningContent.tsx` | 只改注释 |
| `ui-chat/tests/*`、`apps/web/tests/reasoning-preview.e2e.ts` | 跟随的规格 |
| `experimental/client-ui-cot-translation/**` | 只改注释（它是这条槽位的占用者，跟着改成「显示文本」措辞） |
| `extensions/cordis-client-runner/src/client/slot-catalog.ts` | 槽位目录的 `source:` 行号与文案同步，纯机械平移 |
| `ui-chat/README*.md`、`docs/upgrade-guide/v0.2.1-rc.4/reasoning-body-props/*` | 上游新增一篇升级指南 |

逐项看插件实际站在哪里（**全部零 diff**，不是「改动无害」，是根本没有改动）：

| 插件依赖 | rc.4 → rc.5 状态 |
|---|---|
| `ui-theme`（主题 token、`overrideTokens`） | **只有版本号**。`src/` 零 diff，`design-platform.css` 与 `base.css` 同样零 diff |
| `ui-settings`（`settings.section` 槽位） | **只有版本号**，`src/` 零 diff |
| `ui-slots` / `ui-renderer`（槽位出口、`div[data-slot]` 锚点） | **只有版本号**，`src/` 零 diff |
| `ui-session`（`useProjection` 座位） | **只有版本号**，`src/` 零 diff |
| `ui-conversation`（dock 槽位契约） | **只有版本号**，`src/` 零 diff |
| `ui-primitives`（`Switch` / `Input` / `Menu` / `useAnchoredPosition`） | **只有版本号**，`src/` 零 diff |
| `ui-locale` / `dsh-client-store` | **只有版本号** |
| `dsh-settings` / `dsh-credentials` / `dsh-host-webserver` | **只有版本号**（Host 三包零 diff，余额路由的 `webServer.register` 未变） |
| `vendor/cordis` 4.0.5 / `vendor/schemastery` 3.18.5 | 零 diff，版本号不变 |
| `ui-chat` | 有实质改动 —— **但它不是本插件的依赖**（连 devDependency 都没有） |

**上游升级指南**这一版只加了一篇 `reasoning-body-props`，讲的是「`text` 现在是显示文本、`rawText`
才是原始输出，自定义推理渲染器与翻译包装组件要按需改读 `rawText`」。本插件既没有注册
`conversation.chat.reasoning.body`，也没有调用 `conversation.chat.reasoning.content` 这个
Content Factory，**不适用**。

顺带记一笔为什么这条改动值得单看：`ReasoningBodyOwnerProps` 是 owner props，加一个必填字段
对上游自己是内部调整，对第三方是「读得到的字段变多」——只要实现方不自己重声明这个类型，
运行时不会坏。本插件连这个槽位都不碰，所以这一层讨论在本仓库里没有落点。

## 2. 验证记录

| 路 | 方法 | 结果 |
|---|---|---|
| 类型 | `npm run typecheck`（依赖已升到 `0.2.1-rc.5`） | 0 诊断 |
| 单测 | `npm test` | 38/38 |
| 构建 | `npm run build` | 通过；**五个产物逐字节未变**（`git status` 里 `lib/` 干净），`lib/client.js` 84.15 kB |
| 设置页探针 | `verify-settings.mjs`（本机 dsh 0.2.1-rc.5 + 隔离 `DSH_HOME` + headless Edge） | **全部通过**：左栏入口与顺序（账号与余额 / 通用设置 / 模型 / 内置插件 / Agent 预设 / Nord 主题）、通用已清空、独立页几何（高 553px、宽 564px、无滚动）、调色板图标（16×16、齿轮已藏）、页脚版本 0.4.2、字体委托（选择器 0 个、body 不是 Maple）、零 console 报错 |
| 接口探针 | `verify-compat.mjs`（同上） | 8/9：模块加载器、两枚插件样式表（2415B / 69B）、字体委托、明暗两套 token 各 9 项、dock 槽位与 `:has()` 规则、余额读数（CNY 42.50）、明细面板容器；**「用量信息」座位未渲染**——与 rc.4 同一处已知缺口（见 §3） |
| 对照 | rc.4 那一轮的同两路结果 | 逐项一致：设置页同样全过，接口探针同样是 8/9 且卡在同一条 |

`lib/` 逐字节相同这件事，比「类型通过」更能说明这一轮没动插件：`prepare` 与 `pretest` 各重建了
一次产物，两次都没有产生任何 diff。

## 3. 「用量信息」座位：rc.4 就有的老账，不是 rc.5 的差异

这一行只在会话的 `modelSelection` 投影带 provider 时出现，而空白会话的 `pending` / `lastUsed`
都是 `null`。隔离 home 里模型列表拿不到时，探针挑不到合格的夹具，这条断言就必然挂着。
机理与上一轮的排查过程见 [COMPAT-0.2.1-rc.4.md](./COMPAT-0.2.1-rc.4.md) §3，本轮没有变化，
也没有新增证据——它需要一条**真的发过请求**的会话做夹具，这件事仍然待办。

## 4. 已实施的工程动作

| 位置 | 改动 |
|---|---|
| `package.json` | devDependencies 里 **12 个** `@deepseek-ai/dsh-*` 从 `0.2.1-rc.4` → `0.2.1-rc.5`（`cordis` 4.0.5 / `schemastery` 3.18.5 不变，上游那两包零 diff）；重生成 `package-lock.json` |
| `README.md` / `README.en.md` | 支持的 dsh 与兼容性表更新到 `0.2.1-rc.5` |
| `DEVELOPMENT.md` | 「版本现实」基线改为 `0.2.1-rc.5`，兼容矩阵新增一行并记下这一轮的差异范围；补一条「升 rc 之前先删 `node_modules`」的坑 |
| `COMPAT-0.2.1-rc.4.md` | 顶部加一行指针，指向本文 |
| `CHANGELOG.md` | 「未发布」里记下这一轮 |

**新增一条工程坑（本轮实际踩到）**：rc.4 → rc.5 直接在旧 `node_modules` 上 `npm install` 会报
`ERESOLVE`——`dsh-settings@rc.5` 的 peer 是 `dsh-brand@0.2.1-rc.5`，而树里躺着的是 rc.4 的
`dsh-brand`（它是传递依赖，不在 `package.json` 里，npm 不会主动替它升级），于是解析器判成
「冲突」。上一轮 rc.2 → rc.4 没撞上只是运气。稳妥做法是先删 `node_modules` 与 `package-lock.json`
再装；`node_modules` 与 lock 都是可再生资产，删掉比 `--force` 干净。

## 5. 复现命令

```powershell
# 依赖与静态检查（rc.4 → rc.5 的 peer 解析要求先清树）
Remove-Item -Recurse -Force node_modules, package-lock.json
npm.cmd install --no-audit --no-fund --registry https://registry.npmjs.org/
npm.cmd run typecheck; npm.cmd test; npm.cmd run build
git status --short          # 期望只剩 package.json / package-lock.json

# 另一个版本并排装（装在仓库外，靠 DSH_BIN 切）
npm.cmd install --prefix D:\dsh-rc5 @deepseek-ai/dsh@0.2.1-rc.5 --no-audit --no-fund

# 两个探针（隔离 home + headless Edge + 本地余额 mock）
$env:HTTP_PROXY=''; $env:HTTPS_PROXY=''; $env:NO_PROXY='127.0.0.1,localhost,::1'
$env:DSH_BIN='D:\dsh-rc5\node_modules\.bin\dsh.cmd'
node scripts/shots/verify-compat.mjs
node scripts/shots/verify-settings.mjs
```

> 本机注意：`npm` 在 PowerShell 里解析到 `npm.ps1` shim，直接调用会静默退 1，用 `npm.cmd`。
> **不要用 `Move-Item` 搬 `.shot-lab`**：里面 `profiles/shots/node_modules/dsh-nord` 是指回仓库根
> 的 `link:` 联结点，`Move-Item` 会顺着它把整个仓库的文件搬进目标目录（本轮实测踩到，已全部
> 搬回）。清场的唯一验证过的方式是**让探针自己重建**：`lab.mjs` 的 `prepareHome()` 开头就
> `rmSync(LAB, { recursive: true })`，Node 的递归删除把联结点当符号链接处理，不会跟进去。
