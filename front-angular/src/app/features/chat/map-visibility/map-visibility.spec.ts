import { filterVisiblePlaces, metersPerPixel } from './map-visibility';
import type { Place } from '../../../domain/place.model';

function place(id: string, lat: number, lon: number, dist_km = 0): Place {
  return {
    id, name: id, address: null, tel: null, website: null,
    latitude: lat, longitude: lon,
    categories: [], dist_km, markerType: '', opening_hours: null,
  };
}

const BOUNDS = { south: 36.69, north: 36.75, west: -4.45, east: -4.39 };
const CENTER_LAT = 36.72;
const ZOOM = 13;
const PX = 40;

describe('metersPerPixel', () => {
  it('returns ~156543 at zoom 0, equator', () => {
    expect(metersPerPixel(0, 0)).toBeCloseTo(156543, -2);
  });

  it('halves with each zoom step', () => {
    expect(metersPerPixel(0, 0) / metersPerPixel(1, 0)).toBeCloseTo(2, 5);
  });

  it('decreases with latitude (Mercator)', () => {
    const equator = metersPerPixel(13, 0);
    const malaga  = metersPerPixel(13, 36.7);
    expect(malaga).toBeLessThan(equator);
    expect(malaga).toBeCloseTo(equator * Math.cos((36.7 * Math.PI) / 180), 4);
  });
});

describe('filterVisiblePlaces', () => {
  describe('basic cases', () => {
    it('returns [] when bounds is null', () => {
      expect(filterVisiblePlaces([place('a', 36.72, -4.42)], null, ZOOM, CENTER_LAT, PX, 100))
        .toEqual([]);
    });

    it('returns [] for empty input', () => {
      expect(filterVisiblePlaces([], BOUNDS, ZOOM, CENTER_LAT, PX, 100)).toEqual([]);
    });

    it('returns a place that is inside bounds', () => {
      const p = place('a', 36.72, -4.42, 0.1);
      expect(filterVisiblePlaces([p], BOUNDS, ZOOM, CENTER_LAT, PX, 100)).toEqual([p]);
    });

    it('excludes a place outside bounds', () => {
      const inside  = place('a', 36.72, -4.42, 0.1);
      const outside = place('b', 40.41, -3.70, 0.2); // Madrid
      const result = filterVisiblePlaces([inside, outside], BOUNDS, ZOOM, CENTER_LAT, PX, 100);
      expect(result).toEqual([inside]);
    });
  });

  describe('proximity filtering', () => {
    it('shows both places when far apart (>2 km)', () => {
      const a = place('a', 36.71, -4.42, 0.1);
      const b = place('b', 36.73, -4.42, 2.0); // ~2.2 km north
      const result = filterVisiblePlaces([a, b], BOUNDS, ZOOM, CENTER_LAT, PX, 100);
      expect(result.length).toBe(2);
    });

    it('hides second place when at the same position', () => {
      const a = place('a', 36.720, -4.420, 0.1);
      const b = place('b', 36.720, -4.420, 0.2);
      const result = filterVisiblePlaces([a, b], BOUNDS, ZOOM, CENTER_LAT, PX, 100);
      expect(result.length).toBe(1);
    });

    it('keeps the place with lower dist_km when two are too close', () => {
      // 11 m apart — well within any threshold
      const farther = place('farther', 36.7200, -4.4200, 0.5);
      const closer  = place('closer',  36.7201, -4.4200, 0.1);
      const result = filterVisiblePlaces([farther, closer], BOUNDS, ZOOM, CENTER_LAT, PX, 100);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('closer');
    });

    it('does not suppress a third place when it is far from all selected', () => {
      // a and b are close → only a survives; c is far from a → c also visible
      const a = place('a', 36.710, -4.42, 0.1); // south
      const b = place('b', 36.710, -4.42, 0.2); // same spot as a
      const c = place('c', 36.730, -4.42, 1.0); // ~2.2 km north of a
      const result = filterVisiblePlaces([a, b, c], BOUNDS, ZOOM, CENTER_LAT, PX, 100);
      expect(result.map(p => p.id)).toEqual(['a', 'c']);
    });
  });

  describe('zoom sensitivity', () => {
    it('shows more places at high zoom than at low zoom', () => {
      // 55 m apart — below threshold at zoom 11, above threshold at zoom 17
      const a = place('a', 36.720, -4.420, 0.1);
      const b = place('b', 36.7205, -4.420, 0.5); // ~55 m north

      const atLowZoom  = filterVisiblePlaces([a, b], BOUNDS, 11, CENTER_LAT, PX, 100);
      const atHighZoom = filterVisiblePlaces([a, b], BOUNDS, 17, CENTER_LAT, PX, 100);

      expect(atLowZoom.length).toBeLessThan(atHighZoom.length);
    });
  });

  describe('maxVisible cap', () => {
    it('never returns more than maxVisible places', () => {
      // 50 places spread 111 m apart (0.001° lat), all inside bounds
      const places = Array.from({ length: 50 }, (_, i) =>
        place(`p${i}`, 36.695 + i * 0.001, -4.42, i * 0.1),
      );
      const result = filterVisiblePlaces(places, BOUNDS, ZOOM, CENTER_LAT, PX, 5);
      expect(result.length).toBeLessThanOrEqual(5);
    });
  });
});
