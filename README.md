# DreamNight Design

**DNDL v1.0 · 品牌统一，产品独立。**

DreamNight 的独立品牌设计仓库：规范 + 框架无关 Design Tokens + 少量可选工具与交互示例。不是网站模板，不是完整组件库，不要求复刻 JEVOS。

## 从这里开始

| 文件 | 职责 |
| --- | --- |
| [`DESIGN.md`](DESIGN.md) | DNDL v1.0 完整品牌基准与可读性附录 |
| [`tokens.css`](tokens.css) | 原始色板、语义值、字体、直角、层级、材质和动效默认值 |
| [`AGENTS.md`](AGENTS.md) | 开发 Agent 的执行规则与验收清单 |
| [`materials.css`](materials.css) | 可选 Acrylic 与层级工具；含不透明回退 |
| [`motion.css`](motion.css) | 可选 hover / press / 焦点 / 入场与交错升入工具；含减少动态效果 |
| [`examples/index.html`](examples/index.html) | 可离线打开的响应式品牌标本，演示详情展开与返回 |
| [`tests/validate.mjs`](tests/validate.mjs) | 零依赖色彩、Token 与仓库契约检查 |
| [`tests/browser.cjs`](tests/browser.cjs) | 用本机 Edge / Chrome 和 puppeteer-core 进行真实交互检查 |
| [`CHANGELOG.md`](CHANGELOG.md) | 版本变更记录 |

## 在产品中使用

将所需文件以确定版本纳入产品，保留其同级关系：

```html
<link rel="stylesheet" href="/vendor/dndl/tokens.css">
<!-- 下方两项按需加载，不要求采用任何组件或布局 -->
<link rel="stylesheet" href="/vendor/dndl/materials.css">
<link rel="stylesheet" href="/vendor/dndl/motion.css">
```

```css
body {
  background: var(--dn-canvas);
  color: var(--dn-text-primary);
  font-family: var(--dn-font);
}
.project {
  background: var(--dn-teal);
  color: var(--dn-text-on-color);
  border-radius: var(--dn-radius);
}
```

原始色不等于安全文字配对。例如品牌 Teal 不是默认白字按钮底色；使用 `--dn-text-on-color`。原始 Muted Ink 也不是浅色小字默认值。详见 `DESIGN.md` §12。

工具样式都以 `.dn-` 命名，只作用于显式添加的类。Tokens 不附带 reset，不接管产品网格、导航或 HTML。产品可以独立覆写语义分配；改动品牌原始值和核心语言必须说明版本与理由。

## 查看示例

直接打开 `examples/index.html`；没有构建步骤、第三方字体、远程图片或数据请求。演示信息来自本仓库静态规范，明确标为静态标本，不伪装实时项目动态。

若需 HTTP 访问，可在仓库根目录启动仅绑定本机的静态服务：

```sh
python -m http.server 4173 --bind 127.0.0.1
```

然后访问 `http://127.0.0.1:4173/examples/`。请使用机器上的可用 Python 解释器；此命令只用于本机预览，不是部署方案。

## 验证

Node.js 18+，基础检查无依赖：

```sh
node tests/validate.mjs
```

浏览器检查需要**外部工具环境**已提供 `puppeteer-core` 和本机浏览器；不需要下载 Chromium、不要求产品安装依赖：

```sh
NODE_PATH="/path/to/tooling/node_modules" \
DNDL_BROWSER="/path/to/edge-or-chrome" \
DNDL_REPORT_DIR="/absolute/path/to/reports" \
node tests/browser.cjs
```

此检查直接访问本地示例并生成 `verification.json` 与桌面、移动、详情截图。验证覆盖声明见 `tests/browser.cjs`；它不是完整 WCAG 审计。

## 管理与升级

- 当前版本 `1.1.0`。DNDL v1.0 是品牌名称，1.1.0 是可分发实现版本。
- 文档修正 / 补充示例：PATCH，例如 1.0.1。
- 向后兼容的新 Token / 主题 / 工具：MINOR，例如 1.1.0；新主题需重新验色。
- 既有 Token 改名或移除、品牌色或核心几何 / 交互原则的不兼容变更：MAJOR，例如 2.0.0。
- 消费项目记录采用版本，自主决定升级。不引用可变的默认分支作为生产设计依赖。
- 单源更新只影响随后升级的项目，不会自动推送到复制了旧文件的产品。
- 目前不发布 npm 包、不建设框架组件库或 Storybook。出现跨产品重复需求后再抽取。
- 未来发布前运行两类检查、更新变更记录，再由维护者选择提交、标签及分发方式。当前已有初始提交并公开托管于 GitHub；未创建版本标签，未发布 npm 包。

## 边界与许可

本仓库不规定页面布局、导航结构、信息密度或技术栈，也不包含标志设计与品牌资产授权。代码与文档以 [MIT 许可证](LICENSE)开源；标志、商标与品牌资产的授权范围仍须由品牌所有者确认。
