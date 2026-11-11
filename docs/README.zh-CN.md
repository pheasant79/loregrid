# Loregrid 中文说明

Loregrid 是一个分页式、离线运行的学习科技树。它保留 Learning Tech Tree 的静态网页形式，同时加入真正的独立分页、单独排版的总览、跨页前置代理、全局搜索、右侧详情、完成状态、私人笔记和备份。

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

## 创建自己的树

复制 `data/minimal-template-v2.json`，保持节点 ID 稳定，并阅读 `docs/data-format.md`。私人学习树建议放在已忽略的 `local-data/`，不要把个人笔记或进度备份提交到公开仓库。

校验或迁移：

```powershell
pnpm validate -- data/my-tree.json
pnpm migrate -- data/old-v1-tree.json data/new-v2-tree.json
```

旧版 `learning-tech-tree/v1` 可以直接在界面中打开，Loregrid 会在内存中转换，不会修改原文件。

## 关系含义

- `required`：硬前置，会影响解锁和主要排版；多个前置表示 AND。
- `recommended`：有方向的推荐，不锁定节点。
- `related`：无方向的相关内容，通常只在详情中显示。

本项目不包含 RimWorld 或 YART 的美术资源、游戏代码和模组运行逻辑。算法借鉴与 MIT 归属见 `THIRD_PARTY_NOTICES.md`。
