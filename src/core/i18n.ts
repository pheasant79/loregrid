export type Language = 'zh-CN' | 'en';

const messages = {
  'zh-CN': {
    all: '总览', search: '搜索节点、标签或 ID', openTree: '手动导入树 JSON', exportTree: '导出树 JSON',
    treeLibrary: '树库', addTree: '导入 JSON 树', searchTrees: '搜索树名或文件名', noTrees: '暂无可用的树', importingTrees: '正在导入树…',
    builtinTree: '示例', localTree: '本地',
    chooseDataFolder: '选择数据文件夹', refreshDataFolder: '重新读取数据文件夹',
    reconnectDataFolder: '重新授权数据文件夹',
    dataFolderConnected: '已连接数据文件夹：{name}', dataFolderPermissionNeeded: '数据文件夹需要重新授权',
    dataFolderRefreshed: '已重新读取数据文件夹', progressSavedToFolder: '进度已保存到 data/progress',
    treeStatus: '{queue} 项排队 · {count} 棵树',
    queue: '学习队列', addQueue: '加入队列', removeQueue: '移出队列',
    clearQueue: '清空', confirmClearQueue: '清空学习队列（{count} 项）？不会修改完成记录或笔记。',
    removeQueueChain: '移出此项及依赖它的排队项', priorityQueue: '优先学习此前置链', replaceQueue: '只保留此前置链',
    backup: '备份进度', restore: '恢复进度', fit: '适配视图', relations: '推荐关系',
    details: '节点详情', emptyDetails: '选择一个节点查看学习范围、依赖与记录。', zoomFloor: '最低缩放：{value}%',
    prerequisites: '必需前置', unlocks: '解锁内容', dependents: '解锁内容', recommended: '推荐学习', related: '相关内容',
    resources: '资源', outcome: '完成标准', caution: '注意', notes: '私人学习记录',
    completeOnly: '标记完成', completeChain: '同时标记缺失前置完成', undoComplete: '撤销完成',
    missingWarning: '该节点已完成，但仍有前置被标记为未完成。',
    migrated: '已兼容读取旧版树格式。', progressMigrated: '旧版进度已读取，将在保存时升级。',
    invalidFile: '文件无法打开', layoutBusy: '正在排版', cancel: '取消', completed: '已完成', ready: '可开始', locked: '未解锁',
    proxy: '外部分页前置', jump: '前往所属分页', nodes: '节点', complete: '完成',
    largeFile: '文件较大，读取和排版可能需要较长时间。是否继续？',
    storageRecovery: '已保护原有存储：当前无法读取进度，自动保存已暂停。请恢复有效备份；本次修改可导出备份。',
  },
  en: {
    all: 'All', search: 'Search nodes, tags, or IDs', openTree: 'Import tree JSON', exportTree: 'Export tree JSON',
    treeLibrary: 'Tree library', addTree: 'Import tree JSON', searchTrees: 'Search tree or file name', noTrees: 'No trees available', importingTrees: 'Adding trees…',
    builtinTree: 'Example', localTree: 'Local',
    chooseDataFolder: 'Choose data folder', refreshDataFolder: 'Reload data folder',
    reconnectDataFolder: 'Reconnect data folder',
    dataFolderConnected: 'Connected data folder: {name}', dataFolderPermissionNeeded: 'Data folder permission is needed',
    dataFolderRefreshed: 'Data folder reloaded', progressSavedToFolder: 'Progress saved to data/progress',
    treeStatus: '{queue} queued · {count} trees',
    queue: 'Learning queue', addQueue: 'Add to queue', removeQueue: 'Remove from queue',
    clearQueue: 'Clear', confirmClearQueue: 'Clear the learning queue ({count} items)? Completion records and notes will be kept.',
    removeQueueChain: 'Remove item and its queued dependents', priorityQueue: 'Prioritize prerequisite chain', replaceQueue: 'Keep only this prerequisite chain',
    backup: 'Back up progress', restore: 'Restore progress', fit: 'Fit view', relations: 'Recommended links',
    details: 'Node details', emptyDetails: 'Select a node to inspect its scope, dependencies, and notes.', zoomFloor: 'Minimum zoom: {value}%',
    prerequisites: 'Required prerequisites', unlocks: 'Unlocks', dependents: 'Unlocks', recommended: 'Recommended learning', related: 'Related topics',
    resources: 'Resources', outcome: 'Completion outcome', caution: 'Caution', notes: 'Private learning notes',
    completeOnly: 'Mark complete', completeChain: 'Also complete missing prerequisites', undoComplete: 'Undo completion',
    missingWarning: 'This node is complete while one or more prerequisites are marked incomplete.',
    migrated: 'A legacy tree was converted in memory.', progressMigrated: 'Legacy progress was loaded and will be upgraded when saved.',
    invalidFile: 'The file could not be opened', layoutBusy: 'Laying out graph', cancel: 'Cancel', completed: 'Completed', ready: 'Ready', locked: 'Locked',
    proxy: 'External prerequisite', jump: 'Open source tab', nodes: 'nodes', complete: 'complete',
    largeFile: 'This file is large and may take time to read and lay out. Continue?',
    storageRecovery: 'Existing storage is protected: progress could not be read, so autosave is paused. Restore a valid backup; current changes can be exported.',
  },
} as const;

export type MessageKey = keyof typeof messages.en;
export const t = (language: Language, key: MessageKey): string => messages[language][key];

export function chooseLanguage(treeLanguage?: string, saved?: string): Language {
  if (saved === 'zh-CN' || saved === 'en') return saved;
  const candidate = treeLanguage || navigator.language;
  return candidate.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
}
