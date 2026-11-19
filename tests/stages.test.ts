import { describe, expect, it } from 'vitest';
import { buildGraphView, tabKey } from '../src/core/graph';
import { layoutGraph } from '../src/core/layout';
import { normalizeTree } from '../src/core/normalize';
import { emptyProgress } from '../src/core/progress';
import { computeStageBands, stageBandAtX, stageTitle } from '../src/core/stages';
import { validateTree } from '../src/core/validate';
import { makeTree } from './fixtures';

describe('tree-wide learning stages', () => {
  it('assigns long-edge waypoints to their nearest stage region', () => {
    const bands = [
      { stageId: 'early', left: 0, right: 100, stageOrder: 0, label: 'Early', color: '#7799bb', progress: '0/1', completed: 0, total: 1, complete: false },
      { stageId: 'late', left: 100, right: 220, stageOrder: 1, label: 'Late', color: '#bb9977', progress: '0/1', completed: 0, total: 1, complete: false },
    ];

    expect(stageBandAtX(bands, 45)?.stageId).toBe('early');
    expect(stageBandAtX(bands, 145)?.stageId).toBe('late');
    expect(stageBandAtX(bands, 108)?.stageId).toBe('late');
    expect(stageBandAtX([], 100)).toBeUndefined();
  });

  it('uses one shared phase identity and layout boundary across All and page views', () => {
    const tree = makeTree();
    tree.nodes[0]!.layout = { stageId: 'start' };
    tree.nodes[1]!.layout = { stageId: 'start' };
    tree.nodes[2]!.layout = { stageId: 'practice' };
    tree.nodes[3]!.layout = { stageId: 'practice' };
    tree.stages = [
      { id: 'start', title: 'Starting', titleEn: 'Starting', order: 0 },
      { id: 'practice', title: 'Practice', titleEn: 'Practice', order: 1 },
    ];
    expect(stageTitle(tree, tree.nodes[0]!, 'en')).toBe('Starting');

    const allLayout = layoutGraph(buildGraphView(tree, 'all'));
    const allBands = computeStageBands(allLayout, tree, emptyProgress(tree.id), 'en');
    expect(allBands.map(({ stageId, label }) => [stageId, label])).toEqual([
      ['start', 'Starting'], ['practice', 'Practice'],
    ]);
    expect(allBands[0]!.right).toBe(allBands[1]!.left);

    const betaLayout = layoutGraph(buildGraphView(tree, tabKey('beta')));
    const betaBands = computeStageBands(betaLayout, tree, emptyProgress(tree.id), 'en');
    expect(betaBands.map((band) => band.stageId)).toEqual(['start', 'practice']);
    expect(betaLayout.nodes.find((node) => node.kind === 'proxy' && node.nodeId === 'a')?.stageId).toBe('start');

    const progress = emptyProgress(tree.id);
    progress.completed.c = true;
    progress.completed.d = true;
    expect(computeStageBands(allLayout, tree, progress, 'en')[1]!.complete).toBe(true);
  });

  it('moves a node into the latest required prerequisite phase when authored hints conflict', () => {
    const tree = makeTree();
    tree.nodes[0]!.layout = { stageId: 'late' };
    tree.nodes[1]!.layout = { stageId: 'early' };
    tree.stages = [
      { id: 'early', title: 'Early', order: 0 },
      { id: 'late', title: 'Late', order: 1 },
    ];
    const layout = layoutGraph(buildGraphView(tree, 'all'));
    const node = layout.nodes.find((entry) => entry.nodeId === 'b')!;
    expect(node.stageId).toBe('early');
    expect(node.effectiveStageId).toBe('late');
    expect(layout.stageBoundaries.map((boundary) => boundary.stageId)).toEqual(['late']);
  });

  it('keeps inherited stage identity when an upstream prerequisite is outside the page view', () => {
    const tree = makeTree();
    tree.stages = [
      { id: 'early', title: 'Early', order: 0 },
      { id: 'late', title: 'Late', order: 1 },
    ];
    tree.nodes.forEach((node) => { node.layout = { stageId: 'early' }; });
    tree.nodes[0]!.layout = { stageId: 'late' };

    const betaView = buildGraphView(tree, tabKey('beta'));
    const layout = layoutGraph(betaView);
    const proxy = layout.nodes.find((node) => node.kind === 'proxy' && node.nodeId === 'b')!;
    const child = layout.nodes.find((node) => node.nodeId === 'c')!;
    expect(proxy.stageId).toBe('early');
    expect(proxy.effectiveStageId).toBe('late');
    expect(child.effectiveStageId).toBe('late');
    expect(layout.stageBoundaries.map((boundary) => boundary.stageId)).toEqual(['late']);
  });

  it('does not count optional nodes as blockers for phase completion', () => {
    const tree = makeTree();
    tree.nodes = [{ id: 'a', title: 'Optional', tabId: 'alpha', kind: 'optional', layout: { stageId: 'optional-stage' } }];
    tree.edges = [];
    tree.stages = [{ id: 'optional-stage', title: 'Optional phase', order: 0 }];
    const bands = computeStageBands(layoutGraph(buildGraphView(tree, 'all')), tree, emptyProgress(tree.id), 'en');
    expect(bands[0]!.complete).toBe(false);
    expect(bands[0]!.total).toBe(0);
  });

  it('does not mark a shared stage complete from a partial page view', () => {
    const tree = makeTree();
    tree.nodes[0]!.layout = { stageId: 'practice' };
    tree.nodes[1]!.layout = { stageId: 'practice' };
    tree.nodes[2]!.layout = { stageId: 'practice' };
    tree.nodes[3]!.layout = { stageId: 'practice' };
    tree.stages = [{ id: 'practice', title: 'Practice', order: 0 }];
    const progress = emptyProgress(tree.id);
    progress.completed.c = true;
    progress.completed.d = true;
    const betaLayout = layoutGraph(buildGraphView(tree, tabKey('beta')));
    expect(computeStageBands(betaLayout, tree, progress, 'en')[0]!.complete).toBe(false);
    expect(computeStageBands(betaLayout, tree, progress, 'en')[0]!.total).toBe(4);
  });

  it('consolidates legacy page-scoped definitions without leaking conflicting labels into All', () => {
    const result = normalizeTree({
      format: 'loregrid/tree-v2',
      id: 'legacy-scoped',
      title: 'Legacy scoped',
      tabs: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
      paths: [{ id: 'main', label: 'Main' }],
      stages: [
        { id: 'a-stage', title: 'Field work', tabId: 'a', order: 0 },
        { id: 'b-stage', title: 'Data work', tabId: 'b', order: 0 },
      ],
      resources: [],
      nodes: [
        { id: 'first', title: 'First', tabId: 'a', layout: { stage: 0 } },
        { id: 'second', title: 'Second', tabId: 'b', layout: { stageId: 'b-stage' } },
      ],
      edges: [],
    });
    expect(result.tree.stages).toEqual([{ id: 'legacy-stage-0', title: '阶段 1', titleEn: 'Stage 1', order: 0 }]);
    expect(result.tree.nodes.map((node) => node.layout?.stageId)).toEqual(['legacy-stage-0', 'legacy-stage-0']);
    expect(result.warnings).toHaveLength(1);
    expect(validateTree(result.tree).filter((issue) => issue.severity === 'error')).toEqual([]);
  });

  it('requires globally unique stage order and valid node stage references', () => {
    const tree = makeTree();
    tree.stages = [
      { id: 'stage-a', title: 'A', order: 0 },
      { id: 'stage-b', title: 'B', order: 0 },
    ];
    tree.nodes[0]!.layout = { stageId: 'missing-stage' };
    const codes = validateTree(tree).map((issue) => issue.code);
    expect(codes).toContain('stage.ambiguous');
    expect(codes).toContain('node.stage');
  });
});
