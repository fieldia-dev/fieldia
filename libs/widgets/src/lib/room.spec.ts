import { roomFor } from './room';

/**
 * Where a popup opened from a box goes (room.ts): under it where it fits there; over it where it does not and there is
 * more room over it; never taller than the room on its side, 8px from the window's edge.
 */
describe('a popup opened from a box', () => {
  const VIEW = 800;
  it('opens under its box where it fits there, as it is', () => {
    expect(roomFor({ top: 100, bottom: 130 }, 300, 4, VIEW)).toEqual({ up: false, most: null });
  });

  it('opens over its box near the window’s foot, where there is more room over it', () => {
    expect(roomFor({ top: 700, bottom: 730 }, 300, 4, VIEW)).toEqual({ up: true, most: null });
  });

  it('stays under where there is more room under, though it does not fit: kept to that room, scrolling within', () => {
    // 800 - 330 - 4 - 8 = 458 under, 300 - 4 - 8 = 288 over.
    expect(roomFor({ top: 300, bottom: 330 }, 600, 4, VIEW)).toEqual({ up: false, most: 458 });
  });

  it('over its box, no taller than the room there; never shrunk past a few rows', () => {
    expect(roomFor({ top: 500, bottom: 530 }, 700, 4, VIEW)).toEqual({ up: true, most: 488 });
    expect(roomFor({ top: 40, bottom: 770 }, 300, 4, VIEW)).toEqual({ up: true, most: 96 });
  });
});
