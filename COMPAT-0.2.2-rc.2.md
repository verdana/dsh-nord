# dsh-nord × dsh 0.2.2-rc.2 兼容性核查

- 审计对象：`dsh-nord` 0.4.3（本仓库工作树），原基线 dsh `0.2.2-rc.1`
- 目标版本：dsh `0.2.2-rc.2`（本机安装 `C:\Users\Verdana\scoop\persist\nodejs\bin\node_modules\@deepseek-ai\dsh`，`package.json` 版本行已是 `0.2.2-rc.2`）
- 审计日期：2026-11-12
- 结论：**一处实质变化，且已经在用户面前露出了 BUG——余额条整条不见。**

| # | 变化 | 对插件的影响 | 处理 |
|---|---|---|---|
| 1 | `@deepseek-ai/dsh-client-ui-primitives` **删掉 `useAnchoredPosition`**，新增 `useAnchoredMaxHeight`；浮层定位改由 CSS Anchor Positioning 在 `Menu` 内部完成 | **实质**：余额条无条件调用该 hook，拿到 `undefined` 后渲染期抛错，被槽位错误边界隔离成空 div——条不见了，主题与设置卡却毫发无损 | `useAnchoredPosition` / `useDismissOnOutsidePointer` 内联进 `src/client/anchored.ts`，余额条不再向 primitives 取 hook |
| 2 | devDependencies 的 peer 收紧：`dsh-settings@0.2.2-rc.2` 新增 peer `dsh-brand@0.2.2-rc.2`、`dsh-session@0.2.2-rc.2` | 安装期 `ERESOLVE` | 两枚 peer 写进 devDependencies；构建基线整体升到 `0.2.2-rc.2` |
| 3 | 前端 shell 的模块表多一项 `@deepseek-ai/dsh-client-ui-dockkit` | 无。插件不 require 它 | 无代码改动 |
| 4 | 渲染契约（`slots.register` / `inject(sessionId, actions)` / `useStore` 座位 / dock 槽位声明与出口） | **零变化**——逐条对过 rc.2 的 `dsh-client-ui-renderer` 源码与 `dsh-client-ui-conversation` 源码 | 无代码改动 |

字体、主题 token、设置卡、Host 侧余额路由**零契约变化**；`lib/` 的 Node 半边一字未改。

---

## 1. 差异范围

rc.1 → rc.2 是补丁周期，安装树里 `docs/upgrade-guide` 没有 `v0.2.2-rc.2` 目录，README 的最新小节也停在 rc.1：**没有升级指南可供照抄，只能按包比对**。逐包看插件真正站的四个面：

| 面 | 观察 | 结论 |
|---|---|---|
| `dsh-client-ui-primitives`（`Switch` / `Input` / `Menu` / 图标 / 浮层 hook） | 导出表 344 个键：`useAnchoredMaxHeight` 在、`useDismissOnOutsidePointer` 在、**`useAnchoredPosition` 不在** | **破窗（见 §2.1）** |
| `dsh-client-ui-conversation`（dock 槽位） | `apply.ts:477` 仍是 `'conversation.composer.dock': { kind: 'list', scope: 'session' }`；`InputBar.tsx:596-599` 仍是 `variant === 'composer' && input !== undefined && sessionId !== undefined ? renderSlot('conversation.composer.dock', {}) : null` | 未变 |
| `dsh-client-ui-renderer`（槽位运行时） | `runInject` 仍按位置传 `[binding.key, actions]`；`standardKit()` 仍给 `t` / `useStore` / `actions` / `renderFactorySlot` | 未变 |
| `dsh-client-ui-theme`（token 覆盖） | `overrideTokens` 那条路没有改动 | 未变 |
| Host（`dsh-host-webserver` 的 `webServer.register`） | 跑着的 0.2.2-rc.2 上 `GET /nord/balance` 直接 200 + 真实数据 | 未变 |

一个容易踩的坑：`dsh-client-store` / `dsh-client-ui-slots` / `dsh-client-ui-primitives` 这三个包**不在** dsh 安装树的 `node_modules/@deepseek-ai` 下（那里 336 个包，确实没有它们），它们被打进前端 shell：

```
<dsh>/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/index-ghOpC9uV.js
```

而模块表（`platform.ts` 那一段的等价物）在同一个文件里仍然逐一提供这些 id，还多了 `@deepseek-ai/dsh-client-ui-dockkit`。所以「包里找不到 = 模块 id 没了」是错的推理，问句要问导出表，而不是包目录。

## 2. 受影响的接口与行为

### 2.1 `useAnchoredPosition` 被删：余额条整条隐身

rc.2 的 `dsh-client-ui-primitives` 在 `lib/types/index.d.ts` 里只剩两行 hook 导出：

```ts
export { useAnchoredMaxHeight } from './useAnchoredMaxHeight.ts';
export { useDismissOnOutsidePointer } from './useDismissOnOutsidePointer.ts';
```

README 里写明了替代品：*Portalled `Menu` lists use CSS Anchor Positioning to follow their trigger and constrain their dimensions to the layout viewport.* 也就是说「把 fixed 浮层摆到锚点旁边」这件事从 JS hook 挪进了 `Menu` 自己的 CSS，公共 API 不再提供。

插件这边（0.4.3）的 `BalanceBar.tsx` 第 4 行是：

```ts
import { useAnchoredPosition, useDismissOnOutsidePointer } from '@deepseek-ai/dsh-client-ui-primitives'
```

而余额条是 dock 槽位里的一条 entry。rc.2 的 `scoped-slots.tsx` 给每条 entry 套了 `SlotErrorBoundary`：

```tsx
console.error(`slot entry crashed in '${this.props.slotKey}':`, error)
// 崩溃面渲染 <Anchor data-slot-error={slotKey} />（空 div），兄弟条目不受影响
```

于是链路是：hook 是 `undefined` → `BalanceBar` 首次渲染抛 `TypeError` → 错误边界吞掉 → 页面里连 `[data-dsh-nord-bar]` 都查不到。**主题、设置卡、导航图标全在别的 entry / 别的注册点，所以只有余额条静默消失**——这正是用户看到的现象。

### 2.2 修法：把两个 hook 内联

`src/client/anchored.ts` 新文件，按 rc.1 的 `AnchoredPositionOptions` 契约自己实现：

- `useAnchoredPosition({ open, anchorRef, panelRef, side, align, gap, margin, layoutKey })` → `CSSProperties | null`：读 `visualViewport`（退回布局视口），按 `side` 决定上下、按 `align` 决定左右，再夹进 `margin` 内；同时给 `maxWidth` / `maxHeight`，窄窗口上面板不会顶出屏幕。滚动、窗口缩放、`ResizeObserver` 与 `visualViewport` 变化都重摆；`useLayoutEffect` 保证首帧就在位，实测无闪跳。
- `useDismissOnOutsidePointer(root, open, setOpen, portal)`：捕获阶段监听 `pointerdown`，锚点与 portal 面板都算「里面」。

`BalanceBar.tsx` 因此只改一行 import。**为什么不是改用 `useAnchoredMaxHeight`**：那个 hook 只管高度上限，不产出坐标，用它等于把定位整段重写一遍还多一层依赖；既然唯一的公共定位 API 已经没了，内联就是最短的路，而且让余额条在 0.2.1 / 0.2.2-rc.1 上同样成立（内联实现不依赖宿主是否导出该 hook）。

代价与边界：面板定位不再跟随上游的桌面框留白（`frameClearance` / `overlayTopMargin`）与 `minWidthFromAnchor`，插件本来也没用这两个选项；余额面板在宿主桌面外壳里仍按 12px 视口边距夹取，视觉与 0.4.3 在 0.2.2-rc.1 上一致。

### 2.3 依赖基线：`dsh-brand` / `dsh-session` peer

`dsh-settings@0.2.2-rc.2` 的 peer 从「只有 `cordis`」变成：

```json
{ "@deepseek-ai/cordis": "~4.1.0", "@deepseek-ai/dsh-brand": "0.2.2-rc.2", "@deepseek-ai/dsh-session": "0.2.2-rc.2", "@deepseek-ai/schemastery": "~3.19.0" }
```

只把 12 个 `@deepseek-ai/dsh-*` 从 `0.2.2-rc.1` 改成 `0.2.2-rc.2` 会 `ERESOLVE`（`Conflicting peer dependency: @deepseek-ai/dsh-brand@0.2.2-rc.2`——树里躺着 rc.1 的那枚 peer）。把 `dsh-brand` 与 `dsh-session` 显式写进 devDependencies 后安装即通过，不需要 `--force` / `--legacy-peer-deps`，也不需要清树。`dsh-credentials@0.2.2-rc.2` 也多了一枚 `dsh-brand@0.2.2-rc.2` 依赖，同样由这条显式 peer 满足。

### 2.4 其余面：确实是零变化

- **dock 槽位**：声明与出口都在，且与 rc.1 逐字相同（见 §1 表）。
- **槽位运行时**：`slots.register` 的选项形状（`name` / `id` / `order` / `locale` / `store` / `inject`）、`inject` 的 `(sessionKey, actions)` 位置参数、`standardKit` 给的座位都没变。顺带一处「放宽」：`registry.ts` 里那句 `cross-scope` 校验在 rc.2 的产物里出现了 0 次（rc.1 里 1 次），方向是放宽，不是收紧。
- **主题 token**：rc.2 没有增删本层覆盖的 token，配色表不动。
- **Host 路由**：`webServer.register({ kind: 'exact', path, handler })` 照旧生效，`/nord/balance` 实测 200。

## 3. 验证

| 项目 | 结果 |
|---|---|
| `npx tsc -p tsconfig.json`（对 `0.2.2-rc.2` 的 typings） | 通过 |
| `npm test`（`node --test tests/*.test.mjs`） | 38 / 38 通过 |
| `npm run build`（tsdown） | 通过；`lib/client.js` 91.80 kB |
| 构建产物的 `require` 表 | `react` / `react-dom` / `react/jsx-runtime` / `@deepseek-ai/dsh-client-ui-primitives` / `@deepseek-ai/dsh-client-store`，与 shell 模块表一一对应 |
| 产物里的 primitives 取用 | 只剩 `Button` / `Input` / `Menu` / `Switch` / `IconChevronDownOutlineRegular` / `IconChevronDownOutline`（后者仅作老宿主回退），**不再取 `useAnchoredPosition`** |
| `GET /nord/balance`（跑着的 rc.2） | `200`，`{"currency":"CNY","total":"14.30",…,"available":true}` |

## 4. 留给下一轮

- 面板定位现在是本仓库的代码。上游若哪天把定位重新做成公共 API（`useAnchoredMaxHeight` 是线索：它和 `Menu` 的 CSS 定位配套），要不要迁回去，取决于那时 API 是否覆盖 `side: 'top'`。
- `dsh-client-ui-primitives` 的图标仍是「`Regular` / `Medium` 双字重 + `<use>` 引精灵表」，插件只用 `Regular`，回退到单字重的老名字只为 0.1.7；`0.2.2` 起那条回退是死代码。
