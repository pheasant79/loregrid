export const TREE_FORMAT = 'loregrid/tree-v2' as const;
export const PROGRESS_FORMAT = 'loregrid/progress-v2' as const;

export type TreeFormat = typeof TREE_FORMAT;
export type EdgeType = 'required' | 'recommended' | 'related';
export type NodeKind = 'topic' | 'optional' | 'milestone';
export type GraphKey = 'all' | `tab:${string}` | `preset:${string}`;

export interface PagePreset {
  id: string;
  name: string;
  tabIds: string[];
}

export interface TreeTab {
  id: string;
  label: string;
  labelEn?: string;
  color?: string;
  order?: number;
  description?: string;
}

export interface TreeStage {
  id: string;
  title: string;
  titleEn?: string;
  color?: string;
  order: number;
}

export interface TreeResource {
  id: string;
  title: string;
  url?: string;
  scope?: string;
}

export interface LayoutHint {
  groupId?: string;
  order?: number;
  /** Stable stage ID in loregrid/tree-v2. */
  stageId?: string;
  /** Legacy numeric stage hint retained for V1/V2 compatibility. */
  stage?: number;
}

export interface TreeNode {
  id: string;
  title: string;
  tabId: string;
  kind?: NodeKind;
  summary?: string;
  outcome?: string;
  caution?: string;
  tags?: string[];
  resourceIds?: string[];
  layout?: LayoutHint;
}

export interface TreeEdge {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  label?: string;
  reason?: string;
}

export interface TreeDefinitionV2 {
  format: TreeFormat;
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  version?: string;
  language?: string;
  tabs: TreeTab[];
  stages?: TreeStage[];
  resources: TreeResource[];
  nodes: TreeNode[];
  edges: TreeEdge[];
}

export interface ValidationIssue {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  path?: string;
}

export interface NormalizationResult {
  tree: TreeDefinitionV2;
  migratedFrom?: 'learning-tech-tree/v1';
  warnings: string[];
}

export interface GraphViewNode {
  viewId: string;
  nodeId: string;
  title: string;
  tabId: string;
  kind: 'real' | 'proxy';
  nodeKind: NodeKind;
  targetTabId?: string;
  stageId?: string;
  stageOrder?: number;
  effectiveStageId?: string;
  effectiveStageOrder?: number;
  layout?: LayoutHint;
}

export interface GraphViewEdge {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  originalEdgeId: string;
}

export interface GraphView {
  key: GraphKey;
  nodes: GraphViewNode[];
  edges: GraphViewEdge[];
}

export interface Point {
  x: number;
  y: number;
}

export interface LayoutNode extends GraphViewNode {
  x: number;
  y: number;
  width: number;
  height: number;
  rank: number;
}

export interface LayoutStageBoundary {
  stageId: string;
  stageOrder: number;
  left: number;
  right: number;
}

export interface LayoutEdge extends GraphViewEdge {
  points: Point[];
}

export interface LayoutResult {
  key: GraphKey;
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  width: number;
  height: number;
  durationMs: number;
  stageBoundaries: LayoutStageBoundary[];
}

export interface ProgressV2 {
  format: typeof PROGRESS_FORMAT;
  treeId: string;
  completed: Record<string, true>;
  notes: Record<string, string>;
  queue: string[];
  updatedAt?: string;
  exportedAt?: string;
  ui?: {
    language?: 'zh-CN' | 'en';
    lastGraphKey?: GraphKey;
    lastPageKey?: GraphKey;
    presets?: PagePreset[];
    favorites?: GraphKey[];
  };
}
