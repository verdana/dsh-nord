# dsh-nord × dsh 0.2.2-rc.4 兼容性核查

- 审计对象：`dsh-nord` 0.4.4（本仓库工作树），原基线 dsh `0.2.2-rc.3`
- 目标版本：dsh `0.2.2-rc.4`（本机安装 `C:\Users\Verdana\scoop\persist\nodejs\bin\node_modules\@deepseek-ai\dsh`，`package.json` 版本行已是 `0.2.2-rc.4`）
- 审计日期：2026-11-18
- 结论：**契约面零变化，插件代码零改动**。rc.4 相对 rc.3 只有三类变化：全树包版本号与包间依赖号推进；LLM 错误码表新增一枚 `CONTENT_REFUSED`（并出现在三个内联了该表的包里）；构建戳字符串随版本号更新。插件站的四个契约面（primitives 导出、dock 槽位声明与出口、槽位运行时、`overrideTokens`）与前端壳模块表逐字节相同。devDependencies 已升到 `0.2.2-rc.4`，构建、类型检查与 38 项单测全绿。

| # | 变化 | 对插件的影响 | 处理 |
|---|---|---|---|
| 1 | 323 个包的 `version` 与包间依赖号 `0.2.2-rc.3` → `0.2.2-rc.4` | peer 声明跟着推进（`dsh-settings` 的 peer 变为同版本 `dsh-brand` / `dsh-session`），安装期无 `ERESOLVE` | devDependencies 14 项同步升到 `0.2.2-rc.4` |
| 2 | LLM 错误码新增 `CONTENT_REFUSED`（`dsh-llm` 的 `src/error.ts` / `lib/index.js` / `lib/types/error.*`，另在 `dsh-repeat-tool-reminder` / `dsh-session-persistence-jsonl` / `dsh-tmux-context` 的内联副本里各加一行） | 无。插件不消费任何 LLM 错误码（`src/` 里 grep `MALFORMED_RESPONSE` / `CONTENT_REFUSED` 无命中） | 无代码改动 |
| 3 | 浏览器包里的构建戳字符串：`dsh-client-ui-settings-account` 的 `clientMetadata(locale, …)` 与 `dsh-client-ui-settings-general` / `dsh-client-ui-sidebar` 的 `localBuildVersion()`，以及 `dsh-client-modules` 内嵌的 `commit` 常量（`6b729fe` → `70005a5`） | 无。把版本串归一化后三个 bundle 与 rc.3 逐字节相等 | 无代码改动 |
| 4 | `dsh-experimental-liveshare` 的 `src/host/tunnel-worker.ts` 新增 `workerNodeModeEnv()`，把 `ELECTRON_RUN_AS_NODE` 透传给 worker | 无。桌面壳的 worker 启动修复，与 web 宿主及本插件无关 | 无代码改动 |
| 5 | CLI 包新增 `docs/upgrade-guide/v0.2.2-rc.3/deepseek-refusal-code/{guide.md,guide.zh.md}`，`docs/upgrade-guide/README.md` 补一节 | 说明第 2 条的动机：DeepSeek 以 `stop_reason:"refusal"` 结束流时错误码由 `MALFORMED_RESPONSE` 改为 `CONTENT_REFUSED` | 文档记录，不改代码 |

## 1. 差异范围

比对方法：先用 `npm pack` 把安装树里 323 个 `@deepseek-ai/*` 包的 `0.2.2-rc.3` tarball 全部取到 `D:\dsh-nord\.compat\rc3all\x\`（`--cache D:/dsh-nord/.npmcache`，默认 npm cache 在 scoop 目录不可写），再与安装树的 rc.4 逐文件算 SHA-256，排除 `.map` 与包内自带的 `node_modules`。另外单独比了 CLI 包自身（523/525 个文件）与前端壳 `dsh-web-frontend`（100 个文件）。

323 个包里有 9 个存在 `package.json` 以外的差异，全部在上面表里：

| 包 | 变化文件 |
|---|---|
| `dsh-llm` | `lib/index.js`、`lib/types/error.d.ts`、`lib/types/error.js`、`src/error.ts`（各 +1 行 `CONTENT_REFUSED`） |
| `dsh-repeat-tool-reminder` | `lib/index.js`（内联错误表 +1 行） |
| `dsh-session-persistence-jsonl` | `lib/worker.cjs`（内联错误表 +1 行） |
| `dsh-tmux-context` | `lib/index.js`（内联错误表 +1 行） |
| `dsh-client-ui-settings-account` | `lib/client.js`（`0.2.2-rc.3` → `0.2.2-rc.4` 两处字符串） |
| `dsh-client-ui-settings-general` | `lib/client.js`（同上，一处） |
| `dsh-client-ui-sidebar` | `lib/client.js`（`localBuildVersion()` 的 `0.2.2-rc.3-6b729fe` → `0.2.2-rc.4-70005a5`） |
| `dsh-client-modules` | `lib/index.js`（`commit` 常量 `6b729fe` → `70005a5`） |
| `dsh-experimental-liveshare` | `src/host/tunnel-worker.ts`（`workerNodeModeEnv`） |

其余 314 个包只有 `package.json` 在变（`version` 与包间依赖号）。`cordis`（4.1.0）、`schemastery`（3.19.0）、`cosmokit`（1.9.0）三个不跟 dsh 版本号走的包逐字节相同。

前端壳没有换模块表：rc.4 的 `dist/assets/index-Ciz7DZxv.js` 与 rc.3 **同名同字节**，仍逐个提供 `react`、`react/jsx-runtime`、`react-dom`、`react-dom/client`、`@deepseek-ai/cordis`、`dsh-client-store`、`dsh-client-ui-slots` / `-primitives` / `-renderer` / `-dockkit`，插件的 `lib/client.js`（cjs，externals 走这张表）照旧能解析。

上面 9 个包的字节差异都做过归一化复核：把版本串替换回 rc.3、或把 `commit` 常量换成 rc.3 的值 / 删掉新增的 `CONTENT_REFUSED` 那一行后，文件与 rc.3 **逐字节相等**——即差异全部是这几类，没有夹带别的改动。

## 2. 受影响的接口与行为

无。逐条对过 rc.3 快照与 rc.4 安装树：

| 面 | 观察 | 结论 |
|---|---|---|
| `dsh-client-ui-primitives` 导出表 | 319 个文件除 `package.json` 外哈希相同（`useAnchoredMaxHeight` / `useDismissOnOutsidePointer` / `Switch` / `Input` / `Menu` 都在） | 未变 |
| `dsh-client-ui-conversation` 的 `conversation.composer.dock` 槽位声明与出口 | 196 个文件哈希相同 | 未变 |
| `dsh-client-ui-renderer` 的槽位运行时（`runInject` 按位置传参、`standardKit()`） | 文件哈希相同 | 未变 |
| `dsh-client-ui-theme` 的 `overrideTokens` | 62 个文件哈希相同 | 未变 |
| Host 侧：`webServer.register` / `credentialRef` / `settings.configure` | `dsh-host-webserver`、`dsh-credentials`、`dsh-settings` 只有 `package.json` 在变 | 未变 |

## 3. 验证记录

本机 Windows / Node 26，devDependencies 全线 `0.2.2-rc.4` 之后：

- `npm install`：`changed 29 packages`，无 `ERESOLVE`，`node_modules/@deepseek-ai/` 下 14 个包版本为 `0.2.2-rc.4`；`package-lock.json` 中 `0.2.2-rc.4` 出现 69 处、`0.2.2-rc.3` 0 处。
- `npm run build`（tsdown）：绿。`lib/client.js` 91.42 kB / gzip 26.75 kB，ESM 4 files 55.07 kB（与 rc.3 上的产物同尺寸，符合「源码未变」）。
- `npx tsc -p tsconfig.json`：退出码 0。
- `node --test --experimental-test-isolation=none "tests/*.test.mjs"`：**38 pass / 0 fail**。（默认隔离模式要 spawn 子进程，本机沙箱拒绝并抛 `EPERM`；`--experimental-test-isolation=none` 在同进程里跑的是同一批用例。）
- 运行中的宿主就是 rc.4，且已装载本插件：`GET http://127.0.0.1:3080/nord/balance` → `200`，正文 `{"currency":"CNY","total":"6.77","granted":"0.00","toppedUp":"6.77","available":true,...}`。Host 半边的 `webServer.register` + `credentialRef` 链路照常工作。
- 浏览器半边没有重跑 `scripts/shots/verify-compat.mjs`：探针要用隔离 home 起一个临时 dsh（`scripts/shots/lab.mjs` 里的 `spawn`），本机沙箱禁止子进程 spawn（`EPERM`）；`GET /` 与 `/api/plugins` 需要 web token（`401 dsh web authentication required`），拿不到就不猜。所以 rc.4 的浏览器侧结论由两段拼成：rc.2 的实机结果 + 「rc.4 与 rc.3 的浏览器代码逐字节相同」。
- 升级前 rc.3 基线同样绿（38 pass / 0 fail、`tsc` 退出码 0），差异只来自版本推进。

## 4. 处置

- `devDependencies` 从 `0.2.2-rc.3` 升到 `0.2.2-rc.4`（14 个包一起动，避免混版本 peer）。
- 插件代码、样式、设置 schema 均无需改动。
- README / README.en / DEVELOPMENT 的构建基线改写为 `0.2.2-rc.4`。
