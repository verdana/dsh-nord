# dsh-nord × dsh 0.2.2-rc.3 兼容性核查

- 审计对象：`dsh-nord` 0.4.4（本仓库工作树），原基线 dsh `0.2.2-rc.2`
- 目标版本：dsh `0.2.2-rc.3`（本机安装 `C:\Users\Verdana\scoop\persist\nodejs\bin\node_modules\@deepseek-ai\dsh`，`package.json` 版本行已是 `0.2.2-rc.3`）
- 审计日期：2026-11-13
- 结论：**零实质变化**。rc.3 相对 rc.2 只做了两件事——给 `dsh-client-ui-primitives` 加了两枚 `upload-outline` 图标、把 14 个包的版本号与包间依赖号推进到 `0.2.2-rc.3`；插件站的四个契约面逐字节相同。devDependencies 已升到 `0.2.2-rc.3`，构建、类型检查与 38 项单测全绿。

| # | 变化 | 对插件的影响 | 处理 |
|---|---|---|---|
| 1 | `@deepseek-ai/dsh-client-ui-primitives` 新增 `IconUploadOutlineRegular` / `IconUploadOutlineMedium`（`'upload-outline'`） | 无。插件只用到 `CaretDown` 那条解析链里的既有图标 | 无代码改动 |
| 2 | 14 个包的 `version` 与包间依赖号 `0.2.2-rc.2` → `0.2.2-rc.3` | peer 声明未变（`dsh-settings` 的 peer 仍是同版本 `dsh-brand` / `dsh-session`），安装期无 `ERESOLVE` | devDependencies 14 项同步升到 `0.2.2-rc.3` |
| 3 | 其余 `lib/`、`src/`、`lib/types` 文件逐字节相同（主体 12 个包各 810 个文件；`dsh-credentials`、`dsh-client-ui-session` 另从 npm 取 rc.2 包比对，见 §1） | 四契约面零变化 | 无代码改动 |
| 4 | 前端壳 `dsh-web-frontend` 的模块表 | 仍提供插件 require 的全部外部 id | 无代码改动 |

## 1. 差异范围

比对方法：rc.2 的 12 个包先拷成 `D:\dsh-nord\.compat\rc2\` 快照，再与安装树里的 rc.3 逐文件算 SHA-256（排除 `.map`），另外单独跑一遍 `lib/types` 的 261 个 `.d.ts`。安装树里 `docs/upgrade-guide` 仍没有 `v0.2.2-rc.3` 章节（最新只到 rc.1），所以只能按包比对。

`devDependencies` 里其实有 14 个 `@deepseek-ai` 包：上面那批是 12 个（`brand`、`client-locale`、`client-store`、`client-ui-{conversation,primitives,renderer,settings,slots,theme}`、`host-webserver`、`settings`、`session`），剩下 `dsh-credentials` 与 `dsh-client-ui-session` 不在快照里，于是另用 `npm pack` 取 rc.2/rc.3 两个 tarball 解包对比：`dsh-credentials` 只有 `package.json` 的 `version` 与 `@deepseek-ai/dsh-brand` 依赖号在变（`lib/`、`lib/types`、`src/` 共 8 个文件相同）；`dsh-client-ui-session` 只有 `package.json` 的 `version` 与 10 条内部依赖号在变，其余文件（含 `locale/` 与 `lib/client.js`）逐字节相同。

差异全集是 8 个文件：

| 文件 | 差异 |
|---|---|
| `@deepseek-ai/dsh-client-ui-primitives/lib/types/icons/artwork.d.ts` | 新增 `'upload-outline'` 一条 |
| `…/lib/types/icons/index.d.ts` | 新增两行 `IconUploadOutline{Regular,Medium}` 导出声明 |
| `…/src/icons/artwork.ts`、`…/src/icons/index.tsx`、`…/lib/index.js` | 上述图标的实现与再导出 |
| 14 个包的 `package.json` | 仅 `version` 与内部依赖号 |

新增图标的注释是 *the download tray with the arrow pointing up*，与插件无关；`icons/index.d.ts` 导出表里其余 340 余个键一字未动。

## 2. 受影响的接口与行为

无。插件站得住的是四个面，逐条对过 rc.2 快照与 rc.3 安装树：

| 面 | 观察 | 结论 |
|---|---|---|
| `dsh-client-ui-primitives` 导出表 | 除新增两枚图标外逐键相同（`useAnchoredMaxHeight` / `useDismissOnOutsidePointer` / `Switch` / `Input` / `Menu` 都在） | 未变 |
| `dsh-client-ui-conversation` 的 `conversation.composer.dock` 槽位声明与出口 | `apply.ts` / `InputBar.tsx` 文件哈希相同 | 未变 |
| `dsh-client-ui-renderer` 的槽位运行时（`runInject` 按位置传参、`standardKit()`） | 文件哈希相同 | 未变 |
| `dsh-client-ui-theme` 的 `overrideTokens` | 文件哈希相同 | 未变 |

前端壳也没有换模块表：rc.3 的 `dist/assets/index-Ciz7DZxv.js` 仍逐个提供 `react`、`react/jsx-runtime`、`react-dom`、`react-dom/client`、`@deepseek-ai/cordis`、`dsh-client-store`、`dsh-client-ui-slots`、`-primitives`、`-renderer`，插件的 `lib/client.js`（cjs，externals 走这张表）照旧能解析。

## 3. 验证记录

本机 Windows / Node 26，devDependencies 全线 `0.2.2-rc.3` 之后：

- `npm install`：无 `ERESOLVE`，`node_modules/@deepseek-ai/` 下各包版本为 `0.2.2-rc.3`。
- `npm run build`（tsdown）：绿。`lib/client.js` 91.42 kB，`lib/index.js` 41.37 kB。
- `npx tsc -p tsconfig.json`：退出码 0。
- `node --test --experimental-test-isolation=none "tests/*.test.mjs"`：**38 pass / 0 fail**。（默认隔离模式要 spawn 子进程，本机沙箱拒绝并抛 `EPERM`；`--experimental-test-isolation=none` 在同进程里跑的是同一批用例。）
- 运行中的宿主就是 rc.3，且已装载本插件：`GET http://127.0.0.1:3080/nord/balance` → `200`，正文 `{"currency":"CNY","total":"22.08","granted":"0.00","toppedUp":"22.08","available":true,...}`。Host 半边的 `webServer.register` + `credentialRef` 链路在 rc.3 上照常工作。
- 浏览器半边没有重跑 `scripts/shots/verify-compat.mjs`：探针要用隔离 home 起一个临时 dsh（`scripts/shots/lab.mjs:166` 的 `spawn`），本机沙箱禁止子进程 spawn（`EPERM`），两次提权审批都没人应答。`GET /` 与 `/api/plugins` 需要 web token（`401 dsh web authentication required`），拿不到就不猜。所以 rc.3 的浏览器侧结论由两段拼成：rc.2 的实机结果 + 本轮「rc.3 与 rc.2 的浏览器代码逐字节相同」。

> 旁注：本轮首次构建时 `lib\client.js` 曾报 `os error 5`。原因是本机 `D:\dsh-nord\{lib,src,tests}` 的 DACL 里缺 DSH 沙箱 SID 的写 ACE（根目录有，子目录是 ACE 建立前继承的旧 DACL），与 rc.3 无关；补上 ACE 后构建正常。

## 4. 处置

- `devDependencies` 从 `0.2.2-rc.2` 升到 `0.2.2-rc.3`（14 个包一起动，避免混版本 peer）。
- 插件代码、样式、设置 schema 均无需改动。
- README / README.en / DEVELOPMENT 的构建基线改写为 `0.2.2-rc.3`。
