import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  buildAddress,
  buildCategories,
  osmToPlace,
  searchOverpass,
} from './searchOverpass.ts';
import type { OsmNode, OsmWay } from './searchOverpass.ts';

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// buildAddress
// ---------------------------------------------------------------------------

describe('buildAddress', () => {
  it('returns "Street Number" when both tags are present', () => {
    expect(buildAddress({ 'addr:street': 'Calle Larios', 'addr:housenumber': '5' }))
      .toBe('Calle Larios 5');
  });

  it('returns street only when housenumber is absent', () => {
    expect(buildAddress({ 'addr:street': 'Calle Larios' })).toBe('Calle Larios');
  });

  it('falls back to addr:place when addr:street is absent', () => {
    expect(buildAddress({ 'addr:place': 'Mercado Central', 'addr:housenumber': '1' }))
      .toBe('Mercado Central 1');
  });

  it('returns null when no address tags exist', () => {
    expect(buildAddress({})).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// buildCategories
// ---------------------------------------------------------------------------

describe('buildCategories', () => {
  it('returns Tapas Restaurant for tapas cuisine (case-insensitive)', () => {
    expect(buildCategories({ amenity: 'restaurant', cuisine: 'TAPAS' }))
      .toEqual(['Tapas Restaurant']);
  });

  it('returns Tapas Restaurant for spanish cuisine', () => {
    expect(buildCategories({ amenity: 'restaurant', cuisine: 'spanish' }))
      .toEqual(['Tapas Restaurant']);
  });

  it('returns Bar for amenity=bar', () => {
    expect(buildCategories({ amenity: 'bar' })).toEqual(['Bar']);
  });

  it('returns Bar for amenity=pub', () => {
    expect(buildCategories({ amenity: 'pub' })).toEqual(['Bar']);
  });

  it('returns Café for amenity=cafe', () => {
    expect(buildCategories({ amenity: 'cafe' })).toEqual(['Café']);
  });

  it('returns Restaurant as default fallback', () => {
    expect(buildCategories({ amenity: 'restaurant', cuisine: 'italian' }))
      .toEqual(['Restaurant']);
  });
});

// ---------------------------------------------------------------------------
// osmToPlace
// ---------------------------------------------------------------------------

const baseNode: OsmNode = {
  type: 'node',
  id: 42,
  lat: 36.72,
  lon: -4.42,
  tags: {
    name: 'El Bar',
    'addr:street': 'Calle Larios',
    'addr:housenumber': '1',
    phone: '952000000',
    website: 'http://elbar.com',
    opening_hours: 'Mo-Fr 09:00-21:00',
    amenity: 'bar',
  },
};

describe('osmToPlace', () => {
  it('maps a node element with all fields', () => {
    expect(osmToPlace(baseNode, 'bar')).toMatchObject({
      id: 'osm:node:42',
      name: 'El Bar',
      latitude: 36.72,
      longitude: -4.42,
      address: 'Calle Larios 1',
      tel: '952000000',
      website: 'http://elbar.com',
      opening_hours: 'Mo-Fr 09:00-21:00',
      markerType: 'bar',
      categories: ['Bar'],
    });
  });

  it('dist_km is undefined when no center coords are provided', () => {
    expect(osmToPlace(baseNode, 'bar').dist_km).toBeUndefined();
  });

  it('dist_km is 0 when place coincides with center', () => {
    expect(osmToPlace(baseNode, 'bar', 36.72, -4.42).dist_km).toBe(0);
  });

  it('dist_km is > 0 for a different center', () => {
    expect(osmToPlace(baseNode, 'bar', 36.73, -4.43).dist_km).toBeGreaterThan(0);
  });

  it('maps a way element using its center coordinates', () => {
    const way: OsmWay = {
      type: 'way',
      id: 99,
      center: { lat: 36.73, lon: -4.43 },
      tags: { name: 'La Plaza', amenity: 'restaurant' },
    };
    const place = osmToPlace(way, 'restaurante');
    expect(place.id).toBe('osm:way:99');
    expect(place.latitude).toBe(36.73);
    expect(place.longitude).toBe(-4.43);
  });

  it('uses mobile as tel when phone is absent', () => {
    const node: OsmNode = {
      ...baseNode,
      tags: { name: 'Cafetería', amenity: 'cafe', mobile: '600000000' },
    };
    expect(osmToPlace(node, 'cafe').tel).toBe('600000000');
  });

  it('uses contact:phone as tel fallback', () => {
    const node: OsmNode = {
      ...baseNode,
      tags: { name: 'Bar', amenity: 'bar', 'contact:phone': '951000000' },
    };
    expect(osmToPlace(node, 'bar').tel).toBe('951000000');
  });

  it('returns null tel when no phone tags exist', () => {
    const node: OsmNode = { ...baseNode, tags: { name: 'Sin Tel', amenity: 'bar' } };
    expect(osmToPlace(node, 'bar').tel).toBeNull();
  });

  it('returns null opening_hours when tag is absent', () => {
    const node: OsmNode = { ...baseNode, tags: { name: 'X', amenity: 'bar' } };
    expect(osmToPlace(node, 'bar').opening_hours).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// searchOverpass
// ---------------------------------------------------------------------------

describe('searchOverpass', () => {
  it('returns [] for an unknown categoria', async () => {
    expect(await searchOverpass('unicorn')).toEqual([]);
  });

  it('filters out elements with empty name and maps the rest', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        elements: [
          { type: 'node', id: 1, lat: 36.72, lon: -4.42, tags: { name: 'Tasca El Tío', amenity: 'bar' } },
          { type: 'node', id: 2, lat: 36.73, lon: -4.43, tags: { name: '   ', amenity: 'bar' } },
        ],
      }),
    }));

    const result = await searchOverpass('bar');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Tasca El Tío');
  });

  it('calculates dist_km relative to provided coords', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        elements: [{ type: 'node', id: 3, lat: 36.72, lon: -4.42, tags: { name: 'Cerca', amenity: 'cafe' } }],
      }),
    }));

    const result = await searchOverpass('cafe', { lat: 36.72, lon: -4.42 });
    expect(result[0].dist_km).toBe(0);
  });

  it('throws when Overpass returns a non-ok HTTP status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429 }));
    await expect(searchOverpass('bar')).rejects.toThrow('Overpass HTTP 429');
  });

  it('returns [] when elements array is empty', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ elements: [] }),
    }));
    expect(await searchOverpass('bar')).toEqual([]);
  });

  it('uses BBOX area clause when no coords are provided', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ elements: [] }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await searchOverpass('cafe');

    const body: string = mockFetch.mock.calls[0][1].body;
    expect(decodeURIComponent(body)).toContain('36.65,-4.55,36.77,-4.35');
  });

  it('uses around clause when coords are provided', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ elements: [] }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await searchOverpass('cafe', { lat: 36.72, lon: -4.42 }, 500);

    const body: string = mockFetch.mock.calls[0][1].body;
    expect(decodeURIComponent(body)).toContain('around:500,36.72,-4.42');
  });
});
