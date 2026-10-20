# 把 dsh-nord 收录进 awesome-dsh-plugin

依据 <https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/contributing.md>。这份目录**不收 README 改动**：投稿就是一个 `data/plugins/<owner>__<repo>.yml` 文件，两个 README 由脚本从 `data/plugins/*.yml` 生成。

本目录里备好的东西：

| 文件 | 去处 |
|---|---|
| `submission/data/plugins/verdana__dsh-nord.yml` | PR 里**唯一**要新增的文件 |
| `screenshots.json`（仓库根目录，已写好） | 推送到 main 后市场自动抓取，不用来这边提 PR |
| `submission/pr-body.md` | PR 正文，直接粘 |

---

## 1. 现状核对（对着 contributing.md 的硬性要求逐条查过）

| 要求 | 现状 | 证据 |
|---|---|---|
| `package.json` 声明 `dsh.bundle` | ✅ | `dsh.bundle.patch: ./cordis.patch.yml` |
| 仓库根有 `cordis.patch.yml` | ✅ | 内容为 `insert: [{ id: dsh-nord, name: dsh-nord }]` |
| 仓库有真实可用代码 | ✅ | `src/`（11 个源文件）、`lib/` 预构建产物、`tests/`、33 次提交 |
| 仓库创建满 1 天 | ✅ | GitHub API：`created_at` = 2026-09-20 |
| 项目处于活跃维护 | ✅ | 最新 release 0.4.0（2026-10-18），npm 同步发布 |
| 已加 `dsh-plugin` topic | ❌ **待办** | GitHub API 返回 `topics: []` |
| 描述属实、无营销词 | ✅ | 已逐句对照代码，见 `pr-body.md` 的 “claim by claim” |
| 分类贴合 | ✅ | `theme`（主题 Tab 会自动收录这一条） |
| 截图声明（推荐） | ✅ 本次新增 | `screenshots.json` → `assets/01-theme.png`、`02-settings.png`、`03-balance.png` |
| npm 包 `repository` 指回仓库 | ✅ | `dsh-nord@0.4.0`，`repository.url = git+https://github.com/verdana/dsh-nord.git` |

**结论：唯一的硬性缺口是 topic。** 其余都已满足；条目文件与截图声明已经准备好。

`npm` 字段不要写——contributing.md 明确说条目里手写 `npm:` 会被校验拒绝，映射由 registry 自动采集（我们的 `repository` 字段已经指回本仓库，所以下载量会自己关联上）。

---

## 2. 操作流程

### 第 1 步：给仓库加 topic（网页，约 30 秒，必须做）

1. 打开 <https://github.com/verdana/dsh-nord>
2. 右侧 **About** 那一栏点齿轮 ⚙️
3. **Topics** 里输入 `dsh-plugin`，回车，点 **Save changes**

CI 不会直接查 topic（它查的是 manifest 和仓库年龄），但评审会看，而且这是 contributing.md 明列的要求。

### 第 2 步：提交并推送截图声明

`npm` 包的 `files` 里没有 `screenshots.json`，所以这步**不需要发版**，推 main 即可；市场下一次构建（nightly）就从仓库根读它。

```powershell
cd D:\dsh-nord
git add screenshots.json
git commit -m "chore: 声明市场截图（screenshots.json）"
git push origin main
```

（如果想让本地先确认一遍：`Get-Content screenshots.json`，三个路径都相对该文件、都在 `assets/` 下、没有 `..`，符合 1–8 张的规则。）

### 第 3 步：提 PR（一个文件）

**网页路径（最省事，不用装 gh）：**

1. Fork：<https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/fork>
2. 在你 fork 的仓库里：**Add file → Create new file**
3. 文件名填 `data/plugins/verdana__dsh-nord.yml`（斜杠会自动建目录）
4. 内容粘 `submission/data/plugins/verdana__dsh-nord.yml` 全文
5. **Commit changes** → 选 *Create a new branch for this commit and start a pull request*，分支名 `add-dsh-nord` → **Propose changes**
6. 标题：`Add verdana/dsh-nord (theme)`；正文粘 `submission/pr-body.md`
7. **Create pull request**

**命令行路径（等价）：**

```powershell
# 先在网页上 fork 一次，然后：
git clone git@github.com:verdana/awesome-dsh-plugin.git
cd awesome-dsh-plugin
git switch -c add-dsh-nord
New-Item -ItemType Directory -Force data\plugins | Out-Null
Copy-Item D:\dsh-nord\submission\data\plugins\verdana__dsh-nord.yml data\plugins\
git add data/plugins/verdana__dsh-nord.yml
git commit -m "Add verdana/dsh-nord"
git push -u origin add-dsh-nord
```

push 完终端会打印一个 “Create a pull request” 链接，点进去填标题/正文即可。

> 想本地先预览生成出来的那一行长什么样（可选，不强求，也不要把结果提交）：
> `npm ci && node scripts/generate-readme.mjs`。我们这条会出现在 **Themes & Appearance** 分类下，按 url 字母序排。

---

## 3. CI 会依次查什么

| 检查 | 对本次提交的含义 |
|---|---|
| 每个 PR 最多 3 条 | 我们只有 1 条 ✅ |
| 从仓库根 `package.json` 读 `dsh.bundle` | 根包就有，不用子包路径 ✅ |
| 仓库年龄 ≥ 1 天 | 2026-09-20 创建 ✅ |
| `awesome-lint` + 站点构建（双语一致性、分隔符、日期、截图） | 描述单行、以句号结尾、含 `: ` 已加引号、`zh` 已提供 |

失败时 CI 会指出具体要改什么；**在同一个分支 push 修复即可**，不用重开 PR。

---

## 4. 评审会盯的三点，对应答案

1. **代码是否做了描述说的事** —— `pr-body.md` 里逐条给了文件位置：`nord.ts`（配色）、`NordSection.tsx`（设置页）、`host-fonts.ts` + `fonts.ts`（0.2.1 起把字体让回宿主）、`BalanceBar.tsx` + `src/index.ts` 的 `/nord/balance`（余额条与明细面板）。
2. **分类是否合理** —— `theme`。主题 Tab 会自动收这一类；就算维护者觉得该挪，也是他们直接改，不会打回。
3. **是否已被覆盖 / 是不是纯聚合包** —— 现有条目里没有 Nord 主题；本插件自己带行为（配色、设置页、余额接口），不是只列依赖的聚合包。

---

## 5. 合并之后

- `main` 上自动重生成 `README.md` / `README.zh.md` 和站点，**不需要我们再动任何东西**；
- `theme` 分类的条目自动进 [dsh-market](https://github.com/dsh-market/dsh-market) 的 **主题 Tab**，可一键装/切/卸；
- 截图由 nightly 从仓库根的 `screenshots.json` 抓取，以后换图只要推自己的仓库；
- npm 下载量从 registry 自动映射（`repository` 已对上），条目里不需要任何字段。

---

## 6. 容易被打回的坑（本次都已规避）

- ❌ 手动改 `README.md` / `README.zh.md` —— 生成物，会被覆盖，还会跟别人的 PR 冲突；只改自己那一个 yml。
- ❌ 条目里写 `npm:` —— 校验直接拒。
- ❌ 描述里的 `: `（冒号+空格）不加引号 —— YAML 解析失败。本次 `en` 已加双引号。
- ❌ 一个 PR 塞多条 —— 上限 3 条，我们 1 条。
- ❌ 动别人的条目 —— 只新增自己这个文件。
- ⚠️ `tarball:` 字段我们**不用**（已在 npm 发布，预构建安装免 `allowBuilds`）；如果哪天改用 GitHub Release 的 tarball，注意 `latest/download/` 的文件名不能带版本号。

## 7. 可选加分项（不影响收录，暂未改）

官方 `@deepseek-ai/*` 包按建议应声明为 `peerDependencies`。本插件目前的 `package.json` 里一个依赖都没声明：宿主提供 `@deepseek-ai/dsh-client-ui-primitives` / `dsh-client-store`，运行时从 profile 解析，现网安装也一直正常。要加的话必须带显式预发布分支，例如：

```jsonc
"peerDependencies": {
  "@deepseek-ai/dsh-client-ui-primitives": ">=0.0.1-rc.1 <0.1.0 || >=0.1.0-rc.1 <0.2.0",
  "@deepseek-ai/dsh-client-store": ">=0.0.1-rc.1 <0.1.0 || >=0.1.0-rc.1 <0.2.0"
}
```

这属于「更好的安装体验」，与收录无关，而且会牵动一次发版（0.4.1），所以我没动；要做可以单独一轮。
