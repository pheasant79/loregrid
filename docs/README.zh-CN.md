# Loregrid 使用指南

Loregrid 用分页式关系图呈现学习主题。每棵树包含多个分页和一个「总览」，可查看局部内容，也可回看整体依赖。

![计算机科学示例树的 155 节点总览](assets/loregrid-preview-zh.jpg)

*这是示例树的完整总览。先看整体结构，再放大查看节点。*

## 启动

目前没有在线演示或可下载版本。需要 Node.js 20+ 和 pnpm，在仓库目录运行：

```powershell
pnpm install
pnpm dev
```

打开终端显示的本地地址。应用会载入虚构示例树，核心功能不需要账号或联网。

## 导入和浏览

1. 打开右下角的「树库」，选择「添加 JSON 树」。
2. 选择一个或多个 V1/V2 格式的树文件。
3. 使用左上角的分页选择器浏览；选择「总览」查看当前树。
4. 选择节点查看说明和前置条件，再加入队列或记录完成状态。

不同树的分页、队列、完成状态和笔记彼此独立。`required` 是必需前置；多个前置都要满足。`recommended` 和 `related` 只供参考。

## 保存与备份

- 树 JSON 保存学习内容。导入会复制到浏览器，不会修改原文件。
- 队列、完成状态和私人笔记保存在当前浏览器。
- 应用没有账号、后台或云同步；换浏览器或清除浏览器数据后，记录可能无法恢复。

请保留原始 JSON，并为重要学习记录导出进度备份。更多信息见[隐私与本地存储](privacy.md)。

## 离线使用

生成可离线打开的单文件网页：

```powershell
pnpm build
```

打开 `dist/index.html`。构建输出不会提交到 Git。

## 创建树文件

复制 [`data/templates/minimal-template-v2.json`](../data/templates/minimal-template-v2.json)，按[树数据格式](data-format.md)填写，再运行：

```powershell
pnpm validate -- path/to/tree.json
```

## 文档

[文档索引](README.md) · [仓库结构](repository-layout.md) · [数据格式](data-format.md) · [隐私与存储](privacy.md)
