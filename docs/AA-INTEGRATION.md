# Artificial Analysis 公開榜单接入调查

核对日期：2026-09-17（JST）。已验证官方图片下载并放入本地 README 预览；没有购买套餐、联系对方、创建密钥、启用定时采集或发布。

## 官方图片的折衷方案

[AA Media / Brand Kit](https://artificialanalysis.ai/brand-kit)明确允许按其规范引用已发布的分数、名次与图表，包括截图。图片内部须保留 Artificial Analysis 署名，附具体来源页、指数版本、配置和取得日期。商业用途需要联系 AA；批量或系统性使用仍由 API 条款约束。此前对完整可筛选数据表的结论，不能扩大为所有图表图片都不能引用。

2026-09-17 10:52 JST，通过首页 Intelligence Index 图表的 `Download chart as image` 按钮实际取得 PNG，2464×904；标题、v4.3 指数说明、26 个默认展示模型的配置和图内署名均保留。按钮生成的是浏览器内的 `data:image/png`，没有发现可供 README 长期直接引用的固定官方图片 URL。原始导出文件名中的日期为 `16 Sep '26`，不能把文件名日期当作日本时间的取得日期或准确的数据更新时间。

本地文件为 `assets/aa-intelligence.png`，来源与取得记录为 `assets/aa-intelligence.snapshot.json`。README 整幅展示，另提供原寸图片和具体图表链接。未改图中数值、颜色或坐标。

以后若启用每天三次更新，可安排 GitHub Actions 在 08:17、14:17、20:17 JST 运行浏览器，等待图表及字体加载，调用官方下载按钮，检查 PNG 尺寸与内容后再替换图片。失败保留旧图和旧取得时间；页面应始终标记快照，不宣称实时。GitHub 调度与图片代理缓存都可能延后，不能保证准点显示。

图片可以随仓库提交更新，也可以发布到 GitHub Pages 的固定地址供 README 引用。后者不必为每次图片变化向 main 增加提交，但仍需处理 GitHub 图片缓存。当前没有选择或启用其中任何自动发布方式。

[网站条款第 3.3 节](https://artificialanalysis.ai/terms-of-use)限制自动请求和采集；Media / Brand Kit 的普通图片引用许可未明确覆盖每日无人值守采集。长期定时采集需确认这一具体用途的许可，第三方截图中转不会改变该前提。本次仅做用户明确请求的单次下载验证。

## 已核实的接口与套餐

- 现行接口文档：`https://artificialanalysis.ai/data-api/docs`。
- 免费数据路径：`GET /api/v2/language/models/free`，通过 `x-api-key` 认证，分页返回。密钥必须留在服务器或 GitHub Actions Secret。
- 现行文档的 Free 配额为每个 24 小时窗口 100 次，Pro 为 500 次；旧 `/api-reference` 仍写 1,000 次，不能据此设计新接入。
- 模型 ID 可作稳定主键；NULL 保持“未测量或不适用”，不能转为 0。比较历史变化时需要保留 Intelligence Index 版本，版本不同不直接计算涨跌。

## 公开展示范围

[产品页](https://artificialanalysis.ai/data-api)将 Free 标为内部使用，Pro 为受限外部使用。更详细的[数据平台条款](https://artificialanalysiscdn.com/legal/ProDataPlatformTerms.pdf)第 2.3 节允许带署名分享图表及少量单点引用，但第 2.4 节限制原始数据、结构化表格和面向第三方产品中的原始数据分发；第 2.5 节也限制以榜单、比较或模型选择为主要用途的对外产品。Pro 并非完整公开榜单的通行许可；Commercial 也要看已签订 Order Form 的具体授权范围。

因此，个人 GitHub Pages 上自动更新、可筛选的完整模型表，以及放在公开仓库中的榜单 JSON，需要向 AA 确认书面展示范围。现有文件不足以确认这个具体用途已被授权。图表分享与完整数据镜像不能混为一谈。

## 建议实现

1. 确认 AA 允许这个个人主页的展示形式、数据条数、字段、缓存期限、更新频率及署名方式。
2. 获得允许后，将 `AA_API_KEY` 仅配置在后台 Secret。GitHub Pages 是静态托管，不能把密钥交给浏览器。
3. 后台每 6 小时抓取一次全部分页；如配额不足，依据 `X-RateLimit-Remaining` 和 `Retry-After` 退避。原始响应放在不公开的缓存中。
4. 只生成授权允许的公开产物：若允许图表则输出图片；若合同明确允许结构化数据，才输出筛选后的 JSON。
5. 标注“数据来源 Artificial Analysis”“抓取时间”“指数版本”。未返回来源更新时间时，明确不宣称知道该时间。
6. 与同版本的上一次快照比较，生成“新上榜、名次变化、分数变化”的事实摘要，不把摘要包装成未发生的新闻。首个快照不计算涨跌。

## 当前界面

第九场景提供 OpenAI 与 Google AI 官方 RSS 的标题入口、来源、日期与抓取时间，并提供 AA 官方实时榜单链接。本地 README 已加入官方导出的完整图表快照；第九场景尚未加入图片。没有伪造榜单数值，也没有把底层榜单 JSON 放进公开文件。RSS 与图表都按快照描述。
