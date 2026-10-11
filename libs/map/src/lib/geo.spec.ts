import { areaBounds, boxFrom, metresBetween, moveArea, offsetEast, parseCoordinate, readArea, readPoint, writeArea, writePoint } from './geo';

describe('a place as a value', () => {
  it('writes a GeoJSON point, longitude first, to six decimals', () => {
    expect(writePoint({ lat: 30.04441234, lng: 31.23571289 })).toEqual({ type: 'Point', coordinates: [31.235713, 30.044412] });
  });

  it('reads a point, a feature holding one, or nothing', () => {
    expect(readPoint({ type: 'Point', coordinates: [31.2357, 30.0444] })).toEqual({ lat: 30.0444, lng: 31.2357 });
    expect(readPoint({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [2.35, 48.85] } })).toEqual({ lat: 48.85, lng: 2.35 });
    expect(readPoint(null)).toBeNull();
    expect(readPoint('Cairo')).toBeNull();
    // Out of range or not numbers: not a place.
    expect(readPoint({ type: 'Point', coordinates: [31, 95] })).toBeNull();
    expect(readPoint({ type: 'Point', coordinates: ['31', '30'] })).toBeNull();
  });
});

describe('a coordinate typed by a person', () => {
  it('takes a point or a comma as the decimal mark, and Arabic digits', () => {
    expect(parseCoordinate('30.0444')).toBe(30.0444);
    expect(parseCoordinate(' 30,0444 ')).toBe(30.0444);
    expect(parseCoordinate('-0.5')).toBe(-0.5);
    expect(parseCoordinate('٣٠٫٠٤٤٤')).toBe(30.0444);
    expect(parseCoordinate('')).toBeNull();
    expect(parseCoordinate('north')).toBeNull();
    expect(parseCoordinate('30.1.2')).toBeNull();
  });
});

describe('an area as a value', () => {
  const ring = [
    { lat: 30, lng: 31 },
    { lat: 30, lng: 31.1 },
    { lat: 30.1, lng: 31.1 },
    { lat: 30.1, lng: 31 },
  ];

  it('writes a polygon as a GeoJSON feature, its ring closed and counter-clockwise', () => {
    const feature = writeArea({ shape: 'polygon', points: ring });
    expect(feature.properties).toEqual({ shape: 'polygon' });
    expect(feature.geometry).toEqual({
      type: 'Polygon',
      coordinates: [[[31, 30], [31.1, 30], [31.1, 30.1], [31, 30.1], [31, 30]]],
    });
    // Drawn the other way round, it is written the same way round (RFC 7946's right-hand rule).
    const reversed = writeArea({ shape: 'polygon', points: [...ring].reverse() });
    expect(reversed.geometry.coordinates).toEqual([[[31, 30.1], [31, 30], [31.1, 30], [31.1, 30.1], [31, 30.1]]]);
  });

  it('writes a circle as its centre and its radius in metres', () => {
    expect(writeArea({ shape: 'circle', center: { lat: 30.05, lng: 31.24 }, radius: 1234.56 })).toEqual({
      type: 'Feature',
      properties: { shape: 'circle', radius: 1235 },
      geometry: { type: 'Point', coordinates: [31.24, 30.05] },
    });
  });

  it('reads back what it wrote, and a plain polygon from elsewhere', () => {
    expect(readArea(writeArea({ shape: 'box', points: ring }))).toEqual({ shape: 'box', points: ring });
    expect(readArea(writeArea({ shape: 'circle', center: { lat: 30, lng: 31 }, radius: 500 }))).toEqual({ shape: 'circle', center: { lat: 30, lng: 31 }, radius: 500 });
    expect(readArea({ type: 'Polygon', coordinates: [[[31, 30], [31.1, 30], [31.1, 30.1], [31, 30]]] })).toEqual({
      shape: 'polygon',
      points: [{ lat: 30, lng: 31 }, { lat: 30, lng: 31.1 }, { lat: 30.1, lng: 31.1 }],
    });
    expect(readArea(null)).toBeNull();
    expect(readArea({ type: 'Polygon', coordinates: [[[31, 30], [31.1, 30]]] })).toBeNull();
    expect(readArea({ type: 'Feature', properties: { shape: 'circle' }, geometry: { type: 'Point', coordinates: [31, 30] } })).toBeNull();
  });
});

describe('measuring and moving', () => {
  it('measures metres on the ground', () => {
    // One degree of latitude is about 111 km.
    expect(metresBetween({ lat: 30, lng: 31 }, { lat: 31, lng: 31 })).toBeCloseTo(111195, -2);
  });

  it('finds the point a distance due east, and back', () => {
    const east = offsetEast({ lat: 30, lng: 31 }, 1000);
    expect(east.lat).toBe(30);
    expect(metresBetween({ lat: 30, lng: 31 }, east)).toBeCloseTo(1000, 0);
  });

  it('makes a box from two corners, whichever way it was dragged', () => {
    expect(boxFrom({ lat: 30.1, lng: 31.1 }, { lat: 30, lng: 31 })).toEqual([
      { lat: 30, lng: 31 },
      { lat: 30, lng: 31.1 },
      { lat: 30.1, lng: 31.1 },
      { lat: 30.1, lng: 31 },
    ]);
  });

  it('moves a whole area, and knows its bounds', () => {
    const moved = moveArea({ shape: 'circle', center: { lat: 30, lng: 31 }, radius: 100 }, 0.5, -0.5);
    expect(moved).toEqual({ shape: 'circle', center: { lat: 30.5, lng: 30.5 }, radius: 100 });
    expect(areaBounds({ shape: 'polygon', points: [{ lat: 30, lng: 31 }, { lat: 30.2, lng: 31.3 }, { lat: 29.9, lng: 31.1 }] })).toEqual({
      south: 29.9,
      west: 31,
      north: 30.2,
      east: 31.3,
    });
  });
});
