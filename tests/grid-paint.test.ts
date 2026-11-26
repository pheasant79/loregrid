import { describe, expect, it, vi } from 'vitest';
import { drawGrid } from '../src/ui/renderer';

function captureGrid(scale: number, x = 0, y = 0) {
  const strokes: Array<{ color: string; points: number[][] }> = [];
  let points: number[][] = [];
  const context = {
    strokeStyle: '', lineWidth: 0,
    save: vi.fn(), restore: vi.fn(),
    beginPath: () => { points = []; },
    moveTo: (px: number, py: number) => { points.push([px, py]); },
    lineTo: vi.fn(),
    stroke: () => { strokes.push({ color: context.strokeStyle, points }); },
  };
  drawGrid(context as unknown as CanvasRenderingContext2D, 400, 240, { x, y, scale });
  return strokes;
}

describe('YART background grid', () => {
  it.each([0.08, 0.2, 0.4])('retains only the major grid at zoom %s', (scale) => {
    const strokes = captureGrid(scale);
    expect(strokes).toHaveLength(1);
    expect(strokes[0]!.color).toBe('rgba(255, 255, 255, 0.035)');
    expect(strokes[0]!.points[1]![0]! - strokes[0]!.points[0]![0]!).toBeCloseTo(200 * scale);
  });

  it('fades minor lines between 40 and 60 percent without changing major opacity', () => {
    const halfway = captureGrid(0.5);
    const full = captureGrid(0.6);
    expect(halfway).toHaveLength(2);
    expect(Number(halfway[0]!.color.match(/[\d.]+/g)![3])).toBeCloseTo(0.009);
    expect(Number(full[0]!.color.match(/[\d.]+/g)![3])).toBeCloseTo(0.018);
    expect(halfway[1]!.color).toBe(full[1]!.color);
  });

  it('does not double-paint minor lines over major lines', () => {
    const [minor, major] = captureGrid(1);
    const majorPositions = new Set(major!.points.map((point) => point.join(',')));
    expect(minor!.points.some((point) => majorPositions.has(point.join(',')))).toBe(false);
  });

  it('keeps the grid anchored to world coordinates when panning', () => {
    const [major] = captureGrid(0.2, -13, 7);
    expect(major!.points).toContainEqual([27, 0]);
    expect(major!.points).toContainEqual([0, 7]);
    expect(major!.points.every(([x, y]) => x! >= 0 && y! >= 0)).toBe(true);
  });
});
