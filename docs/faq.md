# 常见问题

[使用指南](README.zh-CN.md) · [English](#english)

## 我到底应该打开哪个文件？

下载离线发行包，完整解压后打开根目录 **`index.html`**。源码 ZIP 的根目录也带有成品。

`src/index.html` 是开发模板，`dist/` 是开发构建输出。普通使用不用进入这些目录，不需要 Node.js 或 Vite。GitHub 上点击 HTML 看到的是文件预览，不是在线应用。

## 为什么打开只有一棵树？155 节点示例在哪里？

程序只内置「远境观测站」虚构示例。155 节点计算机科学兼容示例在 `data/trees/computer-science-phd.json`，手动导入它，或连接 `data/` 文件夹后加载。

应用不会因为 HTML 旁边有 JSON 就自动获得读取权限。

## AI 生成的 JSON 放在哪里？

统一放在 **`data/trees/`**。一棵树对应一个 JSON，里面有多个分页。「总览」合并当前树的全部分页；不同树的队列、完成记录和笔记独立。

“树”是学习地图的称呼，不要求数学意义上的单根结构。中国史与欧洲史可以作为同一个历史 JSON 的两个分页，也可以由作者做成独立文件；只有前者能在同一个总览里比较。

## 怎么授权文件夹？为什么刷新数据说没有授权？

在 Chrome / Edge 打开 **「⋯ → 选择数据文件夹」**，选择 **`data/`**，不是它里面的 `trees/`。

权限仍有效时，应用在启动时读取树；权限失效时用「重新授权数据文件夹」。应用已打开期间 AI 改了 JSON，用「重新读取数据文件夹」。这不是后台持续扫描，也不需要重新构建程序。

Firefox 使用手动导入；AI 更新原文件后再次导入同一棵树。详见 [文件夹说明](data-folder.md)。

## 树 JSON 和进度 JSON 有什么区别？

树是作者或 AI 维护的固定学习内容，应用不修改其中的节点和分页。

完成状态、队列和私人笔记属于单独的进度。浏览器平时保存本地记录；连接并获得写入权限时，也可以保存到 `data/progress/`。手动下载的备份由浏览器决定保存位置，可以自行放进这个文件夹。

更新树时保留树 ID 和已有节点 ID，让旧进度能对应到新版内容。

## 换浏览器、换电脑，记录会自动跟着走吗？

不会。没有账号或云同步，浏览器本地记录也可能因清理而丢失。

保留原始树 JSON，分别备份重要树的进度。在新环境先加载树，再恢复对应进度，或重新连接包含进度的授权数据文件夹。不要把浏览器缓存当作唯一备份。

## 队列里的节点会按时间自动完成吗？

不会。队列用于安排学习顺序，完成由你手动记录。多个必需前置采用 AND；推荐关系不锁定学习。取消前置的完成状态不会自动取消后续记录，但会提示不一致。

## 为什么切换英文后，节点还是中文？

语言按钮只切换应用界面。节点内容来自树作者，应用不自动翻译 JSON。

## 为什么没有“检查更新”？刷新树能更新程序吗？

检查更新从 **v2.1.0** 开始提供，旧的 v2.0.0 发行包没有这个功能。旧版用户到 [Releases](https://github.com/pheasant79/loregrid/releases/latest) 下载即可。

刷新树只读取 JSON；程序升级需要更换应用 HTML。更换前先备份重要进度，并保留自己的 `data/`。详见 [更新指南](updates.md)。

## English

**Which file should I open?** Extract the offline Release package and open its root `index.html`. The source ZIP also includes a ready app. `src/index.html` is a development template; GitHub's file preview is not a hosted app.

**Why only one tree?** Only the fictional station is embedded. Import `data/trees/computer-science-phd.json` for the 155-node compatibility example, or connect the data folder.

**Where do trees go?** Put each authored tree JSON in `data/trees/`. One tree contains multiple pages and may have multiple roots. All combines only the current tree's pages. Separate files keep independent progress and queues.

**How do I reload AI edits?** In Chrome / Edge, choose **⋯ → Choose data folder**, select `data/`, and grant access. With valid permission, trees are read at startup; use Reload data folder while open. Reconnect if access expires. Firefox requires manual reimport. Opening HTML alone grants no folder access.

**Does the app edit content?** No. Authors edit tree definitions; the app records completion, queue, notes, and view state separately. Preserve tree and node IDs when revising content.

**Where is progress?** In browser storage, plus separate files when folder write access is granted. Manual backup downloads use the browser's chosen location; you may keep them in `data/progress/`. Back up each important tree. There is no account or cloud sync, and browser storage can be cleared.

**Does learning finish automatically?** No. Completion is manual. Required prerequisites are AND; recommended connections are non-gating. Undoing completion does not cascade to later nodes.

**Why are node titles not translated?** The language toggle changes UI labels, not authored tree content.

**Where is the update checker?** It is available from v2.1.0, and absent from the older v2.0.0 package. Visit Releases manually if absent. Reloading JSON updates content, not the app. Back up progress and preserve `data/` before replacing the app HTML.
