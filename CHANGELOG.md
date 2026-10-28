# 变更记录

每个已发布版本的**用户可见变化**记在这里。版本号由 npm 承担（见 README 顶部的 badge），
历史由本文件承担，两者都不需要每次发版手工同步。

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循
[语义化版本](https://semver.org/lang/zh-CN/)。

## [未发布]

### 新增

- 设置页左栏的那一行换成调色板图标，页面底部显示当前正在运行的插件版本号。

### 修复

- `verify-compat` 的 token 抽样表补上 0.4.1 的配色改动（暗色 `label-tertiary` 与 `color-mix()`
  的 error 文本）；会话夹具改为优先挑选真的发过请求的会话，不再拿空白会话去验「用量信息」座位。
- 发布流水线的 tarball 核查不再因 `npm pack --json` 的形状变化（npm 10 的对象 / npm 11 的数组，
  以及前面的构建日志里也带方括号）抛 `SyntaxError`；解析单独成 `scripts/pack-report.mjs` 并带规格。

### 文档 / 工程

- 兼容性核查推进到 dsh `0.2.1-rc.4`：依赖基线从 `0.2.1-rc.2` 升到 `0.2.1-rc.4`，
  `rc.2 → rc.4` 之间插件依赖的契约面未变，源码无需改动
  （见 [COMPAT-0.2.1-rc.4.md](./COMPAT-0.2.1-rc.4.md)）。
- 版本历史移入本文件：README 顶部改用 npm badge 报最新版本，文档不再声明「当前发布是 X」，
  发布脚本加了一道 CHANGELOG 闸门。

## [0.4.1] - 2026-10-20

### 修复

- 浅色下的链接与主按钮对比度提到 4.5:1 以上，error 按明暗分别加深，`faint` 提亮；
  补上 `file-diff` / `code-diff` / `state-idle` / `menu-icon` 这几处绕过语义层直接读静态
  色阶的缺口（覆盖的 token 总数 132）。

### 其他

- 声明市场截图清单 `screenshots.json`。

## [0.4.0] - 2026-10-18

### 变更（不兼容）

- **不再支持 dsh `≤ 0.1.5`。** 那一代的设置命名空间是另一套接口（Host `installSection` +
  浏览器 `settingsScope`），兼容代码连同双份 schema 一起删除；支持范围收窄为
  `0.1.7` / `0.2.0` / `0.2.1`，还停在 `≤ 0.1.5` 的请留在插件 0.3.x。
- **dsh `0.2.1` 起字体与字号交给 dsh 自己**（设置 → 通用 → 字体）：插件不再注入字体层，
  设置页的字体组只留一行说明。更早的版本仍由插件提供字体替换。
- `package.json` 增加 `engines.dsh: ">=0.1.7-0"`：dsh 0.2.1 及以后在安装与启动时直接拒绝
  更老的宿主，并给 `dsh plugin allow-version` 的临时豁免指引。

## [0.3.1] - 2026-10-06

### 变更

- 构建基线跟随 dsh `0.2.0-rc.2`。

### 其他

- 发布后核对先等 registry 传播，不再把读写窗口报成「包有问题」。

## [0.3.0] - 2026-09-27

### 新增

- 兼容 dsh `0.1.7-rc.2`（设置命名空间改由 Loader 从条目导出的 `Config` 派生）。

### 修复

- 余额明细面板补上磨砂背景；余额读数改为按同级状态行的首行基线对齐——两处都只在
  0.1.7 上看得出来。

## [0.2.0] - 2026-09-27

### 新增

- **字体可选**：界面字体与代码字体分开选，八个预设、跟随系统，或自己填一条 CSS
  `font-family`；下拉里每一行用它自己的字体渲染，挑之前就能看到实际效果。
- 设置不再塞进「通用」，改成左栏独立的一页「Nord 主题」。
- 余额明细面板底部加一行「用量信息」，直达 DeepSeek 用量页。

## [0.1.1] - 2026-09-22

### 修复

- 余额读数按会话多播：切回旧会话不再冻在上一个会话的读数上。

## [0.1.0] - 2026-09-21

### 新增

- 首个发布：Nord 配色（浅色与深色两套 token，卸载即还原）、Maple Mono 字体、一行设置、
  composer 下方的 DeepSeek 余额读数与明细面板。

### 修复

- markdown 宽表格：鼠标停在底边时不再抖动；代价是横向放不下的宽表格常驻一条横向滚动条。

[未发布]: https://github.com/verdana/dsh-nord/compare/v0.4.1...HEAD
[0.4.1]: https://github.com/verdana/dsh-nord/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/verdana/dsh-nord/compare/v0.3.1...v0.4.0
[0.3.1]: https://github.com/verdana/dsh-nord/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/verdana/dsh-nord/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/verdana/dsh-nord/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/verdana/dsh-nord/releases/tag/v0.1.1
[0.1.0]: https://www.npmjs.com/package/dsh-nord/v/0.1.0
