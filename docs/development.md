# 开发指南

[项目首页](../README.md) · [仓库结构](repository-layout.md) · [English](#english)

这份文档面向修改源码、测试或制作发行包的人。只想学习的用户请看 [使用指南](README.zh-CN.md)，无需安装以下环境。

## 环境与启动

使用 **Node.js 20+** 和 **pnpm**，在仓库根目录运行：

```powershell
pnpm install
pnpm dev
```

打开终端给出的本地地址。TypeScript、样式和开发模板由 Vite 处理；这些都是构建时工具，离线成品运行时没有 Node 服务或运行时 npm 依赖。

## 哪些文件负责什么？

| 位置 | 职责 |
| --- | --- |
| `src/` | TypeScript 模型、布局、Worker、渲染、交互与样式 |
| `src/index.html` | 源码开发模板 |
| 根目录 `index.html` | 已构建、可直接打开的离线成品 |
| `dist/` | 被 Git 忽略的构建输出；普通用户无需进入 |
| `data/trees/` | AI 或作者维护的树 JSON；仓库只跟踪指定示例 |
| `data/progress/` | 个人学习记录，不提交 |
| `scripts/`、`tests/` | 开发、打包与验证工具 |

应用在浏览器内完成运算。布局使用 Worker，图形使用 Canvas 和虚拟化 DOM；JSON 是内容，不是运行中的后端。详见 [架构](architecture.md)。

## 选择与改动相符的检查

```powershell
pnpm check
pnpm test
pnpm validate -- data/trees/loregrid-demo.json
pnpm build
```

- 修改交互或渲染：运行 `pnpm test:e2e`，检查 Chromium 和 Firefox。
- 修改图或布局：运行 `pnpm benchmark`，分别报告首次布局与平移缩放表现。
- 修改树：校验对应 JSON，再在应用中检查内容和连线。
- 修改文档：运行 `pnpm exec tsx scripts/check-docs.ts`，检查相对链接；页面排版仍需人工查看。

浏览器测试需要本机可用的 Playwright 浏览器。不要把未运行的检查写成通过，也不要把一次机器上的测试结果当作通用性能保证。

## 构建与打包

```powershell
pnpm build
pnpm package:release
```

`build` 生成静态构建，并更新根目录离线 `index.html`。改源码后若直接打开旧成品，看到的仍是上次构建。

当前源码的发行打包流程生成完整离线 ZIP 和单独的更新 HTML。输出位置与文件名见 [发布说明](publish.md)。运行本地打包不会上传 GitHub，也不会创建 Release。

v2.1.0 起提供更新检查器和单文件更新附件；旧的 v2.0.0 附件仅提供完整离线 ZIP。

## 更新文档截图

在根目录成品已包含需要展示的改动后运行：

```powershell
pnpm exec tsx scripts/capture-docs.ts
```

脚本使用干净浏览器上下文、公开示例及明确的演示进度，屏蔽外部网络请求，生成中英文总览和操作截图。Windows 默认使用本机 Chrome，也可设置 `PLAYWRIGHT_CHROMIUM_EXECUTABLE` 指定路径。

检查画面裁切、文字大小、队列和详情状态；截图应真实反映应用，不拼接假界面，不使用私人学习记录。

## 提交前

保留原有许可、[第三方声明](legal/THIRD_PARTY_NOTICES.md) 与 [YART 来源映射](yart-source-map.md)。确认没有提交进度、私人树、凭证、本机路径和临时测试输出。

更多要求见 [贡献指南](../.github/CONTRIBUTING.md) 和 [发布检查](publish.md)。构建、测试和本地修改不代表获得推送或发布授权。

## English

This guide is for source contributors. Ordinary users open the ready root `index.html`; they do not need development tools.

Use Node.js 20+ and pnpm. Run `pnpm install`, then `pnpm dev` from the repository root. Vite handles TypeScript, styles, and the source HTML template. The built app runs in the browser without a Node backend or runtime npm dependencies.

`src/` contains source code; `src/index.html` is the development template. `pnpm build` refreshes the ready root HTML and ignored `dist/` output. Authored content stays in `data/trees/`, personal records in `data/progress/`.

Run `pnpm check`, `pnpm test`, validation for changed trees, and `pnpm build` as appropriate. UI changes need `pnpm test:e2e`; layout changes need `pnpm benchmark`. Report actual checks and distinguish one-time layout cost from continuous interaction performance.

For documentation, run `pnpm exec tsx scripts/check-docs.ts` and inspect rendered pages. `pnpm exec tsx scripts/capture-docs.ts` captures the ready app using only public fixtures and synthetic progress. It uses local Chrome on Windows or `PLAYWRIGHT_CHROMIUM_EXECUTABLE`.

`pnpm package:release` builds local artifacts; it does not publish. From v2.1.0, packaging supports a full offline ZIP and update HTML, alongside the in-app checker. The older v2.0.0 Release contains only the full ZIP and no checker.

Preserve licenses and source attributions. Exclude personal data, progress, credentials, local paths, and temporary output from commits. See [contributing](../.github/CONTRIBUTING.md) and the [publishing checklist](publish.md).
