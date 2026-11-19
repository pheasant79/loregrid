# Loregrid 中文快速开始

Loregrid 把一个主题整理成多分页学习树：看整体依赖时用「总览」，学习具体内容时切到对应分页。

> 目前没有在线演示或 GitHub Release。可以按下面步骤在本机运行；应用没有账号和云同步。

![计算机科学示例树的 155 节点总览](assets/loregrid-preview-zh.jpg)

*这是仓库内 155 节点计算机科学示例的完整总览。截图用于展示整棵树的规模和结构；放大后再阅读节点内容。*

## 先运行起来

需要 Node.js 20 或更新版本，以及 pnpm。在项目文件夹中运行：

```powershell
pnpm install
pnpm dev
```

打开终端显示的本地地址。应用会先载入示例树。

## 使用自己的树

1. 打开右下角「树库」，选择「添加 JSON 树」，导入一个或多个 V1/V2 文件。
2. 用左上角分页选择器切换页面；点击「总览」查看当前树的所有分页。
3. 点击节点查看说明、前置和解锁内容；加入学习队列，或记录完成状态。
4. 需要保留学习记录时，在应用中导出该树的进度备份。

`required` 表示必需前置；多个必需前置需要全部满足。`recommended` 和 `related` 只提供参考，不会阻止节点开放。

## 树文件与学习记录

- **树 JSON** 保存公开或个人编写的学习内容。导入只会复制到当前浏览器，不会修改原文件。
- **学习记录** 包含队列、完成状态和私人笔记，单独保存在当前浏览器配置中，不会上传。

浏览器不会自动跟踪原文件夹。换浏览器、换设备或清理浏览器数据前，请保留原 JSON，并导出进度备份。详细说明见[隐私与本地存储](privacy.md)。

## 离线文件与客户交付

构建可离线打开的单文件网页：

```powershell
pnpm build
```

生成文件：`dist/index.html`。若要把指定树嵌入客户交付包：

```powershell
pnpm build:customer -- path/to/customer-tree.json
```

把整个 `dist/customer-delivery/` 文件夹交付给客户；客户双击其中的 `Loregrid.html` 即可使用。构建说明见[客户交付指南](customer-delivery.md)。

## 创建新树

从 [`data/templates/minimal-template-v2.json`](../data/templates/minimal-template-v2.json) 开始，按[树数据格式](data-format.md)填写节点、分页和关系，然后运行：

```powershell
pnpm validate -- path/to/tree.json
```

## 继续阅读

[全部文档导航](README.md) · [仓库目录](repository-layout.md) · [数据格式](data-format.md) · [客户交付](customer-delivery.md) · [隐私与存储](privacy.md)
