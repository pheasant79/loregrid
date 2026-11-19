# Loregrid 中文说明

Loregrid 是一个分页式、离线运行的学习科技树。它保留 Learning Tech Tree 的静态网页形式，同时加入真正的独立分页、单独排版的总览、跨页前置代理、全局搜索、右侧详情、完成状态、私人笔记和备份。

先看：[仓库与交付目录说明](repository-layout.md) · [客户交付说明](customer-delivery.md)

## 本地运行

需要 Node.js 20 或更新版本。

```powershell
pnpm install
pnpm dev
```

生成可双击打开的单文件离线页面：

```powershell
pnpm build
```

结果位于 `dist/index.html`。使用者不需要安装 npm、登录账号或连接服务器。

如果是给客户的版本，使用 `pnpm build:customer -- path/to/customer-tree.json`，然后把
`dist/customer-delivery/` 整个文件夹交给客户。客户只需双击其中的 `Loregrid.html`；
不需要打开源码仓库或运行开发命令。

## 添加和切换树

点击右下角的「树库」，再点「添加树」，可一次选择多个 V1/V2 JSON 文件。也可以使用左上角菜单中的打开入口。树库显示树名和文件名，点击即可打开；每棵树分别保留队列、完成记录、笔记、组合分页和上次打开的分页。即使两份文件的树 ID 相同，本地进度也互不混用。

树多时，展开列表有搜索框和内部滚动条，高度受限；收起后只显示当前树和数量，不会一直向上铺满画面。总览和组合页仅属于当前打开的树，不合并其他树。

添加的内容会复制到当前浏览器的本地存储，刷新后可以继续打开；不会上传或修改原 JSON。浏览器不能自动扫描磁盘文件夹，原文件修改后需要重新导入。清理浏览器数据、换浏览器或移动离线 HTML 文件可能让原树库不可用，请保留原 JSON，并为各树分别导出进度备份。若存储不可用，界面会提示本次导入仅在当前会话有效。

## 创建自己的树

复制 `data/templates/minimal-template-v2.json`，保持节点 ID 稳定，并阅读 `docs/data-format.md`。私人学习树不要提交到公开仓库；`local-data/` 只是开发者临时输入目录，运行时树库保存在浏览器本地。

校验或迁移：

```powershell
pnpm validate -- data/examples/loregrid-demo.json
pnpm migrate -- data/compatibility/learning-tech-tree-v1-template.json data/new-v2-tree.json
```

旧版 `learning-tech-tree/v1` 可以直接在界面中打开，Loregrid 会在内存中转换，不会修改原文件。

## 关系含义

- `required`：硬前置，会影响解锁和主要排版；多个前置表示 AND。
- `recommended`：有方向的推荐，不锁定节点。
- `related`：无方向的相关内容，通常只在详情中显示。

本项目不包含 RimWorld 本体美术资源、游戏代码和模组运行逻辑；复用的 YART 自有 MIT 纹理保留了声明与来源。算法借鉴与 MIT 归属见 `THIRD_PARTY_NOTICES.md`。
