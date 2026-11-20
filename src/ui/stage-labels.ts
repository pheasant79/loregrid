import type { StageBand } from '../core/stages';

export interface StageLabel {
  stageId: string;
  text: string;
  color: string;
  x: number;
  y: number;
  width: number;
}

/** Screen-space labels: fixed font and top margin, never squeezed with maxWidth. */
export function placeStageLabels(
  bands: readonly StageBand[],
  view: { x: number; scale: number },
  viewportWidth: number,
  relationControlWidth: number,
  measure: (text: string) => number,
): StageLabel[] {
  return bands.flatMap((band) => {
    const left = Math.max(0, band.left * view.scale + view.x);
    const right = Math.min(viewportWidth, band.right * view.scale + view.x);
    const width = measure(band.label);
    // Fade-out/LOD comes from available space, never changing the glyph aspect.
    if (right - left < width + 20) return [];
    const x = left + 10;
    const overlapsControl = relationControlWidth > 0
      && x + width > viewportWidth - 16 - relationControlWidth
      && x < viewportWidth - 16;
    return [{ stageId: band.stageId, text: band.label, color: band.color, x, y: overlapsControl ? 49 : 8, width }];
  });
}
