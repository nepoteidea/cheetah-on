import { describe, expect, it } from 'vitest';
import { bounds, cheetahDistance, face, shapes, spots } from '../../src/cheetah.js';

describe('cheetah silhouette', () => {
  it('is solid in the torso, head, tail and paws', () => {
    expect(cheetahDistance(0, -40)).toBe(0); // torso
    expect(cheetahDistance(398, -196)).toBe(0); // head
    expect(cheetahDistance(-480, -192)).toBe(0); // tail curl
    expect(cheetahDistance(314, 306)).toBe(0); // front paw
  });

  it('is not a bounding box: gaps between the legs and under the belly are open', () => {
    expect(cheetahDistance(225, 250)).toBeGreaterThan(20); // between front legs
    expect(cheetahDistance(0, 200)).toBeGreaterThan(100); // under the belly
    expect(cheetahDistance(-190, 290)).toBeGreaterThan(10); // between hind legs
  });

  it('leaves the inside of the tail curl and the space above the back open', () => {
    expect(cheetahDistance(-425, -180)).toBeGreaterThan(10);
    expect(cheetahDistance(0, -220)).toBeGreaterThan(50);
    expect(cheetahDistance(-200, -250)).toBeGreaterThan(50);
  });

  it('faces right: head on the right, tail on the left', () => {
    expect(bounds.maxX).toBeGreaterThan(450);
    expect(bounds.minX).toBeLessThan(-450);
    const tail = shapes.find((s) => s.part === 'tail');
    expect(Math.min(...tail.points.map((p) => p[0]))).toBeLessThan(-450);
  });

  it('has four legs and four paws, far ones marked for shading', () => {
    const legs = shapes.filter((s) => s.part === 'leg');
    const paws = shapes.filter((s) => s.part === 'paw');
    expect(legs).toHaveLength(4);
    expect(paws).toHaveLength(4);
    expect(legs.filter((l) => l.far)).toHaveLength(2);
    // Paws reach down near the bottom of the figure.
    for (const leg of legs) expect(leg.points.at(-1)[1]).toBeGreaterThan(290);
  });

  it('reports consistent bounds', () => {
    expect(bounds.width).toBeCloseTo(bounds.maxX - bounds.minX);
    expect(bounds.height).toBeCloseTo(bounds.maxY - bounds.minY);
    expect(cheetahDistance(bounds.minX - 1, 0)).toBeGreaterThan(0);
  });

  it('places all spots on the body and none on the face', () => {
    expect(spots.length).toBeGreaterThan(50);
    for (const s of spots) expect(cheetahDistance(s.x, s.y)).toBe(0);
    const onHead = (s) => ((s.x - 398) / 62) ** 2 + ((s.y + 196) / 48) ** 2 < 1;
    expect(spots.some(onHead)).toBe(false);
  });

  it('puts the eye on the head', () => {
    expect(cheetahDistance(face.eye.x, face.eye.y)).toBe(0);
  });
});
