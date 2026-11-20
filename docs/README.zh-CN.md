# Loregrid 使用指南

Loregrid 用分页式关系图呈现学习主题。每棵树包含多个分页和一个「总览」，可查看局部内容，也可回看整体依赖。

![计算机科学示例树的 155 节点总览](assets/loregrid-preview-zh.jpg)

*这是示例树的完整总览。先看整体结构，再放大查看节点。*

## 普通用户启动

在 GitHub 点击 **Code → Download ZIP**，解压后打开根目录的 `index.html`；也可以克隆仓库。
这是已经构建好的离线应用，不需要安装 Node.js、pnpm、Vite，也不需要启动服务器。根目录的
[`index.html`](../index.html) 是开发入口，直接打开时会提供到成品的链接。

应用会载入虚构示例树。通过树库菜单连接本地 `data/` 文件夹，或手动导入树 JSON。

## 开发者启动

只有修改 TypeScript 源码的开发者才需要 Node.js 20+ 和 pnpm，在仓库目录运行：

```powershell
pnpm install
pnpm dev
```

打开终端显示的本地地址。应用会载入虚构示例树，核心功能不需要账号或联网。

## 导入和浏览

1. 在 Chromium 浏览器中，从菜单选择仓库的 `data/` 文件夹；授权仍有效时，应用会在启动时读取 `trees/`。权限失效后，选择「重新授权数据文件夹」。
2. AI 新建或更新树 JSON 后，放进 `data/trees/`；应用已打开时选择「重新读取数据文件夹」。Firefox 等浏览器可手动导入 JSON，更新后需再次导入。
3. 使用左上角的分页选择器浏览；选择「总览」查看当前树。
4. 选择节点查看说明和前置条件，再加入队列或记录完成状态。

不同树的分页、队列、完成状态和笔记彼此独立。`required` 是必需前置；多个前置都要满足。`recommended` 和 `related` 只供参考。

## 保存与备份

- 树 JSON 保存固定学习内容，应用只读取，不修改原文件。
- 队列、完成状态和私人笔记保存在独立进度 JSON；连接数据文件夹时写入 `data/progress/`，并保留浏览器本地缓存。
- 应用没有账号、后台或云同步；换浏览器或清除浏览器数据后，记录可能无法恢复。

请保留原始 JSON，并为重要学习记录导出进度备份。更多信息见[隐私与本地存储](privacy.md)。

## 重新生成成品

```powershell
pnpm build
```

构建会更新根目录 `index.html`（用户直接打开的成品）。`src/index.html` 是开发模板，`dist/` 是忽略的构建中间产物，普通使用无需进入这两个目录。
普通用户不需要执行这个命令。

## 创建树文件

复制 [`templates/minimal-template-v2.json`](templates/minimal-template-v2.json)，按[树数据格式](data-format.md)填写，再把生成的 JSON 放入 `data/trees/`，然后运行：

```powershell
pnpm validate -- path/to/tree.json
```

## 文档

[文档索引](README.md) · [仓库结构](repository-layout.md) · [数据格式](data-format.md) · [隐私与存储](privacy.md)
