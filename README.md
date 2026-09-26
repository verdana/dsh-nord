# dsh-nord

给 [dsh](https://github.com/deepseek-ai/deepseek-harness) Web GUI 换一套 Nord：Nord 配色、可选字体、一页自己的设置，以及 composer 下方的 DeepSeek 余额读数。

![Nord 主题（深色）](assets/01-theme.png)

## 功能

- **Nord 配色** —— 116 个设计 token，浅色与深色两套，跟随 dsh 的「外观」设置切换；不写死颜色、不改 DOM，卸载即还原。
- **字体可选** —— 界面字体与代码字体分开选：跟随系统、八个预设（Maple Mono、JetBrains Mono、Cascadia Code、Fira Code、更纱黑体、霞鹜文楷、HarmonyOS Sans、MiSans），或者自己填一条 CSS `font-family`。预设是一整条回退栈，没装的家族自动落到下一个，中文回退由插件补在后面；下拉里的每一行用它自己的字体渲染，所以挑之前就能看到实际效果。界面字号仍跟随 dsh 的「字号大小」设置派生。
- **余额读数** —— composer 下方，与官方的轮次/步骤统计在同一行。点击弹出明细面板。用 DeepSeek 模型时（或余额接口就是 DeepSeek 时），面板底部多一行「用量信息」，直达 [platform.deepseek.com/usage](https://platform.deepseek.com/usage)；其他供应商的面板保持原样。

  ![余额明细](assets/03-balance.png)

- **独立的设置页** —— 设置面板左栏多一项「Nord 主题」，排在官方分区之后；本插件不再往「通用」里塞行。页面分外观、字体、余额条三组。

  ![设置](assets/02-settings.png)

> 截图是深色下的样子（浅色由同一套 token 的另一半驱动）。三张图由 `node scripts/shots/capture.mjs` 在隔离实例里重拍，见 [DEVELOPMENT.md](DEVELOPMENT.md#截图怎么来的)。

- **宽表格不再抖动** —— 修掉 dsh 上游的一处布局问题：鼠标停在 markdown 宽表格底边时，表格会因为悬停预留高度来回切换而抖动。补丁把 `md-table-wide` 钉在普通 `overflow-x: auto`，不写 DOM、卸载即还原；代价是横向放不下的宽表格会常驻显示横向滚动条（放得下的宽表格照旧没有滚动条）。详见 [DEVELOPMENT.md](DEVELOPMENT.md#宽表格为什么被钉在-auto)。

## 环境要求

- dsh **`0.1.5-rc.2`** —— 开发与验证所用的版本（`0.1.5-rc.1` 同样验证过）。其他版本见 [DEVELOPMENT.md](DEVELOPMENT.md#版本现实)。
- 余额读数需要 `DEEPSEEK_API_KEY`（由 dsh 的 credentials 服务解析）。没有凭据时余额条显示错误文案，主题、字体、设置不受影响。

## 安装

从 npm：

```sh
dsh plugin --profile web add dsh-nord
dsh web
```

从本仓库源码：

```sh
npm install && npm run build
dsh plugin --profile web add .
dsh --profile web --dump-config   # 应出现 "# == dsh-nord"
dsh web
```

从 GitHub 直接装：

```sh
dsh plugin --profile web add github:verdana/dsh-nord#main
```

`#main` 取的是分支最新提交；想锁死到某次提交，把 `main` 换成 commit sha 即可。

git 安装需要你在 profile 的 `pnpm-workspace.yaml` 里为该包授权构建脚本（`allowBuilds`），dsh 首次失败时会提示要粘贴的确切内容——这项授权等于允许该包在安装期执行代码，只对可信源码开放。不想让用户做这步，就用上面的 npm 或本地路径安装。

卸载：`dsh plugin --profile web remove dsh-nord`。

## 设置

设置面板 → 左栏「Nord 主题」（排在通用设置、模型、插件、Agent 预设之后）：

| 字段 | 默认 | 说明 |
|---|---|---|
| `themeEnabled` | true | 叠加 Nord 配色 |
| `fontEnabled` | true | 替换字体栈；关掉即回到 dsh 自带字体 |
| `uiFont` | `maple` | 界面字体：预设 id、`system`（跟随系统）或 `custom` |
| `uiFontCustom` | 空 | `uiFont: custom` 时使用的 CSS `font-family` 列表 |
| `codeFont` | `maple` | 代码字体：预设 id、`system`、`inherit`（跟随界面）或 `custom` |
| `codeFontCustom` | 空 | `codeFont: custom` 时使用的 CSS `font-family` 列表 |
| `balanceEnabled` | true | 显示底部余额条 |
| `refreshSeconds` | 60 | 余额刷新间隔，15–3600 |
| `baseURL` | `https://api.deepseek.com` | 余额接口地址 |

预设 id：`maple`、`jetbrains`、`cascadia`、`fira`、`sarasa`、`lxgw`、`harmony`、`misans`。

也可以在 profile 的 `cordis.patch.yml` 里按 `id: dsh-nord` 覆盖。patch 会**整体替换**目标行的 `config`，所以要重述所有键（缺的键由 schema 默认值补上，所以旧 patch 仍然能启动）：

```yaml
- id: dsh-nord
  config:
    themeEnabled: true
    fontEnabled: true
    uiFont: maple
    uiFontCustom: ''
    codeFont: inherit
    codeFontCustom: ''
    balanceEnabled: true
    refreshSeconds: 60
    baseURL: https://api.deepseek.com
```

`uiFontCustom` / `codeFontCustom` 按 CSS `font-family` 语法写，逗号分隔，例如 `'LXGW WenKai', 'Microsoft YaHei'`。插件只保留能识别的家族名（分号、花括号、引号、括号等一律丢弃），再用引号重新拼好，并在末尾补上中文回退；`sans-serif` 这类通用族保持不加引号。

## 许可

[MIT](LICENSE)
