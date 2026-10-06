# DEVELOPMENT

面向要改这个插件的人。用户向的安装与用法在 [README.md](README.md)。

这个插件是**树外插件**：Host 半边由 dsh 的 Loader 挂载，浏览器半边由 Web shell 经模块系统取走，两侧共用一份 `package.json` 的 `dsh` 段声明。

## 项目结构

```
src/index.ts               Host 半边：设置命名空间 + GET /nord/balance 路由
src/config.ts              两侧共用的配置类型、默认值、NS / BALANCE_PATH
src/schema.ts              Host 独有的 durable schema（唯一 import schemastery 的模块）
src/balance.ts             余额载荷类型 + 上游文档到载荷的投影
src/usage.ts               「用量信息」链接的判定
src/fonts.ts               字体预设目录 + 「存储选项 → CSS 家族列表」的解析与清洗
src/client/index.ts        浏览器半边：主题层、字体、三枚样式表、设置页、余额轮询、两个 slot 注册
src/client/settings.ts     设置传输的跨代适配（settingsScope / configForms 归一到一个接口）
src/client/nord.ts         Nord 调色板（120 token）、字体 :root 规则、余额表面与宽表格补丁
src/client/BalanceBar.tsx  余额读数与其明细面板
src/client/NordSection.tsx 设置面板里本插件自己的一页
src/client/stores.ts       设置页与余额的 slot store
src/client/locales.ts      dshNord 命名空间的中英文案
tests/*.test.mjs           三个纯模块的 node --test 规格；tests/balance-mock.mjs 是上游余额接口的替身
scripts/release-lab.mjs    隔离 $DSH_HOME，逐个验证四种安装方式
scripts/publish-npm.mjs    发布流水线：六道闸门 + tarball 核查 + 真发布
scripts/dsh-version-lab.mjs 并排装另一个 dsh 版本（装在仓库外）
scripts/shots/*.mjs        隔离实例 + headless Edge：两个上游接口探针、截图
assets/                    README 截图
```

`tsdown.config.ts` 出五个产物：`lib/index.js`（Host）、`lib/client.js`（浏览器）、以及 `lib/balance.js` / `lib/usage.js` / `lib/fonts.js` 三个纯模块——它们各自成文件，是为了 `npm test` 能在纯 Node 下直接跑，不必启动插件。

浏览器那一份必须精确匹配模块系统的线格式：注册 banner/footer 包住的 CJS 体，`module`/`exports` 由 intro 引入，且只把 shell 模块表里的 specifier 留作 external（原因见「为什么没有 `dependencies` / `peerDependencies`」）。

## 开发循环

```sh
npm install
npm run dev        # tsdown --watch
npm run typecheck
npm test           # pretest 先 build，再跑 tests/
npm run build
```

| 改了什么 | 怎么生效 |
|---|---|
| `src/client/**`、`src/fonts.ts` | 重建后自动热替换进已打开的页面（约 1–2 秒），不用刷新 |
| `src/index.ts`、`src/config.ts`、`src/balance.ts` | **必须重启 `dsh web`**：宿主侧的 hmr 在出厂 web profile 里是关的，且 Node 已缓存 `lib/index.js` |
| 兜底 | 刷新页面永远能拿到最新产物（bundle URL 带 `?rev=`，由产物字节与 mtime 算出） |

profile 里装的是 `link:`，直接指回本目录，所以构建产物一落盘就被读取，不需要重新 `dsh plugin add`。

## 设计要点

### 配色走 `overrideTokens`，而不是注册一个主题

官方的 `ThemeRuntime.register()` + `setTheme()` 对第三方主题是不完整的：`ui-theme` 的设置 schema 只接受 `light | dark | system`，第三方 theme id 存不进去，而 `adopt()` 会在设置变化时把内存偏好打回内置值。`overrideTokens(source, tokens)` 是官方为此留的入口——把一层 token 叠在当前主题之上，移除即还原，`composeActive` 按当前 `colorScheme` 自动挑 `light` / `dark`。

覆盖分三层共 120 项：**85 个 `--dsw-alias-*`**（官方语义层）、**10 个 `--dsw-specific-*`**（侧边栏 / composer / 选择器这些具名表面）、**25 个 `--dsw-static-*`**（补丁）。第三层是必需的：有一批组件（计划卡、交付物、指南正文、文件类型图标、加载渐变）绕过 alias 直接读静态色阶，官方浅色把这些取成近白，在 Nord 画布上就是一个白框——只覆盖 alias 治不了。

`--dsw-specific-menu`（通用浮层底色）**故意不覆盖**：它被 11 个官方包当通用底色用，改了会把所有官方菜单一起改掉。

### 字体是一枚 `:root` 规则，而且是一个选择器

`--dsw-font-markdown-*`、`--dsw-font-<size>-*` 这些复合族全部在 `:root` 上以 `var(--dsw-font-family)` 声明，而 CSS 自定义属性的 `var()` 在**声明处**求值——写在 `body` 上的覆盖传不到它们。所以字体由插件自己的一枚 `<style>` 承载，用 `:root` 赢得层叠，全部派生族自动跟随，不必枚举五十多个变量。

选择器而不是开关，是因为「不是所有人都装了 Maple Mono」：

- **表达**：一个字体名不够——选了 JetBrains Mono 之后中文没字形，必须靠后面的家族兜底，所以存的是整条栈。预设每一项都是家族列表，末尾再拼该角色自己的尾巴（界面接 `ui-sans-serif, …, sans-serif`；代码接 `ui-monospace, 'SF Mono', …, 'PingFang SC', 'Microsoft YaHei'`）。代码那条**不带裸 `monospace`**：Windows 的 CJK 会经它回退到 SimSun。
- **发现**：网页只能用本机装了的字体，这是浏览器边界。插件不探测（`document.fonts.check()` 是实现相关的启发式，`queryLocalFonts()` 只有 Chromium 有且要权限），而是让**下拉里每一行用它自己选的字体渲染**——那行本身就是样品，没装时看到的就是回退后的样子，预览不会撒谎。
- **不做**：不打包 webfont（拉丁子集几百 KB、中文子集若干 MB），只解决「默认」不解决「想换」。

### 自定义字体串要重建，不能转义

`uiFontCustom` / `codeFontCustom` 是用户输入，最终会进插件那枚 `<style>` 的 `:root{}`。`parseFamilies()` 因此按逗号拆开、剥一层引号、对每个名字跑白名单正则，过不了的**丢掉**（不转义、也不整体拒绝），再用单引号重新包一遍拼接。CSS 里有意义的那些字符（`;`、`{}`、引号、反斜杠、括号、`@`、`!`、`#`、`/`、`*`）全在 U+00C0 以下，所以一个能闭合规则的字符永远活不下来；CJK、重音拉丁、全角字符在其上，正常通过。两个细节：`sans-serif` 这类**通用族不能加引号**（`font-family: 'sans-serif'` 是一次查不到东西的族名查询），所以有一张关键字表让它原样输出；逐个名字判定，一个坏条目不会丢掉整条列表。

### 设置页占一整页 `settings.section`

设置域把两种座位分得很清楚：一行（`settings.general.item`）是「一个设置项」的加法座位，一页（`settings.section`）是功能插件自己的页面。本插件有七个控件、三组语义，塞进「通用」会把那一列拖得很长——所以整页，`id: dsh-nord`、`order: 40`（官方是 0/10/15/20，跟着社区插件用 40，落在最后）。

页面的其余部分（标题层级、分组、行距、字段宽度）是内联 style——树外构建没有 CSS Modules 管线；控件则用模块表基线里的官方 `Switch` / `Input` / `Menu`，皮肤与焦点环由设计系统持有，不必自己写，也不必担心打包出第二份 React 上下文。

两个坑：**`label` 必须是 thunk**（`() => t('nav')`），shell 的导航账本会重读它，所以切语言不需要重新注册；**导航图标由 shell 的 `navIcon(id)` 硬编码**，第三方 id 一律回落齿轮。

### schema 单独一个文件

浏览器半边只要 `NS`、`DEFAULTS`、`BALANCE_PATH` 和 `Config` 这个类型，而 durable schema 必须 import `schemastery`。两者原先同住 `src/config.ts`，于是整个 schema 库被内联进 `lib/client.js`（当时占该产物 44%）。schema 挪进只被 Host 引用的 `src/schema.ts` 后，浏览器产物从 70.66 kB 降到 40.71 kB。客户端本来也不需要它：wire section 由 Host 序列化出去的 schema 校验。

`Config` 与 `PlainConfig` 是同一张字段表构建的两份——差别只在有没有 `.volatile()` 标记，原因见「版本现实」。

### 为什么没有 `dependencies` / `peerDependencies`

Host 半边把 `dsh-brand`、`dsh-credentials`、`schemastery` 等全部内联，产物的运行时模块边只有 `export { Config, apply, name }`；浏览器半边只 require shell 模块表里的五个 specifier（`react`、`react/jsx-runtime`、`react-dom`、`dsh-client-store`、`dsh-client-ui-primitives`），全部由宿主提供。声明 peer 会让 pnpm 往用户 profile 里再装一份 `ui-theme` / `ui-slots`，反而与 shell 的模块表身份冲突。兼容性因此靠「版本现实」里记的实测版本，而不是依赖范围。

### 余额：一条路由、一次轮询、一个面板

Host 半边在 `webServer` 上注册 `GET /nord/balance`，用 `ctx.credentials` 解析 `DEEPSEEK_API_KEY`；路由只回余额字段，key 不出进程。上游文档到载荷的投影（`parseBalance()`）在 `src/balance.ts`，Host 路由与 `npm test` 共用同一份实现——所有失败都归一成 `{ error: <码> }` 载荷，文案归浏览器半边。

浏览器半边轮询这条路由并把结果写进 slot store，dock 里那枚读数就是它：成功时是 `<button>`，点开是明细面板；刷新中或失败时退回 `<span>`（与官方 pill 在无可展开内容时的做法一致），展开态复用同一个元素，行不会重排。**轮询不做清屏**：`loading` 只在「还没有成功读数」时进入，成功过一次之后原地更新，否则每 15–60 秒面板会跟着闪一次。三处守卫别删：结果只在被更晚的请求超越时丢弃（否则响应持续慢于间隔时会永久冻住且没有提示）；每次读取带 20 秒超时；页面重新可见时立刻补一次（隐藏标签页的 interval 会被节流甚至冻结）。

面板的皮肤抄自官方统计对话框（`ui-chat` 的 `stat-dialog.module.css`）：`--dsw-specific-menu` 表面、12px 圆角、`--dsw-elevation-prominent` 阴影、12/18 字号；定位与关闭直接用官方原语 `useAnchoredPosition` 与 `useDismissOnOutsidePointer`。抄皮肤是这套「树外插件」的固有代价：官方改版就得手工同步。

### 余额条为什么还需要一条 dock 规则

`conversation.composer.dock` 里已经有官方的「轮次/步骤」pill，而 0.1.5 把这个槽位的每个贡献直接挂进 composer 竖列，于是同槽位的条目各占一行（0.1.6 才给 dock 加了独立的横向行）。槽位出口本身是可寻址节点（`<div data-slot="…" style="display: contents">`），所以插件只加一条规则，在余额条在场时把出口变成横向行：

```css
div[data-slot="conversation.composer.dock"]:has(> [data-dsh-nord-bar]) {
  display: flex !important; /* 出口自带内联 display:contents，只有 !important 能改 */
  align-items: center; justify-content: center; gap: 12px; max-width: 100%;
}
```

`:has()` 让余额条不在场时（关掉余额、非 composer 视图）出口保持原样；不支持 `:has()` 的浏览器退回「各占一行」，也就是没装这个插件时的样子。条本身只跟官方 pill 对齐文字档：字号走 `--dsh-content-font-size-secondary` 这类变量而不是写死，才能跟随设置里的正文字号联动。

文字基线的对齐是**量出来**的，不是写死的：`BalanceBar` 取同级状态行的计算字号与行高套到自己身上，再用 `Range.getBoundingClientRect()` 量出两者首行顶边之差当场抵消（留半像素防抖，免得追着自己的输出跑）。上游那一行的指标在两代之间整体挪过（高度、`padding-top`、字号都变过），按版本号写死任何一边都会在另一边错位——量邻居是唯一跟得上改版的做法。用 `Range` 而不是盒子：对齐看的是文字，盒子的顶边差得再多也不算数。

### 宽表格为什么被钉在 `auto`

上游给 markdown 宽表格（渲染器的 `md-table-wide` 钩子）做了「静止藏条、悬停显条」，藏的时候用 `padding-bottom` 把条的高度先占住。这套交换会改盒子本身，于是触发它的指针可能被自己造成的状态甩出去：在底边那几像素里，`padding-bottom` 归零使盒子变矮，指针落到盒外，`:hover` 丢失，预留回来，两个状态来回切——就是鼠标停在表格底边时的抖动。

把预留**固定**成同样高度解决不了（占位的滚动条排在 padding 盒之外，会让悬停态比静止态更高，把下方内容推下去）。要钉的是**状态**：`overflow-x: auto` 且不留预留，盒子的边框盒在两种状态、两条滚动条路径上完全一致，指针永远不会落到盒外。补丁只有一条规则、用 `!important` 压掉上游的静止与悬停两条声明；它只碰 `overflow-x` 与 `padding-bottom`，不动 `ui-chat` 借同一个钩子做的加宽与对齐。代价是横向溢出的宽表格常驻一条普通滚动条。

### 用量信息这一行为什么要检测

面板底部的「用量信息」链接只对 DeepSeek 账号有意义，判定在 `src/usage.ts`，两个信号按顺序看：**会话的模型供应商**（session 作用域槽位会收到 `ui-session` 投递的 `modelSelection` 投影，`next.provider` 以 `deepseek` 开头即算——官方那条路由键正是 `deepseek-official`），以及**余额地址兜底**（会话还没选过模型时投影是空的，此时看这次读数用的端点域名）。两个都不成立时这一行根本不渲染。

类型上有一处妥协：`useProjection` 座位的类型入口会牵进 Host 部署包的依赖图，所以 `dsh-client-ui-session` 只作为 devDependency 引入（让座位在类型上存在，运行时不 require），读到的那层投影形状在 `BalanceBar.tsx` 里按需声明、读取处断言一次。

## 版本现实

本插件的**构建基线是 `0.2.0-rc.2`**，并**同时支持 `0.1.5-rc.3` 与 `0.1.7-rc.2`**；三代都由 `verify-compat` 与 `verify-settings` 实测过（`schemastery` 不用 dsh 的版本号，单独钉在 `3.18.4`，因为 `.volatile()` 是它才有的方法）。

| dsh | 设置命名空间 | 备注 |
|---|---|---|
| `0.1.5-rc.3` | Host `ctx.settings.installSection()` 写 `settings.yaml`；浏览器 `ctx.settingsScope.bind()` | 最老的一代，只作兼容目标 |
| `0.1.7-rc.2` | Loader 从条目导出的 `Config` 自动派生，写 profile 的 `cordis.patch.yml`；浏览器 `ctx.configForms.get()` | `installSection` 与 `settingsScope` 都被删 |
| `0.2.0-rc.2` | 同上 | `settingsScope` 连类型声明一起删净；配色表新增 8 枚 alias token |

**基线跟着最新一代走**，理由很实际：旧代随时可能把插件依赖的东西删掉。0.2.0 删 `settingsScope` 的声明时，钉在 `0.1.5-rc.3` 上的 `npm run typecheck` 对这件事完全看不见——而运行时早就走另一条分支了。基线升到 `0.2.0-rc.2` 时立刻报出四处错误，全在这一类东西上。

**同一时刻只有一代声明能被加载**（两侧的 `SlotMap` 模块增强会撞车），所以「导入哪一代、声明哪一代」是这份代码里唯一的版本策略：现在导入 0.2.0、结构化声明 0.1.5 的 `settingsScope` 与 `installSection`（见 `src/client/settings.ts`、`src/index.ts`）。运行时按**形状**分流，不按版本号判断。

升级 dsh 的流程：

```sh
# 1. 改 devDependencies 到新版本 → 安装 → 类型与测试（接口漂移会在这里暴露）
npm install && npm run typecheck && npm test
# 2. 在新版本上实测（shell 的漂移类型管不到，只有实跑能看见）
node scripts/shots/verify-compat.mjs
node scripts/shots/verify-settings.mjs
```

**三处类型与探针都看不见、升级时值得主动查的东西：**

- **新增的配色 token。** 上游只往 `ui-theme/src/styles/design-platform.css` 里加，而探针只抽样 9 项，抽不到新加的。做法是拿两个 tag 比这份文件（`git diff dsh-v<旧>..dsh-v<新> -- packages/client/ui-theme/src/styles/design-platform.css`）：新增的 alias 若没被这层覆盖，就会露出非 Nord 的颜色。0.2.0 加了 8 枚，其中 4 枚靠 `var()` 间接命中、4 枚需要补。
- **图标名。** ui-primitives 改过两轮名字（0.1.5 带尺寸后缀 `…14` → 0.1.7 去后缀 → 0.2.0 拆成 `…Regular` / `…Medium`），**没有任何一个名字三代通用**。`NordSection.tsx` 按「新→旧→本地兜底」解析，所以不会崩，但宿主重画时会静默退回兜底那份（退回时肉眼一样，是以后的隐患）。
- **那条宽表格补丁。** 它绑在上游「静止藏条、悬停显条」的做法上；上游若改了 `md-table-wide` 钩子或取消悬停切换，就要重新评估这条规则是删还是改写。

### 并排装另一个 dsh 版本

`latest` 标签与最新版常常不是一回事，所以「插件在新版上还行不行」要拿另一个版本来问，而不是升级全局那份：

```sh
node scripts/dsh-version-lab.mjs 0.1.7-rc.2                 # 装到 ~/.dsh-versions/<版本>
node scripts/dsh-version-lab.mjs --list                     # 已经装了哪些
node scripts/dsh-version-lab.mjs 0.1.7-rc.2 -- node scripts/shots/verify-compat.mjs
node scripts/dsh-version-lab.mjs 0.1.7-rc.2 -- node scripts/shots/verify-settings.mjs
```

**必须装在仓库外**：`pnpm add` 会顺着 `pnpm-workspace.yaml` 往上找到仓库根，把整棵新版本的依赖树链进本仓库的 `node_modules` 并重解析 lock（类型基线当场就变）。清场用 `npm ci`。两个 dsh 同时在跑靠 `DSH_HOME` 与端口分开；探针一侧只认 `DSH_BIN`（默认 PATH 上的 `dsh`），两个探针开场都会写明打的是哪一对版本。

## 本地验证

界面与余额这类「类型管不到」的东西，靠两个探针在隔离实例里实测（`DSH_HOME` 指向 `.shot-lab/home`，headless Edge，真实 home 全程不被触碰）：

| 探针 | 覆盖什么 |
|---|---|
| `verify-compat.mjs` | 插件站在哪些上游接口上：模块加载器、三枚样式表、字体 token、两套调色板各抽 9 项 token、dock 槽位与那条 `:has()` 规则、余额读数、明细面板、「用量信息」座位、Escape、零 console 报错。**升 dsh 之后先跑这个** |
| `verify-settings.mjs` | 设置页与字体选择器：左栏入口与顺序、「通用」里已经没有本插件的行、独立页面的几何、两侧字体菜单、自定义串的取消 / 恶意串 / 正常串、写库落到哪一份文档 |

两处经验：探针都**等结果**而不是等固定时长（乐观写与过 wire 的写落地时刻不同）；判「在不在会话页」看 `[data-slot="conversation.composer.dock"]` 是否存在，而不是看页面像不像会话——空会话的 hero 页不渲染这个槽位。

余额链路可以完全不碰真实账号地走通：

```sh
node tests/balance-mock.mjs                    # 127.0.0.1:3099，返回上游字段名
# profile 的 cordis.patch.yml 里把 baseURL 指过去，启动时注入 DEEPSEEK_API_KEY=test-key
```

历史实测里的像素坐标、产物字节数这类数字不再随文档保留（需要时 `git log -p DEVELOPMENT.md`）；留下来的只有会影响后续判断的那些，都写在对应小节里。

## 发布到 npm

一行 `npm publish` 在这个仓库不够用：本机 `~/.npmrc` 的 registry 指向**只读**的腾讯镜像，而发布前有几项事实必须核查。`scripts/publish-npm.mjs` 把它们串成一条带闸门的流水线，**默认只核查不发布**：

```sh
npm run release:check                        # 只核查：跑完六道闸门，打 tarball
npm run release                              # 真发布（= ... --publish）
npm run release -- --bump patch --smoke      # 升版发布 + 从 registry 冒烟装一遍
```

经 `npm run` 传参要放在 `--` 之后，否则 npm 会把参数当成自己的配置项。

| # | 闸门 | 不过时的含义 |
|---|---|---|
| 1 | 工作树干净、在 main/master 上 | 发出去的东西对不上任何提交 |
| 2 | `name` / `version` / `license` / `files` / `dsh` 段齐全，LICENSE 版权人不是占位符，`repository` 在 | 包页截图裂掉、dsh 认不出这是插件包 |
| 3 | `typecheck` + `test` + `build` 全过 | 按 `package.json` 里的 script 跑 |
| 4 | tarball 恰好是那 10 个文件 | 少了产物或混进 `src/` / `tests/` / `scripts/` |
| 5 | registry 上没有这个版本、维护者包含当前登录身份 | 同版本重发会被拒、发到别人的包上会 403 |
| 6 | `npm publish` | 默认跳过，`--publish` 才走 |

几个设计点：**只有 `--publish` 一道确认**（早期多余的 `--yes` 已去掉，但老命令仍被接受并提示）；**`--bump` 只改 `package.json`**，git commit 与 `v<版本>` tag 放在发布成功之后打（发布失败不该留一个悬空的版本提交）；**凭据只在真要发布那一步碰**（`NPM_TOKEN` 被写成仓库级 `.npmrc`，发布结束立刻删掉）。

本机前提（脚本会检查并在缺的时候给出确切命令）：`npm login` 与 `npm publish` 都必须显式带 `--registry https://registry.npmjs.org/`，否则 login 会去登录镜像、publish 会往镜像推；`~/.npmrc` 的 `proxy` / `https-proxy` / `strict-ssl=false` 脚本原样继承，不覆盖。

### 发布后核对为什么要先等 registry 传播

发布是**写**、核对与冒烟是**读**，读副本跟上写入有一段窗口。实测发 `0.3.1`：发布后几秒内 `npm view` 得 E404、`dist-tags` 仍是上一个版本、`dsh plugin add <包>@<版本>` 也必然 404；约 1 分钟后 npmjs 能查到，镜像再晚一两分钟。把窗口当成「包有问题」报出去会把排查引错方向。

所以两步都先有上限地轮询 packument 的 `versions`（每 5s，默认上限 180s，`--propagation-timeout <秒>` 可调、`0` = 只查一次），等到版本真的可查再核对或安装；超时只 warning 并给出手工命令，冒烟在超时时直接跳过。`--smoke` 刻意装**精确版本**而不是 `@latest`：冒烟紧跟发布，而 pnpm 的冷静期按「发布满 24 小时」生效，用 `@latest` 会解到上一个版本却照样报「通过」。

## 发布后的四种安装方式

用户能走的装法有四条，各自的坑不同。`scripts/release-lab.mjs` 把验证收敛成一条命令，每种方式配一个一次性 profile（`lab-link` / `lab-tarball` / `lab-npm` / `lab-git`），`DSH_HOME` 指到 `.release-lab/home`——**你的 `~/.dsh` 全程不被触碰，也没有指向真实 profile 的开关**。

```sh
node scripts/release-lab.mjs                      # 四种全跑（git 首次约 1–2 分钟）
node scripts/release-lab.mjs link tarball         # 只跑本地那两条，完全不碰网络
node scripts/release-lab.mjs npm --registry https://registry.npmjs.org/   # 默认 registry 是只读镜像，必须显式给
node scripts/release-lab.mjs --keep --no-boot     # 只查装卸，保留现场
```

`npm run lab` 是等价别名（参数照旧放在 `--` 之后）。

每种方式依次过四道：**install**（`dsh plugin add` 退出码——抓住 spec 解不开、registry 上没有、git 被 `allowBuilds` 拦下）、**layer**（`--dump-config` 里出现 `# == dsh-nord`——抓住装上了但没进 `dsh.profile.bundles`）、**resolve**（profile 的 `node_modules/dsh-nord` 里 `package.json` + `cordis.patch.yml` + 两个半边都在且非空）、**boot**（起一次 dsh，抓首页 `__DSH_BOOT__` 的 entries——抓住客户端半边没注册、`inject` 与声明不一致、产物取不到）。

第四道最有价值也最容易被手工省掉：`--dump-config` 只看得到 Host 半边，客户端半边是否进了 shell 的预载列表，只有抓首页才知道（首页要用启动时打印的 `?token=` 换一次 cookie 才能访问）。git 那条的 `allowBuilds` 是唯一需要人工介入的地方，脚本替你做掉：从 pnpm 的报错里抠出它要求粘贴的那一行，插进该 profile 的 `pnpm-workspace.yaml` 再重试一次。

### 刚发完版，`@latest` 装的不是刚发的版本

pnpm 11 起默认开启新版本冷静期（`minimumReleaseAge`，默认 24 小时）：发布不满一天的版本**不进标签解析的候选**，于是 `add dsh-nord@latest` 会静默装回上一个版本。三点要记住：

- 冷静期**只影响标签解析**。显式范围（`@^0.3.0`）与精确版本（`@0.3.1`）不受影响，能直接装到刚发布的版本。
- 覆盖它的键名是**连字符**的 `--config.minimum-release-age=<秒>`；camelCase 的 `--config.minimumReleaseAge` 会被**静默忽略**，`npm_config_minimum-release-age` 这类环境变量同样不生效。
- 脚本因此提供 `--min-release-age <秒>`（`0` = 关掉），并在 npm 方式的输出里算出「冷静期过滤后实际会解析到哪个版本」。

局限说清楚：**这里验证的是「装得上、装得对、加载得起来」，不是功能**（界面与余额的实测是上面那套探针）；**npm 方式装的是 registry 上的版本，不是当前工作树**，脚本会黄字提示两者不一致；**git 方式不锁定 commit**，要复现某个提交自己给 `--git github:<owner>/<repo>#<sha>`；每种方式各占一份 `node_modules`，`.release-lab` 会到几百 MB 量级，不加 `--keep` 时跑完自动删。

## 截图怎么来的

`assets/` 里三张 README 截图是脚本拍的，不是手点的：

```sh
node scripts/shots/capture.mjs      # 覆盖 assets/01-theme.png、02-settings.png、03-balance.png
```

它复用 `release-lab` 那一招（`DSH_HOME` 指向 `.shot-lab/home`，主 home 不被碰），然后：铺隔离 home（暗色、中文、预置 `welcomeNoticeVersion` 免掉「内测声明」弹窗）→ 把一个**真实会话**整份拷进去（含投影缓存，否则侧栏列不出来）并在侧栏点开它 → 余额走本地 mock（数值与 `tests/balance-mock.mjs` 一致）→ 按 `deviceScaleFactor: 2` 渲染再用 sharp 降到目标像素。

三个坑，改脚本前先看：

- **余额条挂在 `conversation.composer.dock`，而空会话的 hero 页不渲染这个槽位。** 截图必须落在一个真正打开的会话里，这是脚本要先「点开会话」的原因；判断依据是那个 `data-slot` 节点在不在。
- **`02` 拍的是本插件自己那一页，得先点开左栏那一行。** 设置面板默认停在「通用设置」，而插件的设置已经不在那儿了。
- **载体会话的正文每次取当下最新内容**，所以重拍时图里的对话文字会变、几何不会。

`npm pack` / `npm publish` 之外不要手工动 `assets/`，脚本是唯一来源；`sharp` 与 `playwright-core` 是这套流程的开发依赖，用本机 Edge，不下载 Chromium。

## 已知限制

- **没有样式管线。** 树外构建拿不到仓库内的 CSS Modules 步骤：设置页用内联 style + 官方控件（它们的皮肤由 ui-primitives 自己的 CSS Modules 带进来），余额条与面板由插件自己的一枚 `<style>` 承载（内联 style 表达不了 `:hover` 与 `[aria-expanded]`）。代价是这几条声明是从官方 pill 与官方对话框的 CSS 手工抄的，官方改版就得手工同步。
- **设置页的分区图标是齿轮。** 左栏图标由 shell 的 `navIcon(id)` 硬编码，`settings.section` 没有传图标的座位。
- **`faint`（`#7B88A1`）是超出 Nord 十六色的一个中性台阶。** 官方色阶从 nord3 `#4C566A` 直接跳到 nord4 `#D8DEE9`，中间没有可用于深色背景上 caption/dimmed 文字的台阶。
- **`baseURL` 只在设置里改**，不去读 `llm-deepseek` 段的配置——那需要窥探另一个命名空间。
- **余额接口的可用性取决于上游。** `/user/balance` 不是文档化的稳定契约；字段名变化时 `src/balance.ts` 需要同步。
- **几个字段在失焦时才落盘**（刷新间隔、API 地址、自定义字体串）。输入过程中不写库，敲完直接按 Escape 关掉设置面板会丢掉这次编辑；字段是非受控写法（`defaultValue` + `key`），代价是写入成功后重挂载那一刻焦点重置。
- **字体预设不做可用性探测。** 没装的那一档静默落到栈里的下一个家族，界面不会提示「未安装」。
- **从菜单选「自定义」后在空字段上离开算取消**（不改字体、字段收起）；只有在一个已经是 `custom` 的字段上清空才算提交——那会解析成尾档的回退栈。
