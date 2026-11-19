# 公开树库

树库可以显示内置树、导入的树，以及可选的公开目录。每棵树都有自己的分页、
总览和学习记录，不会把不同的树合并在一起。

启动时，应用会恢复上次打开的树。联网时，它也会检查已配置的公开目录。
公开树只有在你选择后才会下载；下载内容会先经过格式和安全校验。

## 发布公开树数据

公开目录文件为 `public/tree-catalog.json`。仓库默认不列出任何公开树。
要添加一棵公开树，可将 JSON 放入 `public/trees/`：

```text
public/
├── tree-catalog.json
└── trees/
    └── history.json
```

目录内容：

```json
{
  "format": "loregrid/public-tree-catalog-v1",
  "trees": [
    {
      "id": "history",
      "title": "历史学习",
      "url": "./trees/history.json",
      "fileName": "history.json"
    }
  ]
}
```

`id` 必须唯一，并与树 JSON 中的 `id` 相同。`title` 是列表名称。
`url` 可相对于目录，也可使用 HTTP(S) 地址。跨站托管需要允许浏览器跨域读取。
完整字段见 `schema/public-tree-catalog.schema.json`。

运行 `pnpm dev` 可在本地验证。构建后，`public/` 中的文件会复制到 `dist/`。
网站需要同时托管应用文件、目录和公开 JSON。

若目录托管在别处，可在启动开发服务器或构建前设置
`LOREGRID_PUBLIC_TREE_CATALOG_URL` 为完整 HTTP(S) 地址。

## 离线行为

离线打开 `dist/index.html` 不会读取远程目录。当前浏览器里已保存的树仍可使用；
远程公开树必须先在联网版本中下载。

这项功能只下载公开目录和你选中的树，不会扫描硬盘或上传个人记录。注意：
托管方仍会收到普通网络请求信息。私人内容不要放入 `public/trees/`。
更多存储边界见[隐私说明](privacy.md)。
