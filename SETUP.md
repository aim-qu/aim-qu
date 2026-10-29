# Profile Playground

目标仓库：`aim-qu/aim-qu`。个人主页 README 由三段「活的」画面组成，每段都是由 GitHub Actions 定时或按访客操作重画的图片；可以动手玩的交互页另由 GitHub Pages 托管。

## 两个入口

- GitHub 个人主页：`README.md`。
  1. 星空：東経135°・北緯35°此刻的真实星空，白天显示当晚 21 点的星空，每小时重画。星名和星座名分成两组，轮流慢慢浮现又淡去。
  2. 障子与七十二候：竹影随实时的日月方位、天气和风变化，夜里点行灯；正中一格写当下的七十二候并盖朱印。打开页面三秒后，中间一扇障子自动拉开，露出窗外的水墨淡彩竹林。
  3. 石を返す：五路盘上的翻石谜题。访客点一颗石，会打开一个写好标题的 issue；提交后 Actions 翻好石子、更新盘面并关闭 issue。
- 可玩的交互页：`site/`，部署在 `https://aim-qu.github.io/aim-qu/`，README 末尾有入口。

README 不能运行 JavaScript，三段画面都是预先画好的图片：动的部分（星的闪烁、星名的浮现、障子的拉开、竹叶的摇动、落叶、雨雪）是 SVG 里的 CSS 动画，内容的变化靠定时重画。

## 本地使用

```powershell
git clone https://github.com/aim-qu/aim-qu.git
cd aim-qu
npm ci
npm run live
npm run preview:readme
```

- `live`：重画星空与障子，写到 `live/`，并改写 README 中 `<!-- live:sky -->`、`<!-- live:shoji -->` 两段。
- `preview:readme`：生成 `preview/readme-dark.html` 与 `readme-light.html`，按 GitHub 的样式在本地预览 README。
- 想看别的时刻与天气：`node scripts/live/build.mjs --at=2026-12-22T12:00+09:00 --weather=clear`（`--weather` 还可以是 `cloudy`、`rain`）。看完再跑一次 `npm run live` 恢复成当前的样子。
- `npm run preview`：启动交互页。

## 生成的流程

- `scripts/live/build.mjs`：入口。星空由 `sky.mjs` 画，障子由 `shoji.mjs` 画，拉开后的外景由 `garden.mjs` 画，竹林的形状在 `bamboo.mjs`，天体位置在 `astro.mjs`。
- `scripts/live/go.mjs`：翻石谜题。`--move` 由 Actions 调用；`--new` 开新的一局；`--tiles` 重画 `assets/go/` 的棋子图。
- `scripts/live/glyphs.mjs`：七十二候的字形。只在用字变化时，用本机装的 Noto Serif JP 重新生成 `data/glyphs.json`。
- 各数据文件的来源与授权见 `data/README.md`。

## 自动更新

- `.github/workflows/live.yml`：每小时第 7 分钟重画星空与障子，有变化才提交。
- `.github/workflows/go.yml`：有人开标题以「石を返す」开头的 issue 时，翻石、提交、回复并关闭 issue。每一手仓库主人都会收到 issue 通知，可以在仓库的 Watch 设置里调整。
- `.github/workflows/pages.yml`：每 6 小时发布交互页，不向仓库提交。
- 前两者会写仓库，共用同一个 concurrency 组，按顺序执行。提交者是 github-actions[bot]，不计入个人的贡献记录。

## 交互页的场景与操作

1. Rain：雨滴下落、折射、指针响应、雨量与暂停、可选雨音。
2. Terminal：只支持界面列出的本地命令，不执行系统 shell。
3. Lights Out：5×5 点灯谜题，从合法操作生成盘面，带线性代数求解提示。
4. Rain Beat：30 秒四轨节奏游戏，用 D/F/J/K 或触屏。
5. Public Data：公开 GitHub 资料的图形化展示；可手动更新，不读取私有仓库。
6. Trace：自由绘画、撤回、清空、导出 SVG。
7. Memory：12 张卡片、6 对配色，带完成判定。
8. Spectrum：8 音合成器，键盘或触屏，音色、音量与真实音频波形。
9. Model Briefing：官方 RSS 标题与短摘录，日期、抓取时间、来源筛选。AA 目前为官方榜单入口，数字榜单授权调查见 `docs/AA-INTEGRATION.md`。

声音默认关闭。游戏记录仅存在浏览器 localStorage，绘画不上传。没有账号注册、访问跟踪、私有项目数据或第三方统计卡片。

```powershell
npm run refresh
npm run build
npm test
npm run verify
```

- `refresh`：更新公开资料及两个官方 RSS。仅保留公开字段、标题和短摘录。
- `build`：将公开页面与所需资源复制到 `output/site`。
- `verify`：浏览器检查九个场景和真实游戏交互。

## 发布

使用有权限的账号将仓库文件提交到 main；在 GitHub Pages 的构建来源中选择 GitHub Actions。

不要上传 node_modules、preview 或 output；它们已被 .gitignore 排除。

AA 使用官方导出的图表图片，附署名、指数版本、来源与取得日期，放在 README 末尾的折叠里；未配置 API 密钥或定时采集。完整数字榜单与持续自动采集的范围仍需单独确认，见调查文档。

## 素材与依赖

- 星表：HYG Database v4.1（CC BY-SA 4.0）。天气：Open-Meteo（CC BY 4.0）。七十二候的字形：Noto Serif JP（SIL Open Font License 1.1），授权全文在 `data/OFL-NotoSerifJP.txt`。
- 交互页的雨景由内置 imagegen 参考现有公开头像的雨线与色调生成，原图为 assets/rain-scene.png，头像保留原样。生成过程与提示词记录见 docs/ARTWORK.md。
- IBM Plex Mono 构建字体及 OFL 授权保留在 resources/fonts；来源与校验值在 sources.json。所有 Node 依赖由 package-lock.json 锁定；Actions 只安装 `dependencies`（resvg 与 jpeg-js）。

依据：[GitHub Profile README](https://docs.github.com/en/account-and-profile/how-tos/profile-customization/managing-your-profile-readme)、[GitHub Markup](https://github.com/github/markup)、[GitHub Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。
