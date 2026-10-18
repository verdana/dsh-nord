# dsh-nord × dsh 0.2.1-rc.2 兼容性清查

- 审计对象：`dsh-nord` 0.3.1（本仓库），构建基线 dsh `0.2.0-rc.2`
- 目标版本：dsh `0.2.1-rc.2`（工作树 `D:\deepseek-harness`，HEAD `d1b9c04067`；npm dist-tag `next`）
- 审计日期：2026-10-18
- 四路独立审计：客户端 API 面 / Host+打包契约 / 真实依赖实跑 / DOM·CSS·token 运行时契约；另由 Lead 做真实浏览器级联实测与交叉复核
- 结论速览：**源码兼容，一处运行时破坏（字体层），一处安全边界变化**

---

## 0. 一句话结论

类型、构建、宿主 API、插件清单、槽位契约、主题 token 在 0.2.1 上**全部兼容**，`typecheck / build / test` 全绿、构建产物与现有 `lib` **逐字节相同**；但上游在 `body` 上新增了字体变量声明，**静默覆盖**插件写在 `:root` 的字体层，导致字体预设功能整体失效 —— 而插件自带的兼容探针恰好测不到这一点，会给出假绿灯。

---

## 1. 结论总表

| 审计面 | 结论 | 关键依据 |
|---|---|---|
| 客户端包类型/导出 | ✅ 兼容 | 插件引用的 15 个符号、2 个槽位契约、`configForms` 服务全部保留；4 项删除均未被插件引用 |
| typecheck / build / test | ✅ 全绿 | 0.2.1-rc.2 依赖下 `tsc` 0 诊断、`tsdown` 成功、31/31 单测通过；产物 SHA256 与现有 `lib` 一致 |
| Host API（settings / webserver / credentials） | ✅ 兼容 | `configure({auto},fiber)`、`register({kind:'exact',path,handler})`、`credentialRef/resolve` 逐字未变；`dsh-settings` 甚至零 diff |
| cordis 4.0.4→4.0.5 / schemastery 3.18.4→3.18.5 | ✅ 无变化 | vendor 两版仅 package.json 版本行不同，构建产物 SHA256 相同 |
| 插件清单 / 打包 / 浏览器产物形状 | ✅ 兼容 | `dsh.bundle.patch`、`dsh.client{platform,inject}`、`__ModuleLoader__.load` banner/footer 均未变；平台种子模块表只增（`zod`、`@tanstack/react-virtual`）不减 |
| 主题 token（`--dsw-alias/static/specific-*`） | ✅ 仍成立 | `design-platform.css` 零 diff；插件覆盖的 120 个 token 名全部仍被定义且仍被消费 |
| 槽位 / DOM 钩子 | ✅ 仍成立 | `settings.section`、`conversation.composer.dock` 契约不变；`div[data-slot]` 锚点仍输出（两槽位未声明 `inline`）；`.dock` CSS 零 diff；`.md-table-wide` 仍在 |
| 客户端服务名 | ✅ 未变 | `theme` / `slots` / `locale` / `configForms` 全在；`settingsScope` 仍不存在（插件的双注入适配继续正确分流） |
| **字体层运行时** | ❌ **破坏（静默）** | 0.2.1 `base.css:29-31` 在 `body` 重新声明 `--dsw-font-family` / `--ds-font-family-code`，压过插件 `:root` 覆盖 |
| 余额路由安全边界 | ⚠️ 变化 | 0.2.1 允许 `dsh web` 绑定非 loopback 具体地址，插件 `/nord/balance` 为裸注册（无鉴权） |

---

## 2. 唯一破坏项：字体层被上游 body 级变量静默覆盖

### 2.1 机理

0.2.0 的 `ui-theme` 只在 `:root` 定义两个字体 token：

```css
/* 0.2.0 packages/client/ui-theme/src/styles/base.css:7,10（构建产物 lib/client.js 同） */
:root { --dsw-font-family: <内置 UI 栈>; --ds-font-family-code: <内置代码栈>; }
```

插件追加的 `:root` 规则与上游同特异性、后插入 → 生效（旧版成立）：

```ts
// dsh-nord src/client/nord.ts:265
return `:root{--dsw-font-family:${stacks.ui};--ds-font-family-code:${stacks.code};}`
```

0.2.1 把内置栈改名成 `*-default`，并在 **`body`** 上重新声明最终 token：

```css
/* 0.2.1 base.css:7-13, 29-31（构建产物 ui-theme/lib/client.js 中的 body 规则段同） */
:root { --dsh-font-family-text-default: <内置 UI 栈>; --dsw-font-family: var(--dsh-font-family-text-default); ... }
body {
  --dsw-font-family: var(--dsh-font-family-text, var(--dsh-font-family-text-default)), var(--dsh-font-family-text-default);
  --ds-font-family-code: var(--dsh-font-family-code, var(--dsh-font-family-code-default)), var(--dsh-font-family-code-default);
}
```

CSS 自定义属性按元素级联：`body` 及全部后代取 **body 自身**的声明，而不是从 `html` 继承插件值。于是界面文本、代码块、markdown 复合字族（`--dsw-font-markdown-*` 在 `body` 内替换 `var(--dsw-font-family)`）全部退回上游默认栈。开关、设置页、样式表注入本身都正常 —— 只是**视觉上完全不生效**，且没有任何报错。

附带变化：`--dsw-font-family-brand` 从 `'Montserrat', var(--dsw-font-family)` 改为 `'Montserrat', var(--dsh-font-family-text-default)`（旧 `base.css:9` → 新 `:10`），品牌字不再跟随插件字体。

### 2.2 真实浏览器实测（Edge/Chromium，非纯静态推断）

以构建产物中的**逐字 CSS**复现三种场景（`%TEMP%\dsh-font-probe\probe.mjs`）：

| 场景 | `body` 的 `--dsw-font-family` | 界面文本实际字体 | 插件字体生效 |
|---|---|---|---|
| A 0.2.0：上游 `:root` + 插件 `:root` | `'Maple Mono', …` | Maple Mono | ✅ |
| B 0.2.1：上游 `:root` + 上游 `body` + 插件 `:root` | `-apple-system, …`（上游默认） | 系统默认栈 | ❌ |
| C 0.2.1 + 修法（同值改挂 `html body`） | `'Maple Mono', …` | Maple Mono | ✅ |

同时验证：代码块（`--ds-font-family-code`）与 `--dsw-font-family-brand` 在 B 场景同样退回上游值。

### 2.3 为什么现有探针测不出（重要）

```js
// dsh-nord scripts/shots/verify-compat.mjs:122
getComputedStyle(document.documentElement).getPropertyValue('--dsw-font-family')
```

读的是 `documentElement`（`html`）：那里插件 `:root` 规则仍然胜出，**永远返回插件值**。`verify-settings.mjs:38` 同样只读 `documentElement`。所以 0.2.1 上跑 `verify-compat` 会「字体 token」全绿而实际字体已失效 —— 升级后最危险的一类假绿灯。

### 2.4 建议修法（二选一，均可跨 0.2.0/0.2.1）

**方案 A（推荐，机制最稳）：改走 `ctx.theme.overrideTokens()`**

`ThemePresenter` 会把 override 合成后的 token 以 **body 内联样式**写入（0.2.0 与 0.2.1 相同：`packages/client/ui-layout/src/client/theme-presenter.ts:87-90`；旧版同函数），内联样式优先级高于任何 body 规则；dispose 时自动移除。`validateOverrides` 只校验 `{light, dark}` 形状、不限制 token 名（`ui-theme/src/client/index.ts:466-489`），字体 token 在两个模式下同值即可：

```ts
// src/client/index.ts：字体 effect 内，与颜色层并列、独立 source
ctx.effect(() => {
  let applied: (() => void) | undefined
  const sync = (): void => {
    applied?.(); applied = undefined
    const value = effective()
    if (!value.fontEnabled) return
    const { ui, code } = fontStacks(value)
    applied = ctx.theme.overrideTokens('dsh-nord-fonts', {
      '--dsw-font-family': { light: ui, dark: ui },
      '--ds-font-family-code': { light: code, dark: code },
    })
  }
  const unsubscribe = settings.subscribe(sync)
  sync()
  return () => { unsubscribe(); applied?.() }
}, 'dsh-nord: font stacks')
```

同时删掉 `fontStylesheet()` / `FONT_STYLE_ID` 那条 `<style>`（保留也可，但会与 override 层重复，建议收敛成一条路径，避免两处状态漂移）。

**方案 B（最小改动）：把选择器从 `:root` 改成 `html body`**

```ts
// src/client/nord.ts:265
return `html body{--dsw-font-family:${stacks.ui};--ds-font-family-code:${stacks.code};}`
```

`html body`（特异性 0,0,0,2）胜过上游 `body`（0,0,0,1），与插入顺序无关；实测场景 C 通过。代价：仍是另一条样式表路径，清理逻辑不变。

**两点设计注意**

1. 不要写 `--dsh-font-family-text/-code`：那是上游用户字体设置的内联位（boot 脚本/`ThemePresenter` 写 body 内联），会互相覆盖。
2. 0.2.1 的 Settings→General 已自带 FontFamily / FontSize 设置行（`ui-theme` 新注册 `FontSettingsGroup`）。插件字体页与上游功能重叠：短期按上面修好即可；长期建议二选一 —— 要么让插件字体写入 `--dsh-font-family-*` 语义（跟随上游设置优先级），要么把插件字体页降级为「预设组合」并在文档说明上游设置优先。

### 2.5 修完后探针要一起改

- `verify-compat.mjs:122`：改读 `document.body`，并追加一个真实元素断言，例如 `getComputedStyle(document.querySelector('#dsh-nord-...'), 'font-family')` 含 `Maple`；同时加一条 `--ds-font-family-code` 的 body 级断言。
- `verify-settings.mjs:38`：涉及字体/配色的断言同样下沉到 `body`。
- 建议加一条反向断言：当字体层关闭时 body 值应等于上游默认栈（现在只能验证「非空」）。

---

## 3. 需知悉的行为变化（不阻断，建议随下个版本处理）

| # | 变化 | 对 dsh-nord 的影响 | 建议 |
|---|---|---|---|
| 1 | `--dsw-font-family-brand` 不再引用 `--dsw-font-family` | 品牌字（Montserrat 之后的 fallback）不再跟随插件字体 | 可接受；如需一致，在字体层里一并覆盖 brand token |
| 2 | 上游新增 text/code/terminal 三档字号与三档字体设置（`--dsh-content/code/terminal-font-size`、`--dsh-font-family-{text,code,terminal}`） | 插件不覆盖字号，余额条依赖的 `--dsh-content-font-size-secondary/-delta-secondary` 仍定义且值未变 → 无冲突；但用户在上游改字号会同时改 code/terminal，插件界面需实测 | 功能重叠见 2.4 |
| 3 | `ui-session` 客户端 `inject` 新增硬依赖 `remoteAccess`（`ui-session/src/client/index.ts:671`） | 官方 web-app 组装已含；非标准组装缺该服务时 `ui-session` 卡 pending → session 作用域槽（含 `conversation.composer.dock`）不渲染，余额条消失 | 在自己组装的 profile 里确认 `remoteAccess` 客户端半存在；插件侧已有 `NO_PROJECTION` 兜底不会崩 |
| 4 | `ui-chat` 把 dock 单个 `stats` 入口拆成 `activity`(order 0) + `usage`(order 1) | 插件 bar（order 10）仍在最后，但 dock 行内条目 2→3；BalanceBar 取「第一个兄弟」做字号对齐（`BalanceBar.tsx:160-198`），像素结果需实跑 | 修完字体后截图复核对齐 |
| 5 | 凭据优先级：存储值优先于环境变量（`stored-credentials-precedence`） | 插件用 `DEEPSEEK_API_KEY` 读余额；同时存在存储 key 与 env 时，余额账户可能换人 | README 说明；无需改码 |
| 6 | Web 监听可绑定非 loopback 具体地址（`web-listener-trust-config`） | `/nord/balance` 是裸注册路由（`src/index.ts:129-135`），只有 `/api`、`/connect` 走会话鉴权；0.2.1 下 `dsh web --host <LAN 地址>` 会让余额查询在局域网可达 | 二选一：注入 `connection` 后用 `admit(req)` 守卫；或在 README 明确仅 loopback 使用 |
| 7 | `client-modules` 新增 release 闸门：页面只接受与 boot release 相同的图 | 同版本热装不受影响；升级 dsh 后旧页面暂停接收图/热更，需刷新 | 运维说明即可 |
| 8 | HMR 下 `plugin add` 已安装包直接报 `already-installed`（`plugin-install-over-installed`） | `release-lab.mjs` 先 `plugin remove` 再 add，流程不受影响；`lab.mjs` 的 `--from-default-profile` 现在整目录替换，重复初始化反而变成可用 | 现有脚本无需改；建议实跑一次确认 |
| 9 | 0.2.1 web 启动 URL 行去掉 `(LAN: …)` 后缀、打印时机改为 Loader 收敛后 | 插件 lab 的 `http:\/\/\S+` 正则与 40s 轮询仍匹配 | 无需改 |

---

## 4. 必须跟进的工程动作（非源码 bug）

1. **升依赖基线**：`package.json:61-84` 把 13 个 `@deepseek-ai/dsh-*` 从 `0.2.0-rc.2` → `0.2.1-rc.2`，`@deepseek-ai/cordis` `4.0.4` → `4.0.5`，`@deepseek-ai/schemastery` `3.18.4` → `3.18.5`（三个版本均已发布），重生成 `package-lock.json`。理由与仓库自己的约定一致（`DEVELOPMENT.md:132-142`：基线跟最新一代走，否则类型面看不见上游删除）。
2. **修字体层**（第 2.4 节）并**同步修探针**（第 2.5 节）。这是本次唯一会改变用户可见行为的改动。
3. **更新 `DEVELOPMENT.md` 兼容矩阵**：新增 `0.2.1-rc.2` 一行，记录「字体 token 注入面从 `:root` 变为 body 级（上游 base.css 新增 body 声明）」；`verify-compat` 的字体抽样说明改为读 body。
4. **不建议加 `engines.dsh`**：0.2.1 起 `engines.dsh` 一旦存在就独占判定并忽略 `peerDependencies`（`plugin-engines-dsh`）；本插件同时支持 0.1.5/0.1.7/0.2.0/0.2.1 四代，声明一个窄范围反而会把老版本拒之门外。保持「既无 engines 也无 peer」= 不做版本闸门（`app-boot/src/plugin-compatibility.ts:51-74`）。
5. **修补说明**：`dsh.client.inject` 与 `cordis.patch.yml` 均无需改动；Host 半（settings/webserver/credentials/schemastery）零改动。

---

## 5. 验证记录

| 路 | 方法 | 结果 |
|---|---|---|
| C（实跑） | 仓库外副本 `D:\dsh-nord-compat-check` 装 0.2.1-rc.2 全套依赖 | `npm install` 0 冲突；`tsc` 0 诊断（`--traceResolution` 确认用的是 0.2.1 `.d.ts`）；`tsdown` 成功；`node --test` 31/31；`lib/*` 与现有产物 SHA256 全同；隔离 HOME 下 `dsh plugin add` 冒烟 exit 0、无兼容性警告。详见 `D:\dsh-nord-compat-check\_lane-c-report.md` |
| A（API 面） | 新旧 `.d.ts` + 构建产物逐符号对比 | 插件直接引用的 15 个符号/2 个槽位/`configForms` 全保留；4 项删除（`./invariant` 子路径、`RenderMessageImages`、`projectUserText/UserTextReferences`、`createFontSizeRowStore`）均未被引用；唯一运行时破坏即字体层 |
| B（Host+打包） | 包源码/产物 + 34 条 0.2.1 upgrade guide + 打包校验脚本 | Host 三包无 API 变化（`dsh-settings` 零 diff）；清单/装载条件/banner 逐字未变；34 条 guide 中 7 条适用但现状已满足、26 条不适用；新增安全项 V4 |
| D（DOM/CSS） | token 集合、槽位锚点、服务名、dialog、`.md-table-wide` | 主题 token 定义 405=405、消费 221/220，无改名/废弃；槽位与 DOM 钩子全部仍成立；字体层结论与 A 独立一致 |
| Lead | 真实浏览器级联实测 + 构建产物内联 CSS 核对 | 场景 A 生效 / B 失效 / C 修复生效（第 2.2 节） |

---

## 6. 建议的运行时补测（修完之后）

1. 0.2.1 上跑修好的 `verify-compat` + `verify-settings`（`node scripts/dsh-version-lab.mjs 0.2.1-rc.2 -- node scripts/shots/verify-compat.mjs`）。
2. 余额条与 dock 内两个上游 pill 的首行对齐（dock 条目 2→3）。
3. 余额面板 `z-index:1100` 与 0.2.1 新模态层（设置 / onboarding / host-release overlay）的叠放次序。
4. 非 loopback 绑定下余额路由的可达性（安全加固验证）。
5. Desktop 字号快捷键（`desktop-font-size-shortcuts`）与插件字体/字号设置的交互（Web 端行为未变，Desktop 需实测）。

---

## 附录 A：关键证据坐标

| 主题 | 旧（0.2.0-rc.2） | 新（0.2.1-rc.2） |
|---|---|---|
| 字体 token 定义 | `ui-theme/src/styles/base.css:7,10`；安装包 `ui-theme/lib/client.js` 同 | `ui-theme/src/styles/base.css:7-13`；构建产物 `ui-theme/lib/client.js`（`body{...}` 段） |
| 字体 token body 声明 | 无 | `ui-theme/src/styles/base.css:29-31` |
| override 注入方式 | `ui-layout/src/client/theme-presenter.ts` apply() 写 body 内联 | 同（`:85-90`） |
| 字体层实现 | `dsh-nord/src/client/nord.ts:264-266`，挂载 `src/client/index.ts:71-82` | 同 |
| 假绿灯探针 | `scripts/shots/verify-compat.mjs:122`、`verify-settings.mjs:38` | 同 |
| 主题 token 全集 | `ui-theme/src/styles/design-platform.css` | 零 diff |
| dock 槽位 | `ui-conversation/src/client/contract/slots.ts`（list/session） | 同（`:274`），`apply.ts:460` |
| settings.section 槽位 | `ui-settings/src/client/contract/slots.ts` | 零 diff |
| 槽位锚点 | `ui-renderer/src/client/scoped-slots.tsx`（`div[data-slot]`） | 同（`:1096`）；新增 `inline` 选项但这两个槽位未使用 |
| dock 出厂条目 | `ui-chat/src/client/apply.ts`：`stats`(order 0) | `activity`(0) + `usage`(1)（`:323-329`） |
| 余额路由注册 | `dsh-nord/src/index.ts:129-135` | 同（需安全加固） |
| 依赖基线 | `dsh-nord/package.json:61-84` | 需升到 0.2.1-rc.2 / cordis 4.0.5 / schemastery 3.18.5 |

## 附录 B：建议 patch 清单

1. `src/client/nord.ts`：`fontStylesheet()` 选择器 `:root` → `html body`（或整体改走 `overrideTokens`，见 2.4 方案 A）。
2. `src/client/index.ts`：字体 effect 与颜色 effect 收敛到同一 override 机制（若选方案 A），独立 source `'dsh-nord-fonts'`，受 `fontEnabled` 控制。
3. `scripts/shots/verify-compat.mjs`、`scripts/shots/verify-settings.mjs`：字体/配色断言从 `documentElement` 下沉到 `document.body`，并加真实元素 `font-family` 断言。
4. `package.json`：devDependencies 升版（含 cordis/schemastery），重生成 lockfile。
5. `DEVELOPMENT.md`：兼容矩阵加 0.2.1-rc.2 行 + 字体注入面说明。
6. `README*.md`：补两条说明 —— 凭据存储优先的行为变化；`web --host` 非 loopback 绑定下余额路由的暴露面（或改为鉴权守卫）。

---

## 7. 追加：已实施「0.2.1+ 让出字体」（2026-10-18）

按第 2 节结论落地的方案：**检测到 Host ≥ 0.2.1 就不再提供任何字体设置，改用 dsh 自己的字体**；更早的版本（0.1.5 / 0.1.7 / 0.2.0）行为不变。

### 7.1 实现

| 位置 | 改动 |
|---|---|
| `src/fonts.ts` | 新增 `hostOwnsFonts(version)`（release 元组 ≥ 0.2.1，预发布后缀忽略）、`releaseTuple()`、`bootReleaseVersion()`（读 `window.__DSH_BOOT__.release.version`） |
| `src/client/host-fonts.ts` | `detectHostFonts(ctx)`：有 boot release 按版本判定；没有（0.2.1 之前的 shell）用主题快照是否带 `fontFamilies` 作能力兜底 |
| `src/client/index.ts` | `hostFonts` 时整段跳过字体 `<style>`（不写 `--dsw-font-family` / `--ds-font-family-code`），配色层不变 |
| `src/client/stores.ts` | 设置卡片状态新增 `hostFonts`，由 `createNordSettingsStore(hostFonts)` 注入 |
| `src/client/NordSection.tsx` | 字体组在 `hostFonts` 下只留一行说明，不再渲染开关与两个选择器 |
| `src/client/locales.ts` | 新增 `page.fontHostManaged`（zh/en） |
| `src/config.ts` | 注明四个字体字段在 0.2.1+ 失效，仅为旧文档/降级保留；Host schema 未删字段 |
| `package.json` / lock | devDependencies → `0.2.1-rc.2`、cordis `4.0.5`、schemastery `3.18.5` |
| `scripts/shots/*` | 两个探针按宿主 release 分支；设置入口适配 0.2.1 的账号菜单；会话夹具按投影 `formatVersion` 选 v3/v4 文件，并给侧栏缺失夹具明确报错 |
| `tests/fonts.test.mjs` | +3 用例：版本元组解析、0.2.1 边界（含预发布/未知）、boot release 读取 |

### 7.2 实机验证（npm 并排装 dsh 0.2.1-rc.2 + 隔离 HOME + headless Edge）

- 页面启动图：`release.version = 0.2.1-rc.2`，模块加载器在，插件已激活（余额表面样式表 2415B、宽表格补丁 69B）。
- `#dsh-nord-fonts` **不存在**；`body --dsw-font-family` = `-apple-system, …`（不是 Maple）；`body font-family` 同为宿主默认栈。
- 设置页：字体选择器 **0 个**，字体组显示「字体与字号由 dsh 自己的设置管理（设置 → 通用 → 字体），本插件不再覆盖。」，页面无 console 报错。
- `scripts/shots/verify-settings.mjs`（0.2.1）：**全部通过**（左栏入口、通用已清空、页面几何、字体委托断言、零报错）。
- `scripts/shots/verify-compat.mjs`（0.2.1）：模块加载器、两枚样式表、字体委托、明暗两套 token 抽样（各 9 项）**全部通过**；会话段的夹具（v4 workspace 存储）还没铺对，探针现在会明确报「会话夹具没有出现在侧栏」并打印侧栏原文 —— 属夹具待补，与插件行为无关。
- 回归：0.1.x / 0.2.0 路径未改（单位测试 + 类型检查覆盖）；0.2.1 基线 `npm run typecheck` 0 错、`npm test` 34/34；旧 0.2.0 基线下同样通过。

### 7.3 后续：移除 0.1.5 支持（2026-10-18 同日）

0.1.5（及更早）已不再支持，其兼容代码全部删除；支持范围收窄为 **0.1.7 / 0.2.0 / 0.2.1**。

删除的代码：
- Host（`src/index.ts` / `src/schema.ts`）：`installSection` 分支、`LegacyInstallSection` 结构化声明、`PlainConfig` schema；`settings.configure({ auto: false }, ctx.fiber)` 改为无条件调用。
- 浏览器（`src/client/settings.ts`）：`settingsScope` 传输与 `LegacySettingsScope` / `SettingsScopeBinder` / `adaptScope` / `asScopeBinder` 全部删除，`mountSettings` 只剩 `configForms` 一条路径。
- 图标（`src/client/NordSection.tsx`）：`IconChevronDownOutline14` 回退删除，保留 0.1.7 的 `…Outline` 与 0.2.x 的 `…Regular`。
- 注释与文档：Balances/dock/schema 注释里的 0.1.5 历史说明、README / DEVELOPMENT 支持范围、`verify-settings` 的写库核对（只读 profile patch）同步更新。

回归验证（隔离 home + headless Edge，实机并排装）：

| 版本 | `verify-settings` | 说明 |
|---|---|---|
| `0.1.7-rc.2` | 全部通过 | 插件字体路径生效、菜单/自定义串/落盘全部命中 |
| `0.2.0-rc.2` | 全部通过 | 同上 |
| `0.2.1-rc.2` | 全部通过 | 字体委托分支（插件不注入字体层） |

`npm run typecheck` 0 错、`npm test` 34/34（0.2.1 基线）。

### 7.4 支持下限改为机器可执行（2026-10-18 同日）

用户明确「≤ 0.1.5 都不再支持，不必兼容远古版本」。除文档措辞外，`package.json` 增加：

```json
"engines": { "dsh": ">=0.1.7-0" }
```

- dsh 0.2.1+ 的 `evaluatePluginCompatibility()` 据此拒绝 0.1.5 及更早。用仓库实现实测：
  `0.1.5-rc.3 → INCOMPATIBLE`；`0.1.7-rc.2` / `0.2.0-rc.2` / `0.2.1-rc.2` → compatible。
- 区间下限必须写 `-0`：semver 下 `0.1.7-rc.2 < 0.1.7`，`>=0.1.7` 会把支持的最老预发布也拒掉。
- 0.1.7 / 0.2.0 的装载器不读 `engines.dsh`，行为不变（实机 add 冒烟验证）。
- 这推翻了第 4 节「不建议加 `engines.dsh`」的建议：那条针对的是「继续支持四代」；现在范围收窄为三代，加上下限才与文档一致，并让更老的宿主在安装/启动时直接得到明确拒绝与豁免指引。
