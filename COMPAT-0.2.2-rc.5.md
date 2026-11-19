# dsh-nord × dsh 0.2.2-rc.5 兼容性核查

- 审计对象：`dsh-nord` 0.4.4（本仓库工作树），原基线 dsh `0.2.2-rc.4`
- 目标版本：dsh `0.2.2-rc.5`（本机安装 `C:\\Users\\Verdana\\scoop\\persist\\nodejs\\bin\\node_modules\\@deepseek-ai\\dsh`，`package.json` 版本行已是 `0.2.2-rc.5`）
- 审计日期：2026-11-19
- 结论：**契约面零变化，插件代码零改动**。rc.5 是 `web_search` 默认 provider 的功能轮：base 组合不再钉 `searchProvider: deepseek-search-api`，改由 `dsh-web` 在运行期按模型路由选（DeepSeek 路由 `deepseek-official` / `deepseek-account` 走 Messages 搜索，DeepSeek 不计次费；其余路由与模型请求之外走 Search API）；`WebSearchRequest` 增一枚可选 `llmProvider`；设置页的 Web Search 卡在 Automatic 选择下显示 Host 实际运行的 provider。插件既不注册也不调用 search provider（`ctx.web` 完全没碰），四个契约面（primitives 导出、dock 槽位声明与出口、槽位运行时、`overrideTokens`）与前端壳 `dist`（155 个文件）逐字节相同。devDependencies 已升到 `0.2.2-rc.5`，构建、类型检查与 38 项单测全绿。

| # | 变化 | 对插件的影响 | 处理 |
|---|---|---|---|
| 1 | 380 个包的 `version` 推进到 `0.2.2-rc.5`，每个 `package.json` 只改这一行（380 增 / 380 删，包间依赖号与 peer 声明零变化） | 无。peer 不随本轮变动，安装期无 `ERESOLVE` | devDependencies 14 项同步升到 `0.2.2-rc.5` |
| 2 | `packages/bundle/base/cordis.patch.yml` 删掉 `- id: web` 的 `config.searchProvider: deepseek-search-api`（保留 `fetchProvider: http`） | 无。这是 `web_search` 的默认 provider 选择，插件不注册 search provider，也不调用 `ctx.web` | 无代码改动 |
| 3 | `dsh-web` 的 `src/index.ts`：未配置 `searchProvider` 时先按请求的 `llmProvider` 选 `preferredId`——DeepSeek 路由用 `deepseek-official`，其余路由与模型请求之外用 `deepseek-search-api`；`resolveProvider` 增加可选 `preferredId`；`src/types.ts` 给 `WebSearchRequest` 增 `readonly llmProvider?: string` | 无。选 provider 的四类旧规则（configured 命中 / configured 缺失 / 唯一可用 / 多可用歧义）原样保留，新增的只是「未配置时优先」一支；类型面上只增可选字段，属向后兼容。插件不引用 `WebSearchRequest` | 无代码改动 |
| 4 | `dsh-client-ui-settings-web-search` 的 `WebSearchCard.tsx`：Automatic 选择时用 `searchAutoHint` 顶替 provider 描述并在 hint 挂指南链接；`locales.ts`、测试、README 同步 | 无。该卡是 dsh 自己的设置分区，以独立 client bundle（`lib/client.js`）在运行期加载，不经过前端壳；插件的设置分区与它互不引用 | 无代码改动 |
| 5 | `dsh-web-search-deepseek` / `dsh-web-deepseek-api` / `dsh-tool-web` 的 `src` 与测试 | 无。插件不用 `web_search` / `web_fetch` | 无代码改动 |
| 6 | `dsh-tool-cordis` 的 `api-catalog.ts`：`ctx.web` 的 `SERVICE_API` 描述与 `WebSearchRequest` 的类型目录文本跟着第 3 条改 | 无。只影响 `tool-cordis` 生成的 API 目录文字，不参与运行时 | 无代码改动 |
| 7 | 文档 / 快照 / e2e：`docs/config-catalog*`、`docs/subsystems/web*`、新增 `docs/upgrade-guide/v0.2.2-rc.4/web-search-deepseek-model-default/{guide.md,guide.zh.md,guide.i18n.yaml}`、`apps/web/tests/search-api-provider.overlay.yml`、`web-search-round.e2e.ts`、两个 `snapshots/session/web-search-*-guidance/`、两条 `.agents/notes` 的 md / zh / i18n | 无 | 文档记录，不改代码 |

## 1. 差异范围

比对方法两段。第一段读上游 checkout `D:\\deepseek-harness`：`git diff dsh-v0.2.2-rc.4..dsh-v0.2.2-rc.5` 共 **433 个文件**，其中 **380 个 `package.json`**、**53 个其它**；380 个 manifest 的差异合计 380 增 / 380 删，剔除 `"version"` 行后为零——即包间依赖号与 peer 声明本轮都没动。

第二段在安装树上做字节比对：仓库 `node_modules`（rc.4）与安装树 `...\\@deepseek-ai\\dsh\\node_modules\\@deepseek-ai`（rc.5）逐文件算 SHA-256（脚本 `.compat/cmp-deps.mjs`），另用 `npm pack @deepseek-ai/dsh-web-frontend@0.2.2-rc.4` 取 rc.4 前端壳与安装树 rc.5 的 `dist` 比。

53 个非 manifest 文件全部落在 web 搜索链路及其文档 / 快照：

| 区域 | 文件 |
|---|---|
| `packages/bundle/base` | `cordis.patch.yml`、`tests/base.spec.ts` |
| `packages/web/web` | `src/index.ts`、`src/types.ts`、`tests/web.spec.ts`、README ×3 |
| `packages/web/web-search-deepseek` | `src/provider.ts`、`src/types.ts`、`tests/deepseek.spec.ts`、`tests/settings.spec.ts`、README ×3 |
| `packages/web/web-deepseek-api` | README ×3 |
| `packages/web/tool-web` | `src/search.ts`、`tests/integration.spec.ts`、`tests/tool-web.spec.ts`、README ×3 |
| `packages/client/ui-settings-web-search` | `src/client/WebSearchCard.tsx`、`src/client/locales.ts`、`tests/card.client.spec.tsx`、README ×3 |
| `packages/extensions/tool-cordis` | `src/api-catalog.ts` |
| 文档 / e2e / 快照 / 笔记 | `docs/config-catalog.md` + `.zh.md`、`docs/subsystems/web{.md,.zh.md,.i18n.yaml}`、`docs/upgrade-guide/v0.2.2-rc.4/web-search-deepseek-model-default/` 3 个新文件、`apps/web/tests/{plugin-config.e2e.ts,web-search-round.e2e.ts,search-api-provider.overlay.yml}`、`snapshots/session/web-search-endpoint-guidance/` 2 个、`snapshots/session/web-search-legacy-endpoint-guidance/` 3 个、`.agents/notes/implemented/{architecture,feature}` 各 3 个 |

插件真正消费的 13 个包在 tag diff 里**每个只有 `package.json` 一个文件在变**（即只推进 `version`）：`dsh-client-ui-theme`、`dsh-client-ui-settings`、`dsh-client-ui-slots`、`dsh-client-ui-renderer`、`dsh-client-ui-session`、`dsh-client-ui-conversation`、`dsh-client-ui-primitives`、`dsh-client-locale`、`dsh-client-store`、`dsh-host-webserver`、`dsh-credentials`、`dsh-settings`、`dsh-session`。安装树上与 rc.4 的 `~/.compat` 快照（仓库 `node_modules`）逐文件比对，这些包全部 `diff=0`；`dsh-client-store` / `dsh-client-ui-primitives` / `dsh-client-ui-slots` 不在安装树的 `node_modules` 里（打进前端壳），改由壳的字节比对覆盖。`cordis`（4.1.0）、`schemastery`（3.19.0）、`cosmokit`（1.9.0）同样逐字节相同。

前端壳：rc.4 的 `@deepseek-ai/dsh-web-frontend` tarball 与安装树 rc.5 的 `dist` 比 **155/155 个文件哈希相同**，`onlyA` / `onlyB` 为空、无 `changed`；`assets` 仍是 `index-Ciz7DZxv.js` / `vendor-BUMdD3V7.js` / `index-CSAdOBx6.css` / `vendor-DV2921Zo.css`。壳里仍然逐个提供 `react`、`react/jsx-runtime`、`react-dom`、`react-dom/client`、`@deepseek-ai/cordis`、`dsh-client-store`、`dsh-client-ui-slots` / `-primitives` / `-dockkit`；插件 `lib/client.js`（CJS）只 `require` 其中 5 个（`@deepseek-ai/dsh-client-store`、`@deepseek-ai/dsh-client-ui-primitives`、`react`、`react-dom`、`react/jsx-runtime`），全部在表内。

## 2. 受影响的接口与行为

无。逐条对过 rc.4 基线与 rc.5 安装树：

| 面 | 观察 | 结论 |
|---|---|---|
| `ctx.web` 的 provider 选择 | `resolveProvider` 多了 `preferredId` 一支，只在「未配置 `searchProvider` 且该 provider 可用」时生效；configured 命中 / configured 未注册 / configured 不可用 / 唯一可用 / 多可用歧义 / 无可用六条路径的字面量错误码未变。`src/` 里 grep `ctx.web`、`searchProvider`、`llmProvider`、`WebSearchRequest` 均无命中 | 未使用 |
| `WebSearchRequest.llmProvider` | 只增一枚 `readonly` 可选字段，`search` / `searchReady` 的既有调用形态不变 | 未使用 |
| `dsh-client-ui-primitives` 导出表 | 包内文件（除 `package.json` 外）哈希与 rc.4 相同 | 未变 |
| `dsh-client-ui-conversation` 的 `conversation.composer.dock` 槽位声明与出口 | 哈希相同 | 未变 |
| `dsh-client-ui-renderer` 的槽位运行时（`runInject` 按位置传参、`standardKit()`） | 哈希相同 | 未变 |
| `dsh-client-ui-theme` 的 `overrideTokens` | 哈希相同 | 未变 |
| Host 侧：`webServer.register` / `credentialRef` / `settings.configure` | `dsh-host-webserver`、`dsh-credentials`、`dsh-settings` 只有 `package.json` 推进 `version`；运行中的宿主实测 200 | 未变 |
| 前端壳模块表 | `dist` 155 个文件逐字节相同 | 未变 |

## 3. 验证记录

本机 Windows / Node 26，devDependencies 全线 `0.2.2-rc.5` 之后：

- `npm install --no-audit --no-fund --cache D:/dsh-nord/.npm-cache`：`changed 29 packages`，无 `ERESOLVE`；`node_modules/@deepseek-ai/` 下 14 个包版本为 `0.2.2-rc.5`，`package-lock.json` 中 `0.2.2-rc.5` 出现 98 处、`0.2.2-rc.4` 0 处。
- `npm run build`（tsdown）：绿。`lib/client.js` 91.42 kB / gzip 26.75 kB，ESM 4 files 55.07 kB（与 rc.4 上的产物同尺寸，符合「源码未变」）。
- `npx tsc -p tsconfig.json`：退出码 0。
- `node --test --experimental-test-isolation=none "tests/*.test.mjs"`：**38 pass / 0 fail**。（默认隔离模式要 spawn 子进程，本机沙箱拒绝并抛 `EPERM`；`--experimental-test-isolation=none` 在同进程里跑的是同一批用例。）
- 运行中的宿主就是 rc.5，且已装载本插件：`GET http://127.0.0.1:3080/nord/balance` → `200`，正文 `{"currency":"CNY","total":"6.44","granted":"0.00","toppedUp":"6.44","available":true,...}`。Host 半边的 `webServer.register` + `credentialRef` 链路照常工作。
- 浏览器半边没有重跑 `scripts/shots/verify-compat.mjs`：探针要用隔离 home 起一个临时 dsh（`scripts/shots/lab.mjs` 里的 `spawn`），本机沙箱禁止子进程 spawn（`EPERM`）；`GET /` 与 `/api/plugins` 需要 web token（`401 dsh web authentication required`）。所以 rc.5 的浏览器侧结论由两段拼成：rc.4 的实机结果 + 「rc.5 的前端壳 `dist` 与插件 require 的 5 个模块所在的壳逐字节相同」。
- 升基线前 rc.4 基线同样绿（38 pass / 0 fail、`tsc` 退出码 0），差异只来自版本推进。

## 4. 处置

- `devDependencies` 从 `0.2.2-rc.4` 升到 `0.2.2-rc.5`（14 个包一起动，避免混版本 peer）。
- 插件代码、样式、设置 schema 均无需改动。
- README / README.en / DEVELOPMENT 的构建基线改写为 `0.2.2-rc.5`。
