# 更新 Loregrid / Updating Loregrid

> **版本范围：** 检查更新入口从 **v2.1.0** 开始提供。旧的 v2.0.0 发行包没有这个入口，请直接到 [Releases](https://github.com/pheasant79/loregrid/releases/latest) 下载。

## 查看新版本

点击应用**左下角版本号**，或打开 **⋯ → 检查更新**。
窗口显示当前版本、GitHub 最新正式版本、版本说明和可用下载。
检查失败会明确提示，不能据此判断已经是最新版。离线学习可照常使用。

默认不自动联网。你可以勾选「启动时检查更新（每天最多一次）」。
自动检查只在启动时进行，不会弹窗打断学习；发现新版后，版本号旁显示「有更新」。
手动点击检查不受每天一次的限制。设置依赖浏览器存储；无法保存时会显示提示。

## 保留数据升级

1. 先保留原始树 JSON，并逐一备份重要树的进度。更新窗口的备份按钮只导出当前树。
2. 下载 **`Loregrid-v…-update.html`**，关闭旧页面，将下载文件改名为 **`index.html`**，替换原位置的同名文件。
3. 保留整个 **`data/`** 文件夹，不用新版示例覆盖自己的树或进度。
4. 重新打开应用，确认左下角版本及学习记录。路径、浏览器或配置变更可能改变存储；需要时重新连接数据文件夹，或导入树与进度备份。

较早的 Release 可能没有单文件附件。这时下载完整离线 ZIP，解压到临时位置，
只取其中的 `index.html` 替换旧文件。首次使用者推荐完整离线包。

这是程序更新，不是树数据刷新。AI 更新了树 JSON 后，请使用「重新读取数据文件夹」；
未连接文件夹时手动导入 JSON。应用不会静默覆盖电脑上的文件。

## 网络与隐私

检查访问固定仓库 `pheasant79/loregrid` 的 GitHub Releases API，只查询正式 Release，
不把最新提交或预发布版当成正式更新。不发送树、笔记、队列或进度；GitHub 会收到
IP 地址等常规网络信息。下载和版本页面会打开 GitHub。程序更新不含账号或云同步。

## English

The update checker is available **from v2.1.0**. The older v2.0.0 package has no checker; download manually from Releases if it is absent.

Click the version at bottom left or **Menu → Check for updates**. Checks use the
latest stable GitHub Release, with clear offline/error states and plain-text release notes.
Automatic checks are **off by default**. Opt in for a startup check at most once daily;
an available update adds a small indicator without opening a modal. Manual checks are always available.

Back up progress for each important tree and keep original tree JSON files. The dialog's
backup button exports **only the current tree**. Download `Loregrid-v…-update.html`, close
the old page, rename the download to `index.html`, and replace the old HTML at the same
location. Keep `data/` intact. Reopen and verify the version and records. Browser,
profile, or location changes may require reconnecting the folder or importing backups.

If the release has no standalone HTML, extract its full offline ZIP separately and copy
only `index.html`. Use the full package for a first installation. No automatic file
replacement is attempted. Updating tree JSON is a separate operation: use **Reload data
folder** or import the tree manually.

Checking contacts GitHub, which receives ordinary network metadata such as your IP
address. No trees, notes, queues, or progress are sent. Failed checks never mean that
the installed version is confirmed current.
