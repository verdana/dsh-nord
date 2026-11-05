# dsh-nord × dsh 0.2.2-rc.1 兼容性核查

- 审计对象：`dsh-nord` 0.4.2（本仓库工作树），原基线 dsh `0.2.1-rc.5`
- 目标版本：dsh `0.2.2-rc.1`（`D:\deepseek-harness` 标签 `dsh-v0.2.2-rc.1`；本机 PATH 上的 `dsh` 已是此版本）
- 审计日期：2026-11-06
- 结论：**这一代真的动了插件站着的东西，共四处，其中一处已经在用户面前露出了 BUG。**

| # | 变化 | 对插件的影响 | 处理 |
|---|---|---|---|
| 1 | 设置左栏新增 `settings.section.icon` 槽位，导航行结构改为 `span.navIcon` 包裹 | **实质**：旧的 DOM 补丁只藏「直接子 svg」，齿轮不再被藏，`::before` 又画了一枚——左栏同时出现两个图标 | 改为注册槽位组件；补丁按「行里有没有自己的图标」自行退让 |
| 2 | 配色表新增 6 枚插画 alias + `state-done-primary`，删掉 1 枚 specific | 补 7 枚、删 1 枚死覆盖，否则空状态插画与 Forge 的 done 状态露出上游蓝灰/紫 | `src/client/nord.ts` 的 token 表 |
| 3 | `cordis` 4.0.5 → 4.1.0、`schemastery` 3.18.5 → 3.19.0 | 安装期 `ERESOLVE`（每个 dsh 包都 peer `cordis@~4.1.0`）；fiber 内部重构，插件用的公开 API 未变 | devDependencies 跟着上移；无代码改动 |
| 4 | 设置外壳改 CSS Grid、整体挪到 `remoteAccess.whenAccess('settings/describe')` 后面；<768px 变全屏横向导航 | 插件那一页不受影响（几何实测 553 / 746 仍放得下） | 无代码改动，探针复核 |

字体、余额、dock 三条主链路**零契约变化**，`lib/` 的 Node 半边也一字未改。

---

## 1. 差异范围

`dsh-v0.2.1-rc.5..dsh-v0.2.2-rc.1` 是 `0.2.2` 的整个开发周期：**2623 个提交、389 个包的 `package.json` 版本行**。整仓 diff 的大头是各包提交进仓库的构建产物（`packages/*/lib/*`）与快照夹具，看它们没有意义；有意义的只有插件实际依赖的那 14 个包。逐包数 `src/` 下改了几个文件：

| 插件依赖 | `src/` 改动 | 结论 |
|---|---|---|
| `dsh-client-ui-theme`（token 覆盖、`overrideTokens`） | 10 个文件 | `ThemeDefinition` 多一个可选 `icons`、新增图标精灵表、新增 DPR 感知的 `--dsh-hairline-width`；**token 覆盖接口本身未变** |
| `dsh-client-ui-settings`（`settings.section`） | 2 个文件 | **新增 `settings.section.icon` 槽位**（见 §2.1） |
| `dsh-client-ui-settings-general`（插件不依赖，但插件改它的 DOM） | 7 个文件 | 导航行结构 + 面板网格化（见 §2.3） |
| `dsh-client-ui-conversation`（dock 槽位） | 38 个文件 | 输入区大改（引文节点、发送态转圈、`input/prompt.ts`），**`conversation.composer.dock` 的声明与 `InputBar` 的出口结构零 diff**；`.dock` 在停靠态多了一条 `min-height: 22px` 预留 |
| `dsh-client-ui-primitives`（`Switch` / `Input` / `Menu` / 图标） | 67 个文件 | `Switch` / `Input` 零 diff；`Menu` 只加可选属性（`contextual` / `exiting` / `returnFocus` / `disabledReason`）；**图标改为 `<use href="#dsw-icon-…">` 引用 ui-theme 的精灵表** |
| `dsh-client-ui-session`（`useProjection` 座位） | 1 个文件 | 只多一个 `whenAccess()` 方法 |
| `dsh-client-locale` | 11 个文件 | 新增 6 种语言；`register()` 的 typed 重载放宽到「基线 zh/en 必填 + 其他语言可选」 |
| `dsh-settings`（Host） | 1 个文件 | `projectForm` 改读 `fiber.effectiveConfig`；`configure()` 里取 fiber 改为 `owner.ctx.fiber` |
| `dsh-host-webserver` | 1 个文件 | `register()` 多接受一种 `resource`（替代 handler）；exact/prefix + handler 的写法与 `path`/`kind` 语义未变 |
| `dsh-client-ui-slots` / `dsh-client-ui-renderer` | **0** | `div[data-slot]` 锚点与 `display: contents` 都还在，插件的 `:has()` 规则照旧生效 |
| `dsh-client-store` / `dsh-credentials` | **0** | 只有版本行 |
| `vendor/cordis` | 6 个文件 | 4.0.5 → 4.1.0，fiber 内部重构（见 §2.2） |
| `vendor/schemastery` | **0** | 3.18.5 → 3.19.0，只 bump |

`docs/upgrade-guide/v0.2.2-alpha.2` 下 19 篇、`v0.2.2-alpha.3` 下 2 篇升级指南里**没有一篇涉及本插件站的三个面**（`settings.section`、`conversation.composer.dock`、主题 token 覆盖）：它们讲的是上下文菜单、会话头部菜单、投影帧、web search 凭据模式、desktop 通道策略等。图标槽位那件事（PR #7624）只写进了 `ui-settings/README.md` 的「Filling the settings slots」一节。

## 2. 受影响的接口与行为

### 2.1 `settings.section.icon`：左栏图标从「打补丁」变成「注册组件」

0.2.2-alpha.3 起，`ui-settings` 新增槽位：

```ts
'settings.section.icon': { kind: 'list'; scope: 'root'; inline: true; owner: SettingsSectionIconOwnerProps }
// owner props: { size: number; active: boolean }
```

`ui-settings-general` 的导航行同时改成了：

```tsx
<button class={navCell}>
  <span class={navIcon} aria-hidden="true">
    {renderSlot('settings.section.icon', { size: 16, active }, { only: row.id, fallback: navIcon(row.id) })}
  </span>
  <span class={navLabel}>{row.label}</span>
</button>
```

两件事合起来就是那个 BUG：本插件原来靠 `button[data-dsh-nord-nav]>svg{display:none}` 藏掉 shell 的齿轮，再用 `::before` + mask 画调色盘。新结构里 svg 落到了 `span.navIcon` 里，**直接子选择器不再匹配**，于是齿轮留下、颜料盘又画了一个，左栏那一行出现两个图标。`::before` 是匿名盒，排在 `span.navIcon` 之前，所以看到的是「齿轮 + 调色盘」。

修法不是补一条更深的选择器，而是走官方那条路：把调色盘注册成组件，让 shell 用 `fallback` 机制顶替齿轮——`::before` 根本不需要出现。旧宿主（0.1.7 / 0.2.0 / 0.2.1）没有这个槽位（`ctx.slots.inject` 会一直待命），仍走补丁。两条路的分界不看版本号，看**行里有没有 `data-dsh-nord-icon`**：`NavIcon` 在自己的根节点打这个标记，补丁只标记没有它的行。这样 0.2.2-alpha 那几版（槽位在 alpha.3 才出现）也不会两边同时生效。

顺带一提，`active` 是 shell 给的选中态，但宿主自带的图标是单字重、只随 `currentColor` 变色，所以这里刻意不用它——否则选中与未选中的字形粗细会跟旁边几行不一致。

### 2.2 cordis 4.1.0 / schemastery 3.19.0

这一条是**安装期**的坑，不是运行期的：0.2.2 的每个包都把 peer 写成 `cordis@~4.1.0`，而 `cordis` 在插件里是显式 devDependency（4.0.5），于是 `npm install` 直接 `ERESOLVE`。按仓库既有的做法清树重装（删 `node_modules` + `package-lock.json`）即可，不要 `--force`。

4.1.0 改的是 fiber 内部：`fiber.config` 现在存**原始输入**、校验后的值在 `fiber.effectiveConfig`；`fiber.store` 改名 `committed`，服务实现上 `impl.fiber` 换成 `impl.ctx.fiber`；失败的 fiber 只能靠 `update()` 恢复。插件只用到 `ctx.inject` / `ctx.effect` / `ctx.provide` / `ctx.on` 这一层，签名与语义都没变——`typecheck` 与两个探针都印证了这点。

### 2.3 设置外壳：网格化 + 访问闸门

`SettingsRoot.module.css` 从 flex 改成 `grid-template-columns: 188px minmax(0,1fr)`，四个座位按 area 摆放；`<768px` 走全屏面板 + 横向导航。整个 `sidebar.settings` 的注册还整体挪到了 `ctx.remoteAccess.whenAccess('settings/describe', …)` 后面——**Host 不提供 `settings/describe` 时，设置入口根本不出现**。

对插件的影响仅限「页面要塞得进内容列」这一条：0.2.2 上实测仍是 553px 高 / 746px 列高 / 564px 宽、无滚动，和 0.2.1 一致。横向导航那档只在窄视口出现，桌面窗口走不到。

### 2.4 配色 token 的增删

拿两个 tag 比 `design-platform.css` 里的 token 名（`comm -13` / `comm -23`）：

**新增 7 枚 alias，全部需要本层给值**：

| token | 用途 | 不覆盖会怎样 |
|---|---|---|
| `--dsw-alias-illustration-background` | 空状态插画（Schedule 页）的柔和底块 | 露出上游蓝灰 rung |
| `--dsw-alias-illustration-backing` | 插画里压在下面那张纸 | 同上 |
| `--dsw-alias-illustration-surface` | 正面那张纸 | **深色下变成中性灰「纸」，与 Nord 的蓝灰画布不是一种材质** |
| `--dsw-alias-illustration-detail` | 纸上的横线与钟表指针 | 露出上游 rung |
| `--dsw-alias-illustration-inset` | 钟面（从 detail 里挖出来） | 同上 |
| `--dsw-alias-illustration-shadow` | 地面投影椭圆 | 同上 |
| `--dsw-alias-state-done-primary` | Forge 的 done 状态（上游是紫罗兰） | Nord 里突然出现一支紫色 |

`--dsw-alias-state-done-primary` 是**文本色**（`ui-forge` 用它上 `color:`），所以跟 error 一样按明暗分别混色：`nord15` 直接上只有 2.5:1（浅）/ 4.4:1（深），现在浅色 `color-mix(nord15 55%, nord0)` 得 4.57:1、深色 `color-mix(nord15 85%, nord6)` 得 5.15:1。

**删除 1 枚**：`--dsw-specific-sidebar-nav-item-hover` 在 0.2.2 里被整个删掉了（theme 与 `ui-settings-general` 都不再引用），侧栏与设置左栏的悬停统一改吃 `--dsw-alias-interactive-bg-hover`——那枚本层本来就覆盖着，所以视觉不变。本插件 token 表里那条覆盖因此变成死代码，本轮删掉。

六枚插画 token 的取值逻辑：浅色照上游的分层（`inset` 等于 `surface`，纸面即钟面），深色照上游的反转（钟面比纸面亮一档，落在 nord3，压在 `detail` 那圈碟形下面）。两个需要额外解释的地方：`detail` 用 color-mix 而不是直接取 rung，因为 Nord 从 nord4 直接跳到 nord3，取 rung 会让纸上的线从「上游的 1.5:1」跳到 3:1 以上，读起来是墨水而不是印刷；深色的 `backing`（垫在前那张纸下面的斜置纸）也是 mix，因为极夜只有四档可用，它必须压在前纸（nord2）下面、又不能沉到画布（nord0）里消失，只能取 nord1 与 nord0 的中间。

### 2.5 locale：6 种新语言，注册签名放宽

`ui-locale` 这一代加了 `ja` / `es` / `fr` / `de` / `ru` / `pt`。typed 的 `register()` 从 `Record<BuiltInLocaleId, …>` 放宽成 `Record<BuiltInLocaleId, …> & Record<LocaleId, …>`（`LocaleId = string`，实际仍是「zh/en 必填、其他可选」），所以插件那句 `register(LOCALE_NS, { zh, en })` 照旧通过类型检查。行为上：用户把界面语言切到德语时，插件这一页会沿 fallback 链落到英文——和它在 0.2.1 上面对「浏览器语言是德语」时一样，不是新增的缺口。要不要补六份字典是产品决定，本轮不动。

### 2.6 会话面与 dock

`ui-conversation` 的 38 个源文件里没有一处动到 `conversation.composer.dock`：声明仍是 `{ kind: 'list'; scope: 'session' }`，`InputBar.tsx` 里出口仍挂在 `<div className={dock} data-composer-dock>` 内、仍是 `renderSlot(...)` 直接产出 `div[data-slot]`。改的是输入区内部（引文节点、`prompt.ts` 抽出来、发送中态、`@media (hover: hover)` 包裹悬停态）与文案。

一处要记的行为变化：停靠态（非 hero）的 `.dock` 现在有 `min-height: calc(22px + delta)`，用来给「读数还没到」预留一行高度，**避免投影落地时 composer 高度跳动**。本插件的余额条正好住在这一行里（20px 行高 + 4px margin-top），实测无位移、无换行。

另外 0.2.2 给几条浮动层槽位的文档补了同一句话：fixed 定位的浮层必须 portal 到 `body`，因为停靠的 composer 会把它包住。本插件的余额明细面板早就是 portal 到 body 的（`PANEL_ATTR`），不受影响——这大概也解释了它为什么在 0.2.1 上就没出过事。

### 2.7 Host 侧

- `webServer.register({ kind: 'exact', path, handler })` 完全没变；新增的是并列的一种 `{ … , resource }` 写法与 `readResource`。新版还给 `webserver/index-inject` 的 tap 多传了一个 `peer` 参数，插件不接这个事件。
- `dsh-settings` 的 `projectForm(...)` 从 `entry.fiber.config` 改读 `entry.fiber.effectiveConfig`：cordis 4.1 让 `config` 变回「原始输入」之后，这一步是必须的，否则投影出来的是没补默认值的原始块。插件的 `.default()` 依赖它，所以这条改动**帮了**本插件。
- `host/frontend-static` 现在给非 index 资源带弱 ETag + `cache-control: no-cache`，index 不带缓存头；`.png` 有了正确的 Content-Type。插件的浏览器产物走模块系统的 combo 路由，不经这条静态面。

### 2.8 字体链路

`hostOwnsFonts()` 的判据（`window.__DSH_BOOT__.release.version >= 0.2.1`，兜底看主题快照有没有 `fontFamilies`）在 0.2.2 上仍成立：`theme.getTheme()` 的形状没变，只是 `ThemeDefinition` 多了可选的 `icons`。0.2.2 上字体层依旧整体让位，实测 `#dsh-nord-fonts` 不注入、body 上不是 Maple。

## 3. 本轮代码改动

| 位置 | 改动 |
|---|---|
| `src/client/nav-icon.tsx` | **新增**：调色盘的几何（一份 24 单位轮廓 + 四个颜料坑）在这里定义一次，两个消费者共用——`NavIcon` 组件渲染成真 SVG（给槽位），`paletteGlyph()` 拼成 SVG 文档喂给 mask（给旧代补丁）。另含 `NAV_ATTR` / `ICON_ATTR` / `NAV_STYLE_ID` 与 `navStylesheet()` |
| `src/client/index.ts` | 注册 `settings.section.icon`（`id: dsh-nord`）；补丁的 `mark()` 增加「行里已有自己的图标就跳过」，注释重写为两代分工 |
| `src/client/nord.ts` | 删掉迁走的 `NAV_GLYPH` / `navStylesheet` / `NAV_ATTR` / `NAV_STYLE_ID`；token 表 +7（插画 6 + done 1）−1（上游已删的 hover）；新增 `DONE_TEXT_LIGHT` / `DONE_TEXT_DARK` 常量 |
| `scripts/shots/verify-settings.mjs` | 图标断言改写成两代通吃：槽位路径断言「只有一个可见 svg、它带 `data-dsh-nord-icon`、16×16、行未被补丁标记」；补丁路径断言「标记在、可见 svg 为 0、`::before` 是 data-uri、16×16」 |
| `scripts/shots/verify-compat.mjs` | token 抽样 9 → 12：补 `state-done-primary`、`illustration-surface`、`illustration-detail` |

`nord.ts` 因此瘦了一圈（-2.8 kB）：字形几何与那套补丁整体搬去了 `nav-icon.tsx`，token 表只多不少。

## 4. 验证记录

| 路 | 方法 | 结果 |
|---|---|---|
| 类型 | `npm run typecheck`（依赖已升到 `0.2.2-rc.1` / cordis `4.1.0` / schemastery `3.19.0`） | 0 诊断 |
| 单测 | `npm test` | 38/38 |
| 构建 | `npm run build` | 通过；Host 半边源码未动，四个产物大小与升级前一致（`index.js` 41.36 kB），浏览器半边 `client.js` 84.15 → **86.37 kB**（新增图标组件 + 7 枚 token） |
| 设置页探针（`0.2.2-rc.1`） | `verify-settings.mjs`（隔离 `DSH_HOME` + headless Edge） | **全部通过**：左栏入口与顺序、通用已清空、独立页几何（553px / 列 746px / 564px、无滚动）、**左栏图标「槽位给出 16×16，齿轮未渲染，行未被补丁标记」**、页脚版本、字体委托、零 console 报错 |
| 接口探针（`0.2.2-rc.1`） | `verify-compat.mjs` | 8/9：模块加载器、两枚插件样式表（2415B / 69B）、字体委托、明暗两套 token 抽样**各 12 项全中**、dock 槽位与 `:has()` 规则（出口 `display=flex`）、余额读数（CNY 42.50）、明细面板；**「用量信息」座位仍未渲染**——与 rc.4 / rc.5 同一处已知缺口（§5） |
| 旧代回归（`0.2.1-rc.5`） | 同一份 `verify-settings.mjs`，`DSH_BIN` 指向另一份安装 | **全部通过**：左栏图标「自有字形 16px×16px，齿轮已隐藏」，说明补丁那条路没被这次改动弄坏 |

两个探针的**环境噪声**（与插件无关，记录备查）：本机沙箱把 `reg.exe` 放进程序黑名单，dsh 探测 Windows 版本时会报一条 `PROGRAM BLOCKED BY SECURITY POLICY`（探针照常通过）；第一次跑设置页探针时，`.shot-lab` 的删除走的是沙箱的 delete broker，紧接着 dsh 的 profile 初始化要 `rename` 那棵刚重建的目录，撞了一次 `EPERM`——重跑即过，属于清场时序，不是插件问题。

## 5. 没变但值得记一笔

- **「用量信息」座位**：仍然只有会话的 `modelSelection` 投影带 provider 时才渲染，隔离 home 里的夹具会话满足不了这一条。机理与排查见 [COMPAT-0.2.1-rc.4.md](./COMPAT-0.2.1-rc.4.md) §3，本轮没有任何新证据，仍待一条「真的发过请求」的会话做夹具。
- **Node 版本**：`@deepseek-ai/dsh@0.2.2-rc.1` 的 `engines` 是 `node >= 24.9.0`，本机是 `v22.22.2`，`npm install` 会打一条 `EBADENGINE` 警告。实测能装能跑、两个探针都能过，但这属于「上游声明不满足」的状态，升级 Node 是迟早的事，记在这里免得下次误判成插件问题。
- **`--dsh-hairline-width`**：0.2.2 的 ui-theme 在 `:root` 上按 DPR 算出一个「半像素对应的真实宽度」，供 1px 发丝线取整用。本插件的面板分隔线写死 `.5px`——没有改，因为改成 `var(--dsh-hairline-width)` 在 DPR 1 的屏上会从 0.5px 变成 1px，是肉眼可见的加粗，得单独做视觉确认。留作可选跟进。

## 6. 已实施的工程动作

| 位置 | 改动 |
|---|---|
| `package.json` | 12 个 `@deepseek-ai/dsh-*` → `0.2.2-rc.1`；`cordis` 4.0.5 → **4.1.0**；`schemastery` 3.18.5 → **3.19.0**；重生成 `package-lock.json` |
| `README.md` / `README.en.md` | 兼容表加 `0.2.2`（基线）一行，`0.2.1` 降为「实测（rc.5）」，`0.1.7` 标为「出窗：代码仍在，不再实测」 |
| `DEVELOPMENT.md` | 「版本现实」基线改 0.2.2-rc.1、矩阵加一行、窗口说明改成 `0.2.2 / 0.2.1 / 0.2.0`；「设置页占一整页」一节重写为两代两条路；「升级时该主动查的东西」里导航行那条改成「查槽位」、token 那条记下 0.2.2 的增删；「本地验证」补本轮结果 |
| `COMPAT-0.2.1-rc.5.md` | 顶部加一行指针，指向本文 |
| `CHANGELOG.md` | 「未发布」里记下这轮的修复与基线推进 |

**两个工程坑**（本轮实际踩到，都不在上游文档里）：

1. **cordis 的 peer 是精确 `~`**，不跟着 dsh 的版本号走。0.2.1 时代钉 4.0.5 没事，0.2.2 一来所有包都要 `~4.1.0`，`npm install` 当场 `ERESOLVE`。所以要跟着升的是三个东西（12 个 dsh 包 + cordis + schemastery），不是只有 dsh 包。
2. **DOM 补丁这类「贴着宿主结构写」的东西会静默走样**：0.2.2 只把齿轮挪进一层 `span`，规则就不匹配了，而它的失败方式是「多画一个」而不是「少画一个」——比失败更难看出来。判据要尽量落在「自己画的东西在不在」上，而不是版本号或宿主类名。

## 7. 复现命令

```powershell
# 依赖与静态检查（cordis 的 peer 变了，必须清树）
Remove-Item -Recurse -Force node_modules, package-lock.json
npm.cmd install --no-audit --no-fund --registry https://registry.npmjs.org/
npm.cmd run typecheck; npm.cmd test; npm.cmd run build

# 另一份版本并排装（装仓库外，靠 DSH_BIN 切）
npm.cmd install --prefix D:\dsh-rc2 @deepseek-ai/dsh@0.2.2-rc.1 --no-audit --no-fund
npm.cmd install --prefix D:\dsh-rc1 @deepseek-ai/dsh@0.2.1-rc.5 --no-audit --no-fund   # 旧代回归

# 两个探针（隔离 home + headless Edge + 本地余额 mock）
$env:HTTP_PROXY=''; $env:HTTPS_PROXY=''; $env:NO_PROXY='127.0.0.1,localhost,::1'
$env:DSH_BIN='D:\dsh-rc2\node_modules\.bin\dsh.cmd'
node scripts/shots/verify-settings.mjs
node scripts/shots/verify-compat.mjs
$env:DSH_BIN='D:\dsh-rc1\node_modules\.bin\dsh.cmd'; node scripts/shots/verify-settings.mjs
```

> 本机注意：`npm` 在 PowerShell 里解析到 `npm.ps1` shim（静默退 1），一律用 `npm.cmd`。**不要用 `Move-Item` 搬 `.shot-lab`**——里面 `profiles/shots/node_modules/dsh-nord` 是指回仓库根的 `link:` 联结点，跟随式搬移会把整个仓库搬进去。清场交给探针自己：`lab.mjs` 的 `prepareHome()` 开头就 `rmSync(LAB)`。
