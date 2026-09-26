# DEVELOPMENT

面向要改这个插件的人。用户向的安装与用法在 [README.md](README.md)。

## 项目结构

```
src/index.ts               Host 半边：设置段 + GET /nord/balance 路由
src/config.ts              两侧共用的配置类型、默认值与 NS / BALANCE_PATH 常量
src/schema.ts              Host 独有的 durable schema，唯一 import schemastery 的模块
src/balance.ts             余额载荷类型，以及上游文档到载荷的投影
src/usage.ts               用量信息链接的判定：会话模型供应商优先，余额地址兜底
src/fonts.ts               字体预设目录，以及「存储选项 → CSS 家族列表」的解析（含自定义串的清洗）
src/client/index.ts        浏览器半边：主题层、字体、样式表、设置页、余额轮询、两个 slot 注册
src/client/nord.ts         Nord 调色板（116 token）、字体 `:root` 规则、余额表面与宽表格补丁的 CSS
src/client/BalanceBar.tsx  余额读数与其明细面板
src/client/NordSection.tsx 设置面板里本插件自己的一页
src/client/stores.ts       设置页与余额的 slot store
src/client/locales.ts      `dshNord` 命名空间的中英文案
tests/balance.test.mjs     投影的 `node --test` 规格
tests/usage.test.mjs       用量链接判定的 `node --test` 规格
tests/fonts.test.mjs       字体解析与自定义串清洗的 `node --test` 规格
tests/balance-mock.mjs     上游 `/user/balance` 的本地替身
scripts/release-lab.mjs    隔离 `$DSH_HOME`，逐个验证四种安装方式（见「发布后的四种安装方式」）
scripts/publish-npm.mjs    发布流水线：六道闸门 + tarball 核查 + 真发布（见「发布到 npm」）
scripts/shots/verify-settings.mjs  隔离实例里实测设置页与字体选择器（见「本地验证」）
assets/                    README 截图
```

`tsdown.config.ts` 构建五个产物：`src/index.ts` → `lib/index.js`（Node 半边，Loader 挂载）、`src/balance.ts` → `lib/balance.js`、`src/usage.ts` → `lib/usage.js` 与 `src/fonts.ts` → `lib/fonts.js`（三个纯模块各自成文件，供 `npm test` 在纯 Node 下跑，不必启动插件）、`src/client/index.ts` → `lib/client.js`（浏览器半边，Web shell 经 `/plugins` combo 路由取）。最后者必须精确匹配模块系统的线格式：注册 banner/footer 包住的 CJS 体，`module`/`exports` 由 intro 引入。

## 能力与机制一览

| 能力 | 机制 |
|---|---|
| Nord 配色 | `ctx.theme.overrideTokens('dsh-nord', tokens)` —— 116 个 token，每个带 `{ light, dark }` 两个值，官方按当前配色自动取值 |
| 字体选择 | 两枚 token（`--dsw-font-family` / `--ds-font-family-code`）+ 一枚 `:root` 规则；界面与代码各自选，预设目录与解析在 `src/fonts.ts` |
| 余额 | Host 侧 `webServer` 上的 `GET /nord/balance`，用 `ctx.credentials` 解析 `DEEPSEEK_API_KEY`；浏览器侧是 dock 里一枚可点击读数 + 明细面板 |
| 余额投影 | `src/balance.ts` 的 `parseBalance()`：上游文档 → 载荷，Host 路由与 `npm test` 共用同一份实现 |
| 用量信息链接 | `src/usage.ts` 的 `usageLink()`：会话模型供应商（Host 的 `modelSelection` 投影）优先，取不到时看余额地址域名；非 DeepSeek 账号面板不变 |
| 设置项 | Host `ctx.settings.installSection()` 持久化进 `settings.yaml`；浏览器侧是左栏一页 `settings.section`（`id: dsh-nord`、`order: 40`） |
| 设置页控件 | 模块表基线里的 `@deepseek-ai/dsh-client-ui-primitives`：开关用 `Switch`、字体选择用 `Menu`、字段用 `Input`，行距与配色走内联 style |
| 余额表面的样式 | 插件自己的一枚 `<style>`（`surfaceStylesheet`）：dock 行规则、读数皮肤、面板皮肤 |
| 宽表格抖动补丁 | 第三枚 `<style>`（`tableStylesheet`）：把 `md-table-wide` 钉在 `overflow-x:auto` 且无底部预留，取消上游的悬停切换 |

### 为什么配色走 `overrideTokens` 而不是「注册一个主题」

官方 `ThemeRuntime.register()` + `setTheme()` 那条路对第三方主题是不完整的：`ui-theme` 的 settings schema 只接受 `light | dark | system`，第三方 theme id 存不进去；而 `adopt()` 会在设置就绪或变化时把内存偏好覆盖回内置值——刚切换成功的主题下一个 tick 就被打回 `light`。

`overrideTokens(source, tokens)` 是官方为此准备的入口：把一层 token 叠在当前活动主题之上，按注册顺序逐 token 覆盖，移除即还原，`composeActive` 按 `active.colorScheme` 自动挑 `light` / `dark`。官方 `theme-presenter` 通过 `body.style.setProperty` 写入这些变量，所以卸载插件时主题自动消失，不会残留。

覆盖分三类共 116 项：

- **81 个 `--dsw-alias-*`** —— 官方 alias 层的完整覆盖，不靠 `!important`、不靠 DOM 手术。
- **10 个 `--dsw-specific-*`** —— 侧边栏、composer、选择器这些具名表面。
- **25 个 `--dsw-static-*`** —— 补丁。有一批组件（计划卡、交付物、指南正文、文件类型图标、加载渐变）绕过 alias 直接读静态色阶，官方 light 把这些取成近白，在 Nord 画布上就是一个个白框。这是「浅色露白框」的真正成因，只覆盖 alias 治不了。

### 为什么设置页用官方控件

`@deepseek-ai/dsh-client-ui-primitives` 是 Web shell 预置进模块表的基线模块（`packages/client/web/src/platform.ts` 的 `PLATFORM_MODULES`），所以树外插件的 `require` 拿到的就是官方设置页用的那个模块实例，而不是打包进来的第二份：`Switch` 的胶囊皮肤与焦点环、`Input` 的聚焦边框、`Menu` 的下拉卡片（圆角 20、`--dsw-specific-menu` 底、`--dsw-elevation-prominent`、portal 定位与外部点击关闭）都不必自己写，也不必担心 React 上下文重复。

页面其余部分（标题层级、分组标签、行距、字段宽度）仍是内联 style —— 树外构建没有 CSS Modules 管线，而这些声明也不需要 `:hover` / `:focus` 状态。布尔项从原生 checkbox 换成 `Switch`、字体选择用 `Menu` 而不是原生 `<select>` 也是同一个理由：原生控件在不同浏览器与配色模式下样式不可控，外观则由设计系统持有。

### 为什么是一页 `settings.section`，而不是「通用」里的一行

设置域把两种座位分得很清楚：一行（`settings.general.item`）是「一个设置项、不需要独立页面」的加法座位，一页（`settings.section`）是功能插件自己的页面。本插件有七个控件、三组语义，塞进「通用」会让那一列又长又杂——用户提的正是这件事，参照物是社区插件 `dsh-better-display`，它同样占一页。

迁移只是换一个注册点：`settings.general.item` → `settings.section`，`id` 用 `dsh-nord`。几处要注意的：

- **`order` 要排在官方之后。** 官方分区是 `0` 通用设置 / `10` 模型 / `15` 插件 / `20` Agent 预设；`dsh-better-display` 用 `40`，这里跟着用 `40`，实测左栏落在最后（`通用设置 | 模型 | 插件 | Agent 预设 | Nord 主题`）。
- **`label` 必须是 thunk。** 传字符串就只在注册那一刻求值；传 `() => t('nav')` 之后，shell 的导航账本同时订阅 slot 账本与 `ctx.locale`，切语言时会重读这个 thunk——所以不需要为了语言切换重新注册。`ctx.locale.bind(ns)` 的重复调用返回同一个函数，绑定一次即可。
- **导航图标由 shell 决定。** `navIcon(id)` 是 shell 里的硬编码表，未知 id 落到齿轮图标；第三方页面没有换图标的入口，本插件也就接受齿轮。
- **页面自带标题与分组。** shell 只提供 188px 的导航列和一个 `padding: 0 24px 24px; overflow-y: auto` 的内容列；页面标题、分组标签、行都归页面自己画（官方插件页用的是 `<h2>` + 18px/600 标题，这里对齐）。
- **`close` 座位没用到。** `settings.section` 的 owner 会传一个关闭面板的回调，本插件的流程不需要离开设置面板。

### 为什么字体是一枚 `:root` 规则

`base.css` 在 `:root` 里定义 `--dsw-font-family` 与 `--ds-font-family-code`，而 `--dsw-font-markdown-*`、`--dsw-font-<size>-*-font-family` 这些复合族全部在 `:root` 上以 `var(--dsw-font-family)` 声明。CSS 自定义属性的 `var()` 在声明处求值，所以写在 `body` 上的覆盖永远传不到那些复合族里。

一枚由插件持有、卸载即移除的 `<style>`，用 `:root` 选择器赢得与上游 `:root` 的层叠，全部派生族自动跟随——不用枚举 50 多个变量。规则正文在每次落盘后被整条重写，关掉字体层时清空而不是留着旧值。

### 字体为什么是一个选择器，而不是一个开关

「不是所有人都装了 Maple Mono，也有人想用别的」这件事有三个独立的部分，插件只解前两个：

- **表达。** 一个字体名不够。选了 JetBrains Mono 之后中文没有字形，必须靠后面的家族兜底，所以存下来的是一整条栈。预设里的每一项都是家族列表（`Cascadia Code, Cascadia Mono`），末尾再拼上该角色自己的尾巴：界面接 `ui-sans-serif, -apple-system, …, sans-serif`，代码接 `ui-monospace, 'SF Mono', …, 'PingFang SC', 'Microsoft YaHei'`。代码那条按 `base.css` 自己的记录不带裸 `monospace`——Windows CJK 会经它回退到 SimSun，`ui-monospace` 不是同一个东西。
- **发现。** 网页只能用本机装了的、或页面自己下载的字体，这是浏览器边界。插件不去探测（`document.fonts.check()` 是实现相关的启发式，`queryLocalFonts()` 只有 Chromium 有且要权限弹窗），而是把预设做成回退栈：没装的那一档自动落到下一档，**下拉里的每一行用它自己选的字体渲染，所以那行本身就是样品**——没装时你看到的就是回退后的样子，预览不会撒谎。
- **不做的部分。** 不打包 webfont。拉丁子集几百 KB、中文子集若干 MB，会让 npm 包体积翻几个量级，而且只解决「默认」不解决「想换」。要默认永远可用，装一下 Maple Mono 比打包它便宜。

界面与代码是两个独立的 `Menu`，代码那侧多一行「跟随界面字体」（字面意思：代码 token 直接取界面解析出的那条栈，尾巴也一样）。

### 自定义字体串为什么要重新拼

`uiFontCustom` / `codeFontCustom` 是用户输入，最终会进到插件自己那枚 `<style>` 的 `:root{}` 里。直接在模板串里插值等于把 `}` 交给用户。`parseFamilies()` 因此不「转义」也不「整体拒绝」，而是按逗号拆开、剥一层引号、对每个名字跑一遍白名单正则 `^[A-Za-z0-9._+\-\u00C0-\uFFFF][A-Za-z0-9 ._+\-\u00C0-\uFFFF]*$`，过不了的名字丢掉，然后用单引号重新包一遍再拼——分号、花括号、引号、反斜杠、括号、`@`、`!`、`#`、`/`、`*` 全在 U+00C0 以下，因此一个能闭合规则的字符永远活不下来，而 CJK、重音拉丁与全角字符在其上，正常通过。

两个细节：`sans-serif` 这类通用族**不能加引号**（`font-family: 'sans-serif'` 是一次查不到任何东西的族名查询），所以有一张关键字表让它原样输出；名字按逗号拆开逐个判定，一个坏条目不会连带丢掉整条列表。

### 宽表格为什么被钉在 `auto`

上游 `ui-primitives` 给 markdown 宽表格（渲染器的 `md-table-wide` 钩子）做了「静止藏条、悬停显条」，藏的时候用 `padding-bottom: var(--dsh-scrollbar-width, 8px)` 把条的高度先占住：

```css
.tableScroll:global(.md-table-wide) { overflow-x: hidden; padding-bottom: var(--dsh-scrollbar-width, 8px); }
.tableScroll:global(.md-table-wide):hover,
.tableScroll:global(.md-table-wide):focus-visible { overflow-x: auto; padding-bottom: 0; }
```

这套交换会改盒子本身，于是触发它的指针可能被自己造成的状态甩出去：在底边那 8px 里，`padding-bottom` 归零使盒子缩短 8px，指针落到盒外，`:hover` 丢失，预留回来，两个状态来回切——就是鼠标停在表格底边时的抖动。0.1.5-rc.2 的悬停态是 `overflow-x: auto`，只有真的放不下才出条，所以「四列但放得下」的宽表格（`md-table-wide` 由列数决定，与是否溢出无关）归零后没有条接手，任何滚动条路径都会缩。

把预留固定成 8px 不能解决，反而换个方向错：占位的滚动条排在 padding 盒之外，所以固定 8px 预留叠上 8px 的条，会让悬停时的盒子比静止时高 8px，把表格下方的内容整体推下去。钉住**状态**才行 —— `auto` 且不留预留，盒子的边框盒在两种状态、两条滚动条路径上完全一致（Chromium 实测：叠加式滚动条下两种表格都是 69px；8px 自绘条下，放得下的表格 69px、溢出的表格 77px —— 都是静止与悬停同值），指针永远不会落到盒外，放得下的宽表格也照样没有条。代价是溢出的宽表格要常驻一条普通横向滚动条。

补丁只有一条规则，用 `!important` 一次性压掉上游的静止与悬停两条声明；它只碰 `overflow-x` 与 `padding-bottom`，不动 `ui-chat` 借同一个钩子做的加宽与对齐（`width` / `margin-left` / `padding-left`）。

### 余额条为什么还需要一条 dock 规则

`conversation.composer.dock` 里已经有官方的「轮次/步骤」pill。0.1.5 把该槽位的每个贡献直接挂进 composer 竖列（`InputBar.root` 是 `flex-direction: column`），所以同一个槽位的条目各占一行；0.1.6 才给 dock 加了独立的横向 `.dock` 行。

槽位出口本身是可寻址节点：渲染器的 `SlotOutlet` 渲染 `<div data-slot="…" style="display: contents">`。所以插件只加一条规则，当出口里出现本插件的余额条时，把出口自己变成与 0.1.6 等价的横向行：

```css
div[data-slot="conversation.composer.dock"]:has(> [data-dsh-nord-bar]) {
  display: flex !important; /* 出口自带内联 display:contents，只有 !important 能改 */
  align-items: center;
  justify-content: center;
  gap: 12px;
  max-width: 100%;
}
```

`:has()` 让余额条不在场时（关闭余额、非 composer 视图）出口保持原样；浏览器不支持 `:has()` 时退回「各占一行」，也就是没装这个插件时的样子。

条本身只跟官方 pill（`StatsPills.module.css` 的 `.pill`）对齐文字档：`flex: none`、`gap: 6px`、`font-family: inherit`、`font-size: var(--dsh-content-font-size-secondary, 13px)`、`line-height: calc(20px + var(--dsh-content-font-delta-secondary, 0px))`、`font-variant-numeric: tabular-nums`、`white-space: nowrap`。字号走变量而非写死 13px，才能跟随设置里的正文字号联动派生。

盒子保留胶囊外观（`padding: 1px 8px`、`border-radius: 24px`），用 `margin-top: 4px` 把文字压到与官方 pill 同一条基线：官方 pill 行的 `.root` 自带 4px 顶部内边距、`.pill` 再叠 1px，两行文字因此都从行顶 +5px 起排。图标是插件自带的 16×16 描边字形（`currentColor`，按 16×16 渲染）。

### 余额明细面板

读数拿到成功结果时是一枚 `<button>`，点开后弹出明细面板；刷新中或失败时退回纯文本 `<span>`——与官方 pill 在没有可展开内容时用 `<span>` 的做法一致。展开态复用同一个 `[data-dsh-nord-bar]` 元素，所以行不会因为状态切换而重排。

面板与旁边两颗 pill 的对话框是同一套皮肤（`ui-chat/src/client/chat/stat-dialog.module.css`）：`--dsw-specific-menu` 表面、12px 圆角、16px 内边距、`--dsw-elevation-prominent` 阴影、12/18 字号，结构是「标题行 + 分隔线 + 两列 `dl`」。定位与关闭直接用官方原语：`useAnchoredPosition`（挂在读数上方 8px，按 12px 视口边距夹紧）与 `useDismissOnOutsidePointer`（点面板外关闭，面板本身算内部），Escape 在组件内关闭。两者来自模块表里的 `@deepseek-ai/dsh-client-ui-primitives`，因此与 `react-dom` 一样保持 external。

面板内容与上游字段一一对应：

| 位置 | 内容 | 上游字段 |
|---|---|---|
| 标题行右 | `CNY 42.50` | `balance_infos[0].currency` + `total_balance` |
| 赠金余额 | `2.50 CNY` | `granted_balance` |
| 充值余额 | `40.00 CNY` | `topped_up_balance` |
| 账户状态 | 可调用 / 余额不足 | `is_available` |
| 更新时间 | 浏览器本地时间 | `fetchedAt`（Host 读取时刻） |

轮询不做清屏：`loading` 只在「还没有成功读数」（首次加载或上次失败）时才进入 pending，成功过一次之后原地更新。否则每 15–60 秒会让面板跟着读数一起闪掉一次。

### 用量信息这一行为什么要检测

面板底部的「用量信息」链接（→ `platform.deepseek.com/usage`，右对齐，`target="_blank"`）只对 DeepSeek 账号有意义，判定在 `src/usage.ts` 里，两个信号按顺序看：

1. **会话的模型供应商**。`conversation.composer.dock` 是 session 作用域槽位，shell 的 `ui-session` 适配器会往每个 session 作用域条目投递标准套件，其中 `useProjection('modelSelection')` 就是 Host 对当前会话的模型选择投影（`{ lastUsed, pending }`，客户端视图多一个 `next`）。`next.provider` 以 `deepseek` 开头即算 DeepSeek——`dsh-llm-deepseek` 注册的路由键正是 `deepseek-official`。
2. **余额地址兜底**。会话还没选过模型时投影是空的（新会话、没发过消息），此时看这次读数用的端点：`baseURL` 的域名是 `deepseek.com` 或其子域才算 DeepSeek。端点因此进了余额 store（`endpoint` action），由 apply-world 的轮询随读数一起发布——面板的数字本来就来自那条轮询，端点属于同一次读数的上下文。

两个信号都不成立时这一行根本不渲染，面板与之前完全一致。

类型上有一处妥协：`useProjection` 这个座位由 shell 的 `ui-session` 投递，而它的类型入口 import 的 `@deepseek-ai/dsh-api-session-controller` 又 peer 依赖 Host 部署包 `dsh-agent-default-model`，这条 Host 依赖图不该进插件。所以 `@deepseek-ai/dsh-client-ui-session` 只作为 devDependency 引入（让座位在类型上存在，运行时不 require 它），读到的那一层投影形状在 `BalanceBar.tsx` 里按需声明、读取处断言一次。运行时 `ui-session` 是 web profile 的常驻插件，座位一定在场；`?? NO_PROJECTION` 只是让「某个 shell 不投递座位」也不至于把读数带崩（同一挂载期内座位不会有、也不会消失，因此 hook 顺序稳定）。

### 为什么 schema 单独一个文件

浏览器半边要 `NS`、`DEFAULTS`、`BALANCE_PATH` 三个值，`Config` 只要类型；而 durable schema 必须 `import z from '@deepseek-ai/schemastery'`。两者原先同住 `src/config.ts`，于是整个 schema 库被内联进 `lib/client.js`——构建产物里 schemastery 占 22,143 字节、cosmokit 占 8,967 字节，合计 44%。把 schema 挪进只有 Host 半边引用的 `src/schema.ts` 之后，`lib/client.js` 从 70.66 kB 降到 40.71 kB（gzip 18.34 kB → 11.15 kB），客户端那份 `deps.onlyBundle` 里已无用的两项也随之删掉。

客户端本来也不需要它：`SettingsScopeSpec` 只接受 `namespace` 与可选的 `decode`，wire section 由 Host 序列化出去的 schema 校验（见 `dsh-client-ui-settings` 的 `settings-contract.d.ts`），浏览器半边不参与校验。

### 为什么没有 `dependencies` / `peerDependencies`

Host 半边把 `@deepseek-ai/dsh-brand`、`dsh-credentials`、`schemastery` 等全部内联，产物的运行时模块边只有一条 `export { Config, apply, name }`；浏览器半边只 require shell 模块表里的五个 specifier（`react`、`react/jsx-runtime`、`react-dom`、`dsh-client-store`、`dsh-client-ui-primitives`），全部由宿主提供。声明 peer 会让 pnpm 往用户 profile 里再装一份 `ui-theme` / `ui-slots`，反而和 shell 的模块表身份冲突。兼容性因此靠本文记的实测版本，而不是依赖范围。

## 版本现实

本插件对齐 **`0.1.5-rc.2`**；`devDependencies` 全部钉死在这个版本上，发布的包也只在这个版本上验证过（`0.1.5-rc.1` 同样验证过，两者对本插件用到的接口无差异）。开发期间确认了四处版本漂移：

1. **`@deepseek-ai/dsh-client-ui-plugin-manager` 只发布了 `0.1.6-alpha.2`。** 那个「插件配置」通用卡片槽位（`plugins.item` / 文档里的 `settings.plugin.item`）是 0.1.6 才有的，0.1.5 的 `ui-settings-plugin-inventory` 只是只读清单页，没有给第三方插件的配置槽位。本插件现在占的是 `settings.section`——0.1.5 就有，官方通用设置 / 模型 / 插件 / Agent 预设四个分区用的是同一个槽；早先只有一行开关与两个字段时占的是 `settings.general.item`，控件多到需要分组之后换成了整页。
2. **`@deepseek-ai/schemastery` 不用 dsh 的版本号**，它是 `3.18.2`；`@deepseek-ai/cordis` 独立版本化，是 `4.0.2`。
3. **`conversation.composer.dock` 在 0.1.5 是竖列、0.1.6 才是横排**，余额条与官方 pill 同行靠插件自己的一条规则补上（0.1.5-rc.2 仍是竖列）。
4. **宽表格补丁绑在上游的悬停切换上。** 0.1.5-rc.2 的悬停态是 `overflow-x: auto`，仓库里的源码已经改成 `overflow-x: scroll`（放得下的表格也常驻条位，于是自绘滚动条路径不再缩，但叠加式滚动条路径照旧）。这两处只要有一处变动——修改 `md-table-wide` 钩子，或上游自己取消悬停切换、让盒子在两种状态下恒定——`tableStylesheet` 就要重新评估是删掉还是改写。

升级 dsh 时这几条都可能变化：改依赖版本、重新 `npm run build`、按需重发一版。改完至少跑一遍 `npm run typecheck`（接口漂移会在类型上暴露）与下面「本地验证」里的一次浏览器实测。

## 开发循环

```sh
npm install
npm run dev        # tsdown --watch：保存即重建两个半边（约 40ms）
npm run typecheck
npm test           # pretest 先 build，再跑 tests/ 下的投影规格
npm run build
```

profile 里是 `link:` 依赖，直接指向本目录，所以构建产物一落盘就被读取，不需要重新 `dsh plugin add`。

| 改动 | 生效方式 |
|---|---|
| `src/client/**`、`src/fonts.ts`（浏览器半边） | 重建后自动热替换进已打开的页面，不用刷新。`client-hmr` 行 stat 轮询每个插件的 `lib/client.js`，变化时经 `/plugins/events` 推 `rebuilt` 帧，浏览器换掉运行中的模块。实测重建完成后约 1–2 秒生效。`src/fonts.ts` 被内联进这一份产物，所以同样搭这趟车。 |
| `src/index.ts`、`src/config.ts`、`src/balance.ts`（Host 半边） | 必须重启 `dsh web`。宿主侧的 `hmr` 行（`@deepseek-ai/cordis-plugin-hmr`）在出厂 web profile 里是 `disabled: true`，而 Node 已经缓存了 `lib/index.js`。实测改产物后 4 秒仍未生效，重启后立即生效。 |
| 两侧都改 | 先用 `npm run dev` 拿热替换，改完 Host 部分再重启一次。 |
| 兜底 | 刷新页面永远能拿到最新 `lib/client.js`：bundle URL 带 `?rev=`，rev 由产物字节与 mtime 算出，不需要清缓存。 |

## 本地验证

余额链路可以用 `tests/balance-mock.mjs`（返回上游字段名）离线走通，不碰真实账号：

```sh
node tests/balance-mock.mjs                     # 127.0.0.1:3099
# profile 的 cordis.patch.yml 里把 baseURL 指过去，启动时注入测试 key
DEEPSEEK_API_KEY=test-key dsh --profile web
```

已经验证过的内容：

- `npm run typecheck`、`npm run build` 通过；`lib/client.js` 只把模块表里的 specifier 留作 external，其余内联，banner/intro/footer 符合 `__ModuleLoader__.load({ id: "dsh-nord", … })` 契约并导出 `apply` / `inject`；产物 66.02 kB（gzip 18.76 kB）。其中拆出 `src/schema.ts` 省下的正是内联的 schemastery 与 cosmokit（70.66 → 42.26 kB）；字体选择器与独立设置页把它推回 66.02 kB，因为这一版新引了官方 `Menu` 与 `Button`（连同它们的 CSS Module 与图标），外加 `src/fonts.ts` 的预设目录与清洗逻辑。Node 半边四个产物：`lib/index.js` 36.62 kB、`lib/fonts.js` 8.19 kB、`lib/usage.js` 1.88 kB、`lib/balance.js` 1.19 kB。
- `npm test` 通过：`tests/balance.test.mjs` 的 8 条规格跑在构建产物 `lib/balance.js` 上，覆盖正常字段、多币种取首条、`is_available` 缺失或为 `false`、条目字段缺失回退、数值型余额、非字符串 `currency`，以及 `balance_infos` 缺失 / 空数组 / 非数组 / 首项非对象都归到 `malformed-response`；`tests/fonts.test.mjs` 的 17 条规格跑在 `lib/fonts.js` 上，覆盖默认值、`system` 逐字等于上游栈、`inherit` 与界面栈相等、预设解析、未知 id 回落、引号剥离、恶意字符丢弃、单条坏名字不牵连整条列表、解析结果里没有 `;{}`、通用族不加引号、CJK 与重音名字存活、去重与两项上限。
- 调色板：直接求值 `nordTokens()` 得 116 项（81 alias + 10 specific + 25 static），`--dsw-alias-bg-base` = `{light:#ECEFF4, dark:#2E3440}`。
- 安装：`dsh plugin add` 后 `dsh.profile.bundles` 追加成功，`--dump-config` 出现 `# == dsh-nord` 层；tarball 安装路径同样验证过（见下节彩排）。
- 启动：shell 的预载列表含 `dsh-nord/client.js`，combo 路由内容含本包注册与 `dsh-nord-surfaces` 样式表。
- Host 路由：`GET /nord/balance` 在浏览器会话栅栏后返回 200；无凭据 `{"error":"credentials-missing"}`；接 mock 后返回 `{"currency":"CNY","total":"42.50","granted":"2.50","toppedUp":"40.00","available":true,…}`。
- 路由的响应头与动词（页面内实测）：GET 200 且 `cache-control: no-store`；`POST` 得到 405、`allow: GET`、空体。
- 排版（隔离实例 + headless Edge 打开真实页面）：出口节点内联样式仍是 `display: contents`、计算值变成 `flex`；出口的两个子节点是官方 pill 行（`1 轮 1 步`，top 870、高 26、`padding-top` 4）与余额条（top 874、高 22、`margin-top: 4px`、`padding: 1px 8px`、`border-radius: 24px`、图标 16×16），后者计算字号 13px、字体 Maple Mono、行高 20px，两行文字同起于 875。
- 面板：`role="dialog"`、300×159、位于读数上方 `874 − 8 − 159 = 707`、左边缘与读数对齐，圆角 12、内边距 16、字号 12/18、背景即 Nord `nord4`；四行明细取值正确；Escape 关闭；等过一个刷新周期后面板仍开着、数值不变而更新时间前进。载体会话用的是 DeepSeek 模型，所以「用量信息」一行在面板里，重拍时面板实测 300×185（`185 = 159 + 18 + 8`，即那一行的行高与上边距），位置随之变成 `874 − 8 − 185 = 681`；这里原先记的 159 是「用量信息」这一行还不存在时的数值。这是条件行，不是回归——同一支探针打在面板上确认过 `[data-dsh-nord-usage]` 存在。
- 字体选择器（`node scripts/shots/verify-settings.mjs`，隔离实例 + headless Edge 实测）：只写旧五个键的 `cordis.patch.yml` 仍能启动，四个新字段由 schema 默认值补齐，`--dsw-font-family` = Maple Mono 栈、`--ds-font-family-code` = Maple Mono 栈 + `ui-monospace` 等宽回退；界面字体菜单 10 行（跟随系统 + 8 预设 + 自定义…）、代码字体菜单 11 行（多一行「跟随界面字体」）；菜单经 portal 渲染，卡片 218×357 完整落在视口内（`@ 878,531`），未被设置面板的 overflow 裁掉；8 个预设行各自用自己的字体栈渲染，触发按钮用当前生效栈；换界面字体只动 `--dsw-font-family`，换代码字体只动 `--ds-font-family-code`，选「跟随界面字体」后两个 token 相等；从菜单里选「自定义」后在空字段上直接 `Tab` 离开不会改字体（原选择不变、字段收起），而清空一个已经是 `custom` 的字段会提交——空列表解析成尾栈；自定义串 `Arial; } html { --pwn: 1px !important; } :root {` 被整条丢弃——样式表里花括号恰好一对、`--pwn` 计算值为空，token 回落到尾栈；正常串 `'LXGW WenKai', Microsoft YaHei, sans-serif` 按逗号拆开后重新加引号拼装；`settings.yaml` 落盘 `uiFont: custom` / `uiFontCustom` / `codeFont: inherit`；全程无 console 报错。
- 设置页（`node scripts/shots/verify-settings.mjs`，同一套隔离实例）：左栏实测 `通用设置 | 模型 | 插件 | Agent 预设 | Nord 主题`，本插件一行在官方四个分区之后；点「通用设置」后整屏文本里搜不到 `Nord 配色` / `底部余额条` / `界面字体` / `API 地址`，确认设置已从「通用」搬走；点左栏那一行后 `[data-dsh-nord-settings]` 恰好一个，页面 `<h2>` 是「Nord 主题」、三个 `<h3>` 是「外观 / 字体 / 余额条」，整页 681px 高落在 746px 的内容列里（列不出现纵向滚动），宽 564px 等于列的可用宽度、不撑横向滚动。三个 `role="switch"` 控件尺寸 36×20，右边缘与所在行右边缘齐平；每行标签下是 12/18 的说明文字；两个 `Input` 实宽 98 与 262；点「底部余额条」后 `aria-checked` 转 `false` 且 `settings.yaml` 落盘 `dsh-nord: balanceEnabled: false`，再点回 `true` 同样落盘。字体选择器带来两个 `aria-haspopup="menu"` 的触发按钮（`size="sm"` 的 outline 胶囊，定宽 200px）与按需出现的自定义 `Input`；两个下拉在「替换字体」关掉时一起进入禁用态。
- 设置字段可编辑（同一套隔离实例，键盘实测）：把刷新间隔从 15 改成 90 必须经过中间态 `9`——输入框里依次显示 `9`、`90`，`Tab` 失焦后落盘 `refreshSeconds: 90`；只输入 `9` 再 `Tab` 会弹回 `90`，且不写盘。URL 字段整段换成 `http://127.0.0.1:3099/` 后 `Tab` 落盘 `baseURL`。改成 `defaultValue` + `key` 之前，同一套操作会被 React 还原成原值，字段实际上改不动。
- 余额轮询不再被无关设置唤醒：空闲 4 秒窗口内 0 次 `/nord/balance`；拨动「Nord 配色」开关关掉再打开，两次点击前后各 0 次（改前每次点击 2 次——一次乐观发布、一次落盘确认各触发一轮重启）。
- 余额读数在会话切换后仍然刷新（修掉的 bug，复现脚本 `scripts/shots/poll-repro.mjs`：隔离 home + 每次请求把余额 +1 的 mock，所以条上的数字就是读数的新鲜度）。dock 槽位是 session 作用域、store 按会话各建一个实例，而渲染侧把 entry 的 inject 结果按 (entry × 绑定) 缓存——换到别的会话再换回来时 inject 不会重跑。修前实测：留在 A 时 43 → 45 正常，切到 B 后 46 → 48，切回 A 停在 45；随后 40 秒里 mock 又收了 3 次 `/nord/balance`（轮询一直在跑），而 A 始终是 45；再切到 B 显示 51——写的一直是 B 的 store。修后同一条路径：切回 A 直接显示 48，并继续 48 → 51。
- 轮询的三处守卫：结果只在被更晚的请求超越时丢弃（原先「只要有更新的请求已发起就丢弃」，响应持续慢于轮询间隔时会永久冻住且没有任何提示）；每次读取带 20 秒 `AbortSignal.timeout`，响应不是 JSON 时归到 `request-failed`；页面重新可见时立刻补一次读取（隐藏标签页的 interval 会被浏览器节流甚至冻结）。Host 侧 `credentials.resolve()` 移进 try：它抛错时原先会逃出处理器、由 webserver 兜成空 400，现在与其它失败一样回 JSON 载荷。
- 余额开关联动：关掉「底部余额条」后读数从 dock 消失，同一页里的刷新间隔与 API 地址两个字段同时进入禁用态；打开后恢复可编辑。
- 面板「更新时间」走字典模板：中文界面实测 `2026年9月20日 22:29`（模板 `{y}年{m}月{d}日 {time}`，英文为 `{y}-{m}-{d} {time}`）；改用 `toLocaleString()` 时同一台机器上显示的是浏览器语言的 `2026/9/20 22:19:36`，界面切到英文也不会跟着变。
- 观感：`assets/` 里的三张截图就是在这套隔离实例里拍的（`01` / `03` 拍在 `0.1.5-rc.1`；`02` 在字体选择器与独立设置页之后重拍，排版实测与上面一致）。
- 宽表格补丁（headless Edge + Playwright，按 `0.1.5-rc.2` 的原样 CSS 复现，四列「放得下」与十二列「溢出」各一份，`--hide-scrollbars` 与默认自绘条两种路径）：上游现状下「放得下」的表格在两条路径上都从 77px 缩到 69px（盒底上移，指针被甩出），叠加式滚动条路径下溢出的表格同样 77 → 69。固定 8px 预留的写法在自绘条路径下让溢出的表格 77 → 85（下方内容下移 8px）。本补丁的写法在四个组合里都是静止与悬停同值（叠加式滚动条下两种表格都 69px；8px 自绘条下，放得下的 69px、溢出的 77px），表格下方内容位置不动。

## 发布到 npm

一行 `npm publish` 在这个仓库里不够用：本机 `~/.npmrc` 的 registry 指向只读的腾讯镜像，而发布前有几项事实必须核查（工作树、元数据、tarball 内容、registry 上的版本与维护者）。`scripts/publish-npm.mjs` 把这些串成一条带闸门的流水线，**默认只核查不发布**：

```sh
npm run release:check              # = node scripts/publish-npm.mjs：跑完六道闸门，打 tarball，不发布
npm run release                    # = ... --publish：真发布
```

**经 `npm run` 传参要放在 `--` 之后**，否则 npm 会把参数当成自己的配置项——实测 `npm run release --no-tests` 会被解析成 `--tests` 并报 `npm error`。所以：

```sh
npm run release -- --smoke                 # 发布 + 从 registry 冒烟装一遍
npm run release -- --bump patch --smoke    # 升版发布
```

```sh
# 首次发布前，先把两处会被闸门挡住的东西改掉（脚本会直接给出这两条命令）
node scripts/publish-npm.mjs --set-license "Verdana" --create-repo-field

# 查一遍（不需要 npm 账号）
npm run release:check

# 登录 + 发布 + 打 git tag + 发布后从 registry 冒烟装一遍（首次发布 0.1.0，不需要 --bump）
npm login --registry https://registry.npmjs.org/
node scripts/publish-npm.mjs --publish --smoke
```

六道闸门，任一不过就停：

| # | 闸门 | 不过时的含义 |
|---|---|---|
| 1 | 工作树干净、在 main/master 上 | 发出去的东西对不上任何提交（`--allow-dirty` / `--allow-branch` 可放行，不推荐） |
| 2 | `name` / `version` / `license` / `files` / `dsh` 段齐全，LICENSE 版权人不是占位符，`repository` 在 | 包页截图裂掉、dsh 认不出这是插件包、版权人写着「contributors」 |
| 3 | `typecheck` + `test` + `build` 全过 | 按 `package.json` 里的 script 跑，输出直接透传 |
| 4 | tarball 恰好是那 8 个文件 | 少了产物（`files` 写漏）或混进 `src/`、`tests/` |
| 5 | registry 上没有这个版本、包名维护者包含当前登录身份 | 同版本重发会被 npm 拒（`--bump patch` 解决）、发到别人的包上会 403 |
| 6 | `npm publish` | 默认跳过；`--publish` 才走 |

几个设计点：

- **只有一道确认闸门：`--publish`。** 不带它一律只核查，并在结尾打印确切的发布命令；带了它就直接发。早期版本额外要一个 `--yes`，那是多余的第二道确认——不但没增加安全，还会在 `npm run release --yes` 这种写法下静默失效（参数被 npm 吃掉），已经去掉。老命令里残留的 `--yes` 仍被接受，但会提示一句已不需要。
- **`--bump` 只改 `package.json`**（`npm version --no-git-tag-version`），git commit 与 `v<版本>` tag 放在**发布成功之后**打——发布失败不该在仓库里留一个悬空的版本提交。
- **`--set-license` / `--create-repo-field` 是幂等的**，只做那一处替换；`repository` 从 `git remote.origin.url` 推 owner/repo。
- **凭据只在真要发布那一步碰**：`NPM_TOKEN` 环境变量会被写成仓库级 `.npmrc`，发布结束立刻删掉；核查阶段永远不写。
- 发布后 `--smoke` 会直接调用 `release-lab.mjs npm --registry <registry>`，从 registry 真装一遍；刚推上去可能有一两分钟传播延迟，失败不代表包有问题。

本机前提（脚本会检查并在缺的时候给出确切命令）：

- **`npm login --registry https://registry.npmjs.org/`** —— 本机 `~/.npmrc` 的 registry 指向 `mirrors.cloud.tencent.com`，镜像是只读的；`npm login` 与 `npm publish` 都必须显式带 `--registry`，否则 login 会去登录镜像、publish 会往镜像推。
- 无 scope 的包名默认 public；`--access public` 只在改成带 scope 的名字（如 `@you/dsh-nord`）时才需要，脚本会按包名自动加。
- `~/.npmrc` 里的 `proxy` / `https-proxy` / `strict-ssl=false` 脚本原样继承，不覆盖。

发布前彩排（不需要 npm 账号，也不碰网络）：

```sh
npm run release:check                                 # 六道闸门 + tarball 内容清单
node scripts/release-lab.mjs link tarball             # 用隔离 home 把这两条装法过一遍
```

发新版本：`node scripts/publish-npm.mjs --bump minor --publish`（`--bump` 取值同 `npm version`：修 bug 用 `patch`、加能力用 `minor`）→ 用户侧 `dsh plugin --profile web update dsh-nord`（`dsh plugin` 把参数转发给 pnpm）。

发布包只含 `lib/`、`cordis.patch.yml`、`README.md`、`LICENSE`、`package.json`（10 个文件：`lib/` 下 6 个 —— `index.js`、`balance.js`、`usage.js`、`fonts.js`、`client.js` 与 `client.js.map`）；`src/`、`tests/`、`scripts/`、`assets/`、`tsdown.config.ts`、`tsconfig.json` 都不进包，第 4 道闸门会核对这份清单。

## 发布后的四种安装方式，一次跑完

用户能走的装法有四条，各自的坑不同；一条条在真实 profile 上 `dsh plugin add/remove` 验证又慢又脏（每次都改你自己的 profile、装一遍又卸一遍）。`scripts/release-lab.mjs` 把这件事收敛成一条命令：

```sh
node scripts/release-lab.mjs                      # 四种方式全跑（git 首次约 1–2 分钟）
node scripts/release-lab.mjs link tarball         # 只跑给本地用的两条，完全不碰网络
node scripts/release-lab.mjs npm --registry https://registry.npmjs.org/
node scripts/release-lab.mjs --keep --no-boot     # 只查装卸，保留现场
```

等价别名：`npm run lab` = `node scripts/release-lab.mjs`（参数用 `--` 传，例如 `npm run lab -- link tarball`）。

它凭什么干净：`@deepseek-ai/dsh-home-paths` 先看 `$DSH_HOME`，所以脚本把它指到仓库里的 `.release-lab/home`（已 gitignore），每种方式配一个一次性 profile（`lab-link` / `lab-tarball` / `lab-npm` / `lab-git`）。**你的 `~/.dsh` 全程不被触碰，脚本也不提供指向真实 profile 的开关。**

每种方式依次过四道：

| 检查 | 看什么 | 能抓住什么 |
|---|---|---|
| install | `dsh plugin --profile lab-<方式> add <spec>` 退出码 | spec 解不开、registry 上没有、git 被 `allowBuilds` 拦下 |
| layer | `dsh --dump-config` 里有 `# == dsh-nord` | 依赖装上了但没进 `dsh.profile.bundles`（`dsh.bundle.patch` 没被认出来） |
| resolve | profile 的 `node_modules/dsh-nord` 里 `package.json` + `cordis.patch.yml` + `lib/index.js` + `lib/client.js` 都在且非空 | 装了个空壳、软链指向不存在的路径、`files` 漏了产物 |
| boot | `dsh --no-open --port 0` 起一次，抓首页 `__DSH_BOOT__` 的 entries | 客户端半边没注册、`dsh.client.inject` 与 `package.json` 声明不一致、`/plugins/??dsh-nord/client.js` 取不到 |

第四道是最有价值的一道，也是手工最容易省掉的一道：`--dump-config` 只看得到 Host 半边，客户端半边是否进了 shell 的预载列表，只有把首页抓下来看 `__DSH_BOOT__` 才知道。首页要用启动时打印的 `?token=` 换一次 cookie 才能访问（直接请求 `/` 是 401），脚本跟这一次 303 并带上 cookie。

各方式实测（本机；npm 那条尚未发布，跑出来是预期的失败）：

| 方式 | profile 里的 spec | 冷启动耗时 | 备注 |
|---|---|---|---|
| link | `link:D:/deepseek-harness/dsh-nord` | ~1s | 软链指回工作树，改动落盘即生效 |
| tarball | `file:…/.release-lab/artifacts/dsh-nord-0.1.0.tgz` | ~1s（`npm pack` 另计） | 走 `prepare` 重新构建，装的是包内真实文件 |
| npm | `dsh-nord@latest` | 看 registry | 本机 `~/.npmrc` 指向只读镜像，必须 `--registry https://registry.npmjs.org/`；未发布时在 `npm view` 处直接失败 |
| git | `github:verdana/dsh-nord` | 首次 ~40s（clone + 装 91 个 devDependency + 构建） | 首次必被 `allowBuilds` 拦下 |

git 那条的 `allowBuilds` 是唯一需要人工介入的地方，脚本替你做掉：`dsh plugin` 失败时 pnpm 会把要粘贴的键值打进错误里（形如 `dsh-nord@https://codeload.github.com/<owner>/<repo>/tar.gz/<sha>: true`），脚本把它抓出来插进该 profile 的 `pnpm-workspace.yaml` 再重试一次。注意 pnpm 会按终端宽度折行，这段文本要**删掉所有空白再匹配**，否则抓不全；插入用文本插入而不是 YAML 重写，注释与缩进原样保留，重复调用幂等。

局限说清楚：

- **这里验证的是「装得上、装得对、加载得起来」，不是功能。** 界面、余额、设置项的实测还是 DEVELOPMENT.md 上面「本地验证」那套隔离实例 + headless Edge 的流程。
- **npm 方式装的是 registry 上的版本，不是当前工作树。** 本地版本与已发布版本不一致时脚本会黄字提示，别把它当成「这次改动已发布」的证据。
- **git 方式不锁定 commit。** 默认用 `github:<owner>/<repo>`（owner/repo 从 `repository` 字段或 `git remote` 推），要复现某个提交请自己给 `--git github:<owner>/<repo>#<sha>`。
- 每种方式各占一份 `node_modules`（互不共享），`.release-lab` 会到几百 MB 量级；不加 `--keep` 时跑完自动删。

## 截图怎么来的

`assets/` 里三张 README 截图是脚本拍的，不是手点的：

```sh
node scripts/shots/capture.mjs      # 覆盖 assets/01-theme.png、02-settings.png、03-balance.png
```

它复用 `release-lab` 那一招——`DSH_HOME` 指向 `.shot-lab/home`（已 gitignore），主 home 全程不被碰——然后：

1. `scripts/shots/lab.mjs` 铺隔离 home：`ui-theme.preference: dark`、`locale: zh`、预置 `ui-onboarding.welcomeNoticeVersion` 免掉「内测声明」弹窗。
2. 载体是一个**真实会话**：`D:\deepseek-harness\dsh-nord` 工作区里的会话整份拷进隔离 home（含 `storages/session_projcache` 里的摘要，否则侧栏列不出来），再用 Edge 在侧栏点开它。只读，不改原文件。
3. 余额走本地 mock（`lab.mjs` 里的 `createBalanceMock`），数值与 `tests/balance-mock.mjs` 完全一致：`42.50 / 2.50 / 40.00`。profile 的 `cordis.patch.yml` 把 `baseURL` 指到它。
4. 页面按 `deviceScaleFactor: 2` 渲染（1440×900 逻辑像素 → 2880×1800 实际像素），再用 sharp 降到目标像素，等价 2x 清晰度。局部图按目标长宽比取裁剪区，缩放不变形。

三张图的舞台尺寸刻意与旧图一致：`01` 1440×900、`02` 816×816（就是设置对话框的 800×800 加一圈背景）、`03` 900×221。实测坐标与「本地验证」里记的一致——余额条 `y=874`，面板在其上方 8px（带上「用量信息」一行时 `300×185`，`681 = 874 − 8 − 185`）。

三个踩过的坑，改脚本前先看：

- **余额条挂在 `conversation.composer.dock`，而空会话的 hero 页不渲染这个槽。** 在 hero 页上余额条根本不挂载，所以截图必须落在一个真正打开的会话里——这是整个脚本要先「点开会话」的原因。判断依据是 `document.querySelector('[data-slot="conversation.composer.dock"]')` 是否存在，不是页面看起来像不像会话。
- **当前 dsh 的槽位名是 `conversation.input.dock`。** 源码树（0.1.6-alpha.2）两个名字都在，`composer.dock` 是旧的；本机 `dsh` CLI 是 0.1.5-rc.2（`~/.npmrc` 之外还有一份全局安装），它挂的容器叫 `conversation.input.dock`。插件注册的是 `composer.dock`，在这个版本的会话页里能正常渲染，但换 build 时值得复核一遍。
- **`02` 拍的是本插件自己那一页，得先点开左栏。** 设置面板打开时默认停在「通用设置」，而插件的设置已经不在那儿了；脚本因此等左栏出现「Nord 主题」这一行、点它、再等 `[data-dsh-nord-settings]` 挂上，才量对话框矩形。用文本等左栏行是刻意的：分区 id 是插件自己的常量，页面上只有标签是稳定的可断点。

另外两处细节：载体会话的正文每次都取当下的最新内容（`01` 拍到的是拍摄那一刻的会话尾部），所以重拍时图里的对话文字会变、几何不会——上面那组坐标就是重拍两次核对过的；`npm pack` / `npm publish` 之外不要手工动 `assets/`，脚本是唯一来源；`sharp` 与 `playwright-core` 是这套流程的开发依赖，用本机 Edge（`channel: 'msedge'`），不下载 Chromium。

## 已知限制

- **没有样式管线。** 仓库内插件用 CSS Modules + 共享 `--dsw-*` token，由仓库的 tsdown preset 在编译期注入样式；树外构建拿不到这一步。设置页的标题层级、分组标签、行距用内联 style，控件本身用模块表里的官方 `Switch` / `Input` / `Menu`（它们的 hover / focus / 展开皮肤由 ui-primitives 自己的 CSS Modules 带进来）；余额条与面板由插件自己的一枚 `<style>`（`surfaceStylesheet`）承载——内联 style 表达不了 `:hover` 与 `[aria-expanded]`，而那正是它作为按钮需要的状态。代价是这几条声明是从官方 pill 与官方对话框的 CSS 手工抄来的，官方改版就得手工同步。
- **设置页的分区图标是齿轮。** 左栏图标由 shell 的 `navIcon(id)` 硬编码，只认得官方的 `models` / `agent-presets` / `plugins`，其余 id 一律回落到齿轮；`settings.section` 没有传图标的座位，第三方页面改不了这一处。
- **`faint` 色是超出 Nord 十六色的一个中性台阶**（`#7B88A1`）。官方色阶从 nord3 `#4C566A` 直接跳到 nord4 `#D8DEE9`，中间没有可用于深色背景上 caption/dimmed 文字的台阶；不用它这几处会不可读。
- **`baseURL` 只在设置里改**，不改 `llm-deepseek` 的配置。参考插件会去读 `llm-deepseek` 段的 `baseURL`；那需要窥探另一个命名空间。
- **余额接口的可用性取决于上游。** DeepSeek 的 `/user/balance` 不是文档化的稳定契约；字段名变化时 `src/balance.ts` 的 `BalanceInfo` 与 `parseBalance()` 需要同步。
- **刷新间隔与 API 地址在失焦时才落盘。** 输入过程中不写库，所以敲完值直接用 Escape 关掉设置面板会丢掉这次编辑；点一下别处或 `Tab` 走焦点才会提交。字段是 `defaultValue` + `key` 的非受控写法，React 会在存储值变化时按 `key` 重挂载输入框，代价是重挂载那一刻焦点与光标位置重置——只发生在写入成功后，此时字段本来就没有焦点。
- **字体预设不做可用性探测。** 没装的那一档会静默落到栈里的下一个家族，界面不会提示「未安装」。`document.fonts.check()` 是实现相关的启发式，`queryLocalFonts()` 只有 Chromium 有且要权限弹窗，两条都不值得为一个提示引入；下拉行用自身字体渲染，所以没装时看到的就是回退后的样子。
- **自定义字体串在失焦时才落盘**，与上面两个字段同一套非受控写法，所以同一个「Escape 关掉面板会丢编辑」的代价。提交一次自定义要写两个字段（先 `*FontCustom` 再 `*Font`），第二次写等第一次落定后才发；两次写之间界面不变，因为选择字段还没动。从菜单里选「自定义」然后在空字段上离开算取消（不改字体、字段收起），只有在一个已经是 `custom` 的字段上清空才算提交——那会解析成尾栈，也就是该角色的中文/平台回退那一条。
