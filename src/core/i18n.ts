export type Language = 'zh-CN' | 'en';

const messages = {
  'zh-CN': {
    all: '总览', search: '搜索节点、标签或 ID', openTree: '打开树', exportTree: '导出树',
    backup: '备份进度', restore: '恢复进度', fit: '适配视图', relations: '推荐关系',
    details: '节点详情', emptyDetails: '选择一个节点查看学习范围、依赖与记录。',
    prerequisites: '必需前置', dependents: '后续节点', recommended: '推荐学习', related: '相关内容',
    resources: '资源', outcome: '完成标准', caution: '注意', notes: '私人学习记录',
    completeOnly: '仅标记此节点完成', completeChain: '完成此节点及缺失前置', undoComplete: '取消完成',
    missingWarning: '该节点已完成，但仍有前置被标记为未完成。',
    migrated: '已兼容读取旧版树格式。', progressMigrated: '旧版进度已读取，将在保存时升级。',
    invalidFile: '文件无法打开', layoutBusy: '正在排版', cancel: '取消', completed: '已完成', ready: '可开始', locked: '未解锁',
    proxy: '外部分页前置', jump: '前往所属分页', nodes: '节点', complete: '完成',
    largeFile: '文件较大，读取和排版可能需要较长时间。是否继续？',
  },
  en: {
    all: 'All', search: 'Search nodes, tags, or IDs', openTree: 'Open tree', exportTree: 'Export tree',
    backup: 'Back up progress', restore: 'Restore progress', fit: 'Fit view', relations: 'Recommended links',
    details: 'Node details', emptyDetails: 'Select a node to inspect its scope, dependencies, and notes.',
    prerequisites: 'Required prerequisites', dependents: 'Required by', recommended: 'Recommended learning', related: 'Related topics',
    resources: 'Resources', outcome: 'Completion outcome', caution: 'Caution', notes: 'Private learning notes',
    completeOnly: 'Complete this node only', completeChain: 'Complete node and missing prerequisites', undoComplete: 'Mark incomplete',
    missingWarning: 'This node is complete while one or more prerequisites are marked incomplete.',
    migrated: 'A legacy tree was converted in memory.', progressMigrated: 'Legacy progress was loaded and will be upgraded when saved.',
    invalidFile: 'The file could not be opened', layoutBusy: 'Laying out graph', cancel: 'Cancel', completed: 'Completed', ready: 'Ready', locked: 'Locked',
    proxy: 'External prerequisite', jump: 'Open source tab', nodes: 'nodes', complete: 'complete',
    largeFile: 'This file is large and may take time to read and lay out. Continue?',
  },
} as const;

export type MessageKey = keyof typeof messages.en;
export const t = (language: Language, key: MessageKey): string => messages[language][key];

export function chooseLanguage(treeLanguage?: string, saved?: string): Language {
  if (saved === 'zh-CN' || saved === 'en') return saved;
  const candidate = treeLanguage || navigator.language;
  return candidate.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
}
