import { describe, expect, it } from 'vitest';
import type { StageBand } from '../src/core/stages';
import { placeStageLabels } from '../src/ui/stage-labels';

const band: StageBand = {
  stageId: 'era', label: 'Early foundations', left: 0, right: 1000, color: '#86b9a0',
  progress: '0/10', completed: 0, total: 10, complete: false,
};
const measure = (text: string) => text.length * 8;

describe('natural-sized stage labels', () => {
  it('keeps fixed font metrics and top padding while zooming and panning', () => {
    const [normal] = placeStageLabels([band], { x: 0, scale: 1 }, 1200, 0, measure);
    const [zoomed] = placeStageLabels([band], { x: -40, scale: .3 }, 1200, 0, measure);
    expect(normal).toMatchObject({ x: 10, y: 8, width: measure(band.label) });
    expect(zoomed).toMatchObject({ x: 10, y: 8, width: measure(band.label) });
  });

  it('hides labels when the visible band is too narrow rather than squeezing glyphs', () => {
    expect(placeStageLabels([band], { x: 0, scale: .1 }, 1200, 0, measure)).toEqual([]);
    expect(placeStageLabels([band], { x: 1180, scale: 1 }, 1200, 0, measure)).toEqual([]);
    expect(placeStageLabels([band], { x: -1100, scale: 1 }, 1200, 0, measure)).toEqual([]);
  });

  it('keeps separate stage labels within their bands and avoids the relation toggle', () => {
    const labels = placeStageLabels([band, { ...band, stageId: 'next', left: 1000, right: 1400 }],
      { x: 0, scale: 1 }, 1200, 200, measure);
    expect(labels).toHaveLength(2);
    expect(labels[0]!.x + labels[0]!.width).toBeLessThan(labels[1]!.x);
    expect(labels[1]).toMatchObject({ x: 1010, y: 49 });
  });
});
