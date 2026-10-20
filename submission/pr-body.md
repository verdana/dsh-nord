Adds one entry: `verdana/dsh-nord` → category `theme`.

**The plugin.** Nord colour scheme for the dsh Web GUI — alias tokens overridden per palette mode, so both the light and the dark appearance are covered — plus a dedicated settings page, optional interface/code font stacks on dsh before 0.2.1 (from 0.2.1 the shell owns fonts and the plugin injects no font stylesheet), and a DeepSeek balance readout with a detail panel in the composer dock row.

**Manifest.** `dsh.bundle` → `./cordis.patch.yml` at the repository root:
<https://github.com/verdana/dsh-nord/blob/main/package.json> ·
<https://github.com/verdana/dsh-nord/blob/main/cordis.patch.yml>

**Repository.** Created 2026-09-20, 33 commits, 5 releases (latest 0.4.0 on 2026-10-18). The `dsh-plugin` topic is set. `lib/` is prebuilt and shipped in the package, so installs need no `allowBuilds` approval. Also published as `dsh-nord` on npm (latest 0.4.0), with `repository` pointing back at this repo.

**Screenshots.** `screenshots.json` at the repository root lists `assets/01-theme.png`, `assets/02-settings.png`, `assets/03-balance.png`.

**Description, claim by claim.**
- “matched light and dark palettes” → `src/client/nord.ts` (alias-token overrides composed per palette mode, removed with the plugin).
- “its own settings page” → `src/client/NordSection.tsx`, registered from `src/client/index.ts`; the host half turns the auto-generated form off (`settings.configure({ auto: false })`) so only the plugin's own page is composed.
- “selectable interface and code font stacks on dsh before 0.2.1” → `src/fonts.ts` plus `src/client/host-fonts.ts`, which detects the host release and delegates every font decision to the shell from 0.2.1 on.
- “a DeepSeek balance readout with a detail panel under the composer” → host route `/nord/balance` in `src/index.ts` (the API key is resolved by the credentials service and never leaves the host process) and `src/client/BalanceBar.tsx`, mounted in the `conversation.composer.dock` slot.

**Category.** `theme` — the palette is what the plugin is for; the settings page and the balance bar come with it. It is not a meta-package: it ships its own behaviour rather than a dependency list.

<details>
<summary>中文</summary>

新增一条：`verdana/dsh-nord`，分类 `theme`。

插件做三件事：给 dsh Web GUI 换 Nord 配色（浅色 / 深色两套 token 一起覆盖）；提供独立的「Nord 主题」设置页；composer 下方一行 DeepSeek 余额读数，点击出明细面板。dsh 0.2.1 之前还提供界面 / 代码字体替换，0.2.1 起字体由 dsh 自己管理，插件不再注入任何字体样式。

清单：仓库根 `package.json` 声明 `dsh.bundle` → `./cordis.patch.yml`。仓库创建于 2026-09-20，33 次提交、5 个 release（最新 0.4.0，2026-10-18），已加 `dsh-plugin` topic，`lib/` 预构建随包发布（安装无需 `allowBuilds` 授权），npm 上为 `dsh-nord@0.4.0` 且 `repository` 指回本仓库。

分类取 `theme`：主题是这个插件的本职，设置页与余额条是随主题一起装的部分；它不是纯聚合包。

</details>
