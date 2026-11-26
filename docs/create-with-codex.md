# 让 AI 创建学习树

[使用指南](README.zh-CN.md) · [中文提示词](../prompts/create-tree.zh-CN.md) · [English](#english)

你描述主题、已有基础和目标，AI 生成 JSON，Loregrid 负责计算位置、连线并呈现。**不需要为每棵树新建网页，也不需要填写坐标。**

## 1. 准备需求

告诉 AI 四件事：

- **学习什么**：主题和范围。
- **从哪里开始**：已有基础、限制与可用时间。
- **学到什么程度**：可以检查的成果。
- **怎样浏览**：分页建议、语言与内容深度。

一棵树就是一个独立 JSON，里面可以有多个分页、多个起点与多个目标。分页共同组成一张学习地图；「总览」只合并当前树的全部分页。树不要求所有内容共用一个根节点。

## 2. 给 AI 提示词

复制 [完整中文提示词](../prompts/create-tree.zh-CN.md)，填入需求。也可以先用这个简短版本：

```text
请按当前 Loregrid 仓库的数据格式，为以下主题创建学习树：
主题：[填写]
已有基础：[填写]
可检查的学习成果：[填写]
语言与分页建议：[填写]

先读 AGENTS.md、docs/data-format.md 和最小 V2 模板。
只输出 data/trees/<稳定ID>.json，不新建 HTML，不修改程序或进度。
节点应有明确介绍与成果，使用稳定 ID，不写 x/y 坐标。
必需前置采用 AND，禁止必需前置循环，允许多个起点和目标。
阶段如有必要，必须全树共享，不能每个分页各定义一套。
不编造资料来源。完成后说明核查范围。
```

浏览器读取这份固定内容，记录的完成状态、队列与笔记另存为进度；它不承担树内容编辑。

## 3. 放入统一位置并查看

将文件放进 **`data/trees/`**，然后：

- 已连接 `data/`：启动时读取；应用已打开时选择「重新读取数据文件夹」。
- 未连接，或使用 Firefox：在树库中手动导入 JSON。
- 不需要运行 Vite，也不需要为新增树重新构建应用。

需要给 AI 一个有效起点时，使用 [最小 V2 模板](templates/minimal-template-v2.json)。详细字段见 [数据格式](data-format.md)。

## 4. 修改前保留稳定 ID

AI 可以增加节点、补充内容或调整关系，但不应因为改标题就重建所有 ID。

同一棵树保留树 ID，已有节点保留节点 ID，才能与原有进度对应。删掉的节点无法再呈现在新树中，修改前请备份树和重要进度。

阶段用于全树一致的总体视角；没有可靠阶段划分时可以不填。不要把阶段当作人为固定坐标。

## 5. 核查结构，也核查内容

AI 或开发者可运行：

```powershell
pnpm validate -- data/trees/<你的树ID>.json
```

结构校验通过，不等于内容正确。还要打开应用，检查前置是否合理、介绍是否有用、资料链接是否真实。专业内容应由相应领域的人复核。

树 JSON 统一放在 `data/trees/`，个人进度放在 `data/progress/`。仓库只跟踪指定示例；分享文件前仍需检查是否包含私人内容。

## English

Describe the subject, starting knowledge, observable outcomes, and desired pages. Use the [copyable English prompt](../prompts/create-tree.md) or [minimal V2 template](templates/minimal-template-v2.json).

The author or AI creates **one `data/trees/<stable-id>.json` file per tree**. A tree may have multiple roots, goals, and pages; All combines the current tree's pages. Do not create a separate HTML or supply x/y coordinates.

Use stable tree and node IDs. Required edges are acyclic AND prerequisites; recommended and related links do not gate learning. Optional stages are shared across the whole tree, not independently defined by each page.

Connect `data/` in a supported browser, then reload the folder after edits. Otherwise import the JSON manually; Firefox requires reimporting after changes. No app rebuild is needed.

The app reads authored content and stores progress separately. It does not edit tree definitions. Keep private records out of shared examples.

AI or developers can run `pnpm validate -- data/trees/<id>.json`. Validation checks structure, not educational quality. Verify specialized claims and sources separately; preserve IDs when revising content.
