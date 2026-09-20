# DEVELOPMENT

面向要改这个插件的人。用户向的安装与用法在 [README.md](README.md)。

## 项目结构

```
src/index.ts               Host 半边：设置段 + GET /nord/balance 路由
src/config.ts              配置 schema、默认值与 NS / BALANCE_PATH 常量
src/balance.ts             Host ↔ 浏览器之间的余额载荷类型
src/client/index.ts        浏览器半边：主题层、字体、样式表、设置卡、余额轮询、两个 slot 注册
src/client/nord.ts         Nord 调色板（116 token）、字体栈、余额表面的 CSS
src/client/BalanceBar.tsx  余额读数与其明细面板
src/client/NordCard.tsx    设置行的开关与字段
src/client/stores.ts       设置卡与余额的 slot store
src/client/locales.ts      `dshNord` 命名空间的中英文案
tests/balance-mock.mjs     上游 `/user/balance` 的本地替身
assets/                    README 截图
```

`tsdown.config.ts` 构建两个半边：`src/index.ts` → `lib/index.js`（Node 半边，Loader 挂载），`src/client/index.ts` → `lib/client.js`（浏览器半边，Web shell 经 `/plugins` combo 路由取）。后者必须精确匹配模块系统的线格式：注册 banner/footer 包住的 CJS 体，`module`/`exports` 由 intro 引入。

## 能力与机制一览

| 能力 | 机制 |
|---|---|
| Nord 配色 | `ctx.theme.overrideTokens('dsh-nord', tokens)` —— 116 个 token，每个带 `{ light, dark }` 两个值，官方按当前配色自动取值 |
| Maple Mono 字体 | 一枚 `<style>` 里的 `:root` 规则 |
| 余额 | Host 侧 `webServer` 上的 `GET /nord/balance`，用 `ctx.credentials` 解析 `DEEPSEEK_API_KEY`；浏览器侧是 dock 里一枚可点击读数 + 明细面板 |
| 设置项 | Host `ctx.settings.installSection()` + 浏览器侧 `settings.general.item` 行，持久化进 `settings.yaml` |
| 设置卡控件 | 模块表基线里的 `@deepseek-ai/dsh-client-ui-primitives`：布尔项用 `Switch`、字段用 `Input`，行距与配色走内联 style |
| 余额表面的样式 | 插件自己的一枚 `<style>`（`surfaceStylesheet`）：dock 行规则、读数皮肤、面板皮肤 |

### 为什么配色走 `overrideTokens` 而不是「注册一个主题」

官方 `ThemeRuntime.register()` + `setTheme()` 那条路对第三方主题是不完整的：`ui-theme` 的 settings schema 只接受 `light | dark | system`，第三方 theme id 存不进去；而 `adopt()` 会在设置就绪或变化时把内存偏好覆盖回内置值——刚切换成功的主题下一个 tick 就被打回 `light`。

`overrideTokens(source, tokens)` 是官方为此准备的入口：把一层 token 叠在当前活动主题之上，按注册顺序逐 token 覆盖，移除即还原，`composeActive` 按 `active.colorScheme` 自动挑 `light` / `dark`。官方 `theme-presenter` 通过 `body.style.setProperty` 写入这些变量，所以卸载插件时主题自动消失，不会残留。

覆盖分三类共 116 项：

- **81 个 `--dsw-alias-*`** —— 官方 alias 层的完整覆盖，不靠 `!important`、不靠 DOM 手术。
- **10 个 `--dsw-specific-*`** —— 侧边栏、composer、选择器这些具名表面。
- **25 个 `--dsw-static-*`** —— 补丁。有一批组件（计划卡、交付物、指南正文、文件类型图标、加载渐变）绕过 alias 直接读静态色阶，官方 light 把这些取成近白，在 Nord 画布上就是一个个白框。这是「浅色露白框」的真正成因，只覆盖 alias 治不了。

### 设置卡为什么能用官方控件

`@deepseek-ai/dsh-client-ui-primitives` 是 Web shell 预置进模块表的基线模块（`packages/client/web/src/platform.ts` 的 `PLATFORM_MODULES`），所以树外插件的 `require` 拿到的就是官方设置行用的那个模块实例，而不是打包进来的第二份：`Switch` 的胶囊皮肤、焦点环、禁用态与 `Input` 的聚焦边框都不必自己写，也不必担心 React 上下文重复。

设置卡其余部分（行距、标签与说明文字的层级、字段宽度）仍是内联 style —— 树外构建没有 CSS Modules 管线，而这些声明也不需要 `:hover` / `:focus` 状态。布尔项从原生 checkbox 换成 `Switch` 也是同一个理由：勾选框在不同浏览器与配色模式下样式不可控，开关的外观则由设计系统持有。

### 为什么字体是一枚 `:root` 规则

`base.css` 在 `:root` 里定义 `--dsw-font-family` 与 `--ds-font-family-code`，而 `--dsw-font-markdown-*`、`--dsw-font-<size>-*-font-family` 这些复合族全部在 `:root` 上以 `var(--dsw-font-family)` 声明。CSS 自定义属性的 `var()` 在声明处求值，所以写在 `body` 上的覆盖永远传不到那些复合族里。

一枚由插件持有、卸载即移除的 `<style>`，用 `:root` 选择器赢得与上游 `:root` 的层叠，全部派生族自动跟随——不用枚举 50 多个变量。

代码字体栈按 `base.css` 自己的记录不带裸 `monospace` 尾巴：Windows CJK 会经它回退到 SimSun。

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

### 为什么没有 `dependencies` / `peerDependencies`

Host 半边把 `@deepseek-ai/dsh-brand`、`dsh-credentials`、`schemastery` 等全部内联，产物的运行时模块边只有一条 `export { Config, apply, name }`；浏览器半边只 require shell 模块表里的五个 specifier（`react`、`react/jsx-runtime`、`react-dom`、`dsh-client-store`、`dsh-client-ui-primitives`），全部由宿主提供。声明 peer 会让 pnpm 往用户 profile 里再装一份 `ui-theme` / `ui-slots`，反而和 shell 的模块表身份冲突。兼容性因此靠本文记的实测版本，而不是依赖范围。

## 版本现实

本插件对齐 **`0.1.5-rc.2`**；`devDependencies` 全部钉死在这个版本上，发布的包也只在这个版本上验证过（`0.1.5-rc.1` 同样验证过，两者对本插件用到的接口无差异）。开发期间确认了三处版本漂移：

1. **`@deepseek-ai/dsh-client-ui-plugin-manager` 只发布了 `0.1.6-alpha.2`。** 那个「插件配置」通用卡片槽位（`plugins.item` / 文档里的 `settings.plugin.item`）是 0.1.6 才有的。0.1.5 时代的 `ui-settings-plugin-inventory` 只是只读的插件清单页，没有给第三方插件的配置槽位。所以设置卡挂在 0.1.5 就存在、且文档明确写着「一个设置项就够、不需要独立页面的功能插件贡献」的 `settings.general.item` 上——官方外观行与字号行用的是同一个槽。
2. **`@deepseek-ai/schemastery` 不用 dsh 的版本号**，它是 `3.18.2`；`@deepseek-ai/cordis` 独立版本化，是 `4.0.2`。
3. **`conversation.composer.dock` 在 0.1.5 是竖列、0.1.6 才是横排**，余额条与官方 pill 同行靠插件自己的一条规则补上（0.1.5-rc.2 仍是竖列）。

升级 dsh 时这几条都可能变化：改依赖版本、重新 `npm run build`、按需重发一版。改完至少跑一遍 `npm run typecheck`（接口漂移会在类型上暴露）与下面「本地验证」里的一次浏览器实测。

## 开发循环

```sh
npm install
npm run dev        # tsdown --watch：保存即重建两个半边（约 40ms）
npm run typecheck
npm run build
```

profile 里是 `link:` 依赖，直接指向本目录，所以构建产物一落盘就被读取，不需要重新 `dsh plugin add`。

| 改动 | 生效方式 |
|---|---|
| `src/client/**`（浏览器半边） | 重建后自动热替换进已打开的页面，不用刷新。`client-hmr` 行 stat 轮询每个插件的 `lib/client.js`，变化时经 `/plugins/events` 推 `rebuilt` 帧，浏览器换掉运行中的模块。实测重建完成后约 1–2 秒生效。 |
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

- `npm run typecheck`、`npm run build` 通过；`lib/client.js` 只把模块表里的五个 specifier 留作 external，其余内联，banner/intro/footer 符合 `__ModuleLoader__.load({ id: "dsh-nord", … })` 契约并导出 `apply` / `inject`。
- 调色板：直接求值 `nordTokens()` 得 116 项（81 alias + 10 specific + 25 static），`--dsw-alias-bg-base` = `{light:#ECEFF4, dark:#2E3440}`。
- 安装：`dsh plugin add` 后 `dsh.profile.bundles` 追加成功，`--dump-config` 出现 `# == dsh-nord` 层；tarball 安装路径同样验证过（见下节彩排）。
- 启动：shell 的预载列表含 `dsh-nord/client.js`，combo 路由内容含本包注册与 `dsh-nord-surfaces` 样式表。
- Host 路由：`GET /nord/balance` 在浏览器会话栅栏后返回 200；无凭据 `{"error":"credentials-missing"}`；接 mock 后返回 `{"currency":"CNY","total":"42.50","granted":"2.50","toppedUp":"40.00","available":true,…}`。
- 排版（隔离实例 + headless Edge 打开真实页面）：出口节点内联样式仍是 `display: contents`、计算值变成 `flex`；出口的两个子节点是官方 pill 行（`1 轮 1 步`，top 870、高 26、`padding-top` 4）与余额条（top 874、高 22、`margin-top: 4px`、`padding: 1px 8px`、`border-radius: 24px`、图标 16×16），后者计算字号 13px、字体 Maple Mono、行高 20px，两行文字同起于 875。
- 面板：`role="dialog"`、300×159、位于读数上方 `874 − 8 − 159 = 707`、左边缘与读数对齐，圆角 12、内边距 16、字号 12/18、背景即 Nord `nord4`；四行明细取值正确；Escape 关闭；等过一个刷新周期后面板仍开着、数值不变而更新时间前进。
- 设置卡（同一套隔离实例）：`通用` 段里只有这三个 `role="switch"` 控件，尺寸 36×20，右边缘与所在行右边缘齐平；每行标签下是 12/18 的说明文字；两个 `Input` 实宽 98 与 262；点「底部余额条」后 `aria-checked` 转 `false` 且 `settings.yaml` 落盘 `dsh-nord: balanceEnabled: false`，再点回 `true` 同样落盘。
- 观感：`assets/` 里的三张截图就是在这套隔离实例里拍的（`01` / `03` 拍在 `0.1.5-rc.1`；`02` 设置卡在 `0.1.5-rc.2` 上重拍，rc.2 的排版实测与上面一致）。

## 发布到 npm

包已是可发布形态（`license` / `files` / `prepublishOnly` 齐备）。发布前有三处要改：

1. `LICENSE` 里的版权人（当前写的是 `dsh-nord contributors`）。
2. `package.json` 里加上 `repository`（`{"type":"git","url":"git+https://github.com/<you>/dsh-nord.git"}`）——npm 页面靠它把 README 里的相对图片路径指到仓库；不加的话包页上的截图是裂的。
3. 版本号（首次发布 `0.1.0` 即可）。

```sh
npm login   --registry https://registry.npmjs.org/
npm publish --registry https://registry.npmjs.org/
```

两个本机前提：

- 本机 `~/.npmrc` 的 registry 指向 `mirrors.cloud.tencent.com`；镜像是只读的，所以 **`npm login` 与 `npm publish` 都要显式给 `--registry https://registry.npmjs.org/`**（`npm login` 不带这个参数会去登录镜像）。
- 无 scope 的包名默认 public；`--access public` 只在改成带 scope 的名字（如 `@you/dsh-nord`）时才需要。

发布前彩排（不需要 npm 账号）：

```sh
npm pack                                              # 产出 dsh-nord-0.1.0.tgz
dsh --profile tarball --from-default-profile web      # 建一个干净 profile
dsh plugin --profile tarball add ./dsh-nord-0.1.0.tgz
dsh --profile tarball --dump-config                   # 应出现 "# == dsh-nord"
dsh --profile tarball                                 # 起来看一眼
```

卸载：`dsh plugin --profile tarball remove dsh-nord`。

发新版本：改 `version` → 重新 `npm publish` → 用户侧 `dsh plugin --profile web update dsh-nord`（`dsh plugin` 把参数转发给 pnpm）。

发布包只含 `lib/`、`cordis.patch.yml`、`README.md`、`LICENSE`、`package.json`；`src/`、`tests/`、`assets/` 不进包。

## 已知限制

- **没有样式管线。** 仓库内插件用 CSS Modules + 共享 `--dsw-*` token，由仓库的 tsdown preset 在编译期注入样式；树外构建拿不到这一步。设置卡的行距与文字层级用内联 style，控件本身用模块表里的官方 `Switch` / `Input`（它们的 hover / focus 皮肤由 ui-primitives 自己的 CSS Modules 带进来）；余额条与面板由插件自己的一枚 `<style>`（`surfaceStylesheet`）承载——内联 style 表达不了 `:hover` 与 `[aria-expanded]`，而那正是它作为按钮需要的状态。代价是这几条声明是从官方 pill 与官方对话框的 CSS 手工抄来的，官方改版就得手工同步。
- **`faint` 色是超出 Nord 十六色的一个中性台阶**（`#7B88A1`）。官方色阶从 nord3 `#4C566A` 直接跳到 nord4 `#D8DEE9`，中间没有可用于深色背景上 caption/dimmed 文字的台阶；不用它这几处会不可读。
- **`baseURL` 只在设置里改**，不改 `llm-deepseek` 的配置。参考插件会去读 `llm-deepseek` 段的 `baseURL`；那需要窥探另一个命名空间。
- **余额接口的可用性取决于上游。** DeepSeek 的 `/user/balance` 不是文档化的稳定契约；字段名变化时 `src/index.ts` 的 `BalanceInfo` 需要同步。
