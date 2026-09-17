# Profile Playground

目标仓库：`aim-qu/aim-qu`。README 直接展示九个完整场景的操作动画、官方新闻标题和 AA 图表快照；交互版本由 GitHub Pages 托管。

## 两个入口

- GitHub 个人主页：`README.md`，含雨景横幅、九个完整场景动画、六条新闻标题、AA 图表与原生折叠说明。
- 可玩的交互页：`site/`。部署入口为 `https://aim-qu.github.io/aim-qu/`。

README 不能运行 JavaScript，游戏与指针交互在 Pages 页面内运行。README 中的场景截图是预览，不伪装成可直接操作的 iframe。

交互页从顶部雨景开始连续向下滚动。点灯与记忆游戏合并在同一游戏区，用带动画的选项条切换；其余内容沿页面展开。底部导航跳到对应区域，不隐藏整页其他内容。

## 本地使用

```powershell
git clone https://github.com/aim-qu/aim-qu.git
cd aim-qu
npm ci
npm run preview
```

命令会输出本地交互页地址。保持该进程运行，再开一个终端：

```powershell
npm run preview:readme
```

该命令用 GitHub Markdown API 渲染 README，返回另一个地址。本地 README 的 Pages 链接会自动指向已启动的交互页；GitHub 外框为近似布局。

## 场景与操作

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

## 更新与验证

```powershell
npm run refresh
npm run build
npm test
npm run verify
npm run verify:readme
```

- `refresh`：更新公开资料及两个官方 RSS。仅保留公开字段、标题和短摘录。
- `build`：将公开页面与所需资源复制到 `output/site`。
- `capture`：在本地交互页启动后，重新录制 README 的雨景 GIF 与九张场景截图。
- `node scripts/capture-readme.mjs`：在本地交互页启动后，录制九个完整场景的操作动画。
- `node scripts/build-readme.mjs`：使用已有动画与新闻快照生成长版 README。
- `verify`：浏览器检查九个场景和真实游戏交互。
- `verify:readme`：检查 Markdown 渲染、图片、折叠与手机布局。

## 发布

使用有权限的账号将仓库文件提交到 main；在 GitHub Pages 的构建来源中选择 GitHub Actions。`.github/workflows/pages.yml` 会发布静态页面，并在发布后每 6 小时更新 Pages 的公开数据与新闻快照，不向仓库自动提交数据。README 中的动画、标题与 AA 图片保持已提交的快照；更新 README 时重新生成并提交。

上传内容包括 README、assets、site、scripts、resources/fonts、package 文件与 .github/workflows。不要上传 node_modules、preview 或 output；它们已被 .gitignore 排除。准备发布时也可以使用 output 下生成的上传压缩包。

AA 使用官方导出的图表图片，附署名、指数版本、来源与取得日期；未配置 API 密钥或定时采集。完整数字榜单与持续自动采集的范围仍需单独确认，见调查文档。

## 素材与依赖

雨景由内置 imagegen 参考现有公开头像的雨线与色调生成，原图为 assets/rain-scene.png，头像保留原样。生成过程与提示词记录见 docs/ARTWORK.md。真实雨滴动效由 WebGL 程序叠加，README GIF 录制自实际渲染。

IBM Plex Mono 构建字体及 OFL 授权保留在 resources/fonts；来源与校验值在 sources.json。所有 Node 依赖由 package-lock.json 锁定。

依据：[GitHub Profile README](https://docs.github.com/en/account-and-profile/how-tos/profile-customization/managing-your-profile-readme)、[GitHub Markup](https://github.com/github/markup)、[GitHub Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。
