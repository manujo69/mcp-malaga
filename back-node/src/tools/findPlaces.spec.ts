import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { haversineM, escapeSql, findPlaces, CATEGORY_MAP } from './findPlaces.ts';
import { getDb } from '../data/db.ts';
import { searchOverpass } from './searchOverpass.ts';

vi.mock('../data/db.ts', () => ({
  getDb: vi.fn(),
  PARQUET_PATH: '/fake/places.parquet',
}));

vi.mock('./searchOverpass.ts', () => ({
  searchOverpass: vi.fn().mockResolvedValue([]),
}));

// ---------------------------------------------------------------------------
// haversineM
// ---------------------------------------------------------------------------

describe('haversineM', () => {
  it('returns 0 for identical coordinates', () => {
    expect(haversineM(36.72, -4.42, 36.72, -4.42)).toBe(0);
  });

  it('returns a positive distance for different coordinates', () => {
    expect(haversineM(36.72, -4.42, 36.73, -4.43)).toBeGreaterThan(0);
  });

  it('is symmetric', () => {
    const d1 = haversineM(36.72, -4.42, 36.73, -4.43);
    const d2 = haversineM(36.73, -4.43, 36.72, -4.42);
    expect(Math.abs(d1 - d2)).toBeLessThan(0.001);
  });

  it('approximates Málaga-Sevilla distance (~157 km)', () => {
    const dist = haversineM(36.72, -4.42, 37.39, -5.98);
    expect(dist).toBeGreaterThan(155_000);
    expect(dist).toBeLessThan(160_000);
  });
});

// ---------------------------------------------------------------------------
// escapeSql
// ---------------------------------------------------------------------------

describe('escapeSql', () => {
  it('escapes single quotes by doubling them', () => {
    expect(escapeSql("L'Orange")).toBe("L''Orange");
  });

  it('escapes multiple single quotes', () => {
    expect(escapeSql("it's o'clock")).toBe("it''s o''clock");
  });

  it('leaves strings without quotes unchanged', () => {
    expect(escapeSql('El Bar Moderno')).toBe('El Bar Moderno');
  });

  it('handles empty string', () => {
    expect(escapeSql('')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// CATEGORY_MAP
// ---------------------------------------------------------------------------

describe('CATEGORY_MAP', () => {
  it('contains tapas with exact mode', () => {
    expect(CATEGORY_MAP['tapas'].mode).toBe('exact');
  });

  it('contains bar with like mode', () => {
    expect(CATEGORY_MAP['bar'].mode).toBe('like');
  });

  it('has restaurante as generic fallback', () => {
    expect(CATEGORY_MAP['restaurante']).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// findPlaces
// ---------------------------------------------------------------------------

function makeMockDb(rows: Record<string, unknown>[] = []) {
  const chunk = { getRowObjects: (_cols: string[]) => rows };
  const result = {
    columnNames: () => [
      'id', 'name', 'address', 'tel', 'website',
      'latitude', 'longitude', 'categories', 'dist_km',
    ],
    chunkCount: rows.length > 0 ? 1 : 0,
    getChunk: (_i: number) => chunk,
  };
  const conn = {
    run: vi.fn().mockResolvedValue(result),
    closeSync: vi.fn(),
  };
  const db = { connect: vi.fn().mockResolvedValue(conn) };
  return { db, conn };
}

const fsqBar = {
  id: 'fsq:1',
  name: 'Bar Central',
  address: 'Calle Mayor 1',
  tel: null,
  website: null,
  latitude: 36.72,
  longitude: -4.42,
  categories: ['Bar'],
  dist_km: 0.1,
};

describe('findPlaces', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(searchOverpass).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws for an unknown categoria', async () => {
    await expect(findPlaces({ categoria: 'unicorn' }))
      .rejects.toThrow('Categoría desconocida: unicorn');
  });

  it('returns places from the DB', async () => {
    const { db } = makeMockDb([fsqBar]);
    vi.mocked(getDb).mockResolvedValue(db as never);

    const result = await findPlaces({ categoria: 'bar' });
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.find(p => p.name === 'Bar Central')).toBeDefined();
  });

  it('returns [] when DB has no rows and OSM returns nothing', async () => {
    const { db } = makeMockDb([]);
    vi.mocked(getDb).mockResolvedValue(db as never);

    const result = await findPlaces({ categoria: 'bar' });
    expect(result).toEqual([]);
  });

  it('always closes the DB connection even on error', async () => {
    const conn = {
      run: vi.fn().mockRejectedValue(new Error('DB failure')),
      closeSync: vi.fn(),
    };
    const db = { connect: vi.fn().mockResolvedValue(conn) };
    vi.mocked(getDb).mockResolvedValue(db as never);

    await expect(findPlaces({ categoria: 'bar' })).rejects.toThrow('DB failure');
    expect(conn.closeSync).toHaveBeenCalledOnce();
  });

  it('sorts combined results by dist_km when coords provided', async () => {
    const { db } = makeMockDb([
      { ...fsqBar, id: 'fsq:far', name: 'Lejos', latitude: 36.73, longitude: -4.43, dist_km: 1.5 },
      { ...fsqBar, id: 'fsq:near', name: 'Cerca', latitude: 36.72, longitude: -4.42, dist_km: 0.1 },
    ]);
    vi.mocked(getDb).mockResolvedValue(db as never);

    const result = await findPlaces({ categoria: 'bar', cerca_de: { lat: 36.72, lon: -4.42 } });
    expect(result[0].name).toBe('Cerca');
  });

  it('deduplicates FSQ places that coincide with OSM places (within 3 m)', async () => {
    const { db } = makeMockDb([fsqBar]);
    vi.mocked(getDb).mockResolvedValue(db as never);

    vi.mocked(searchOverpass).mockResolvedValue([{
      id: 'osm:node:1',
      name: 'Bar Central OSM',
      address: null, tel: null, website: null,
      latitude: 36.72,
      longitude: -4.42,
      categories: ['Bar'],
      markerType: 'bar',
      opening_hours: null,
    }]);

    const result = await findPlaces({ categoria: 'bar' });
    const ids = result.map(p => p.id);
    expect(ids).not.toContain('fsq:1');
    expect(ids).toContain('osm:node:1');
  });

  it('includes both FSQ and OSM places when they are far apart', async () => {
    const { db } = makeMockDb([fsqBar]);
    vi.mocked(getDb).mockResolvedValue(db as never);

    vi.mocked(searchOverpass).mockResolvedValue([{
      id: 'osm:node:99',
      name: 'Bar Lejos',
      address: null, tel: null, website: null,
      latitude: 36.73,
      longitude: -4.43,
      categories: ['Bar'],
      markerType: 'bar',
      opening_hours: null,
    }]);

    const result = await findPlaces({ categoria: 'bar' });
    const ids = result.map(p => p.id);
    expect(ids).toContain('fsq:1');
    expect(ids).toContain('osm:node:99');
  });

  it('continues without OSM results when searchOverpass throws', async () => {
    const { db } = makeMockDb([fsqBar]);
    vi.mocked(getDb).mockResolvedValue(db as never);
    vi.mocked(searchOverpass).mockRejectedValue(new Error('Overpass down'));

    const result = await findPlaces({ categoria: 'bar' });
    expect(result.find(p => p.name === 'Bar Central')).toBeDefined();
  });

  // --- categories field variations ---

  it('handles null categories field in DB row', async () => {
    const { db } = makeMockDb([{ ...fsqBar, categories: null }]);
    vi.mocked(getDb).mockResolvedValue(db as never);

    const result = await findPlaces({ categoria: 'bar' });
    expect(result[0].categories).toEqual([]);
  });

  it('handles categories as object with items array', async () => {
    const { db } = makeMockDb([{ ...fsqBar, categories: { items: ['Bar', 'Pub'] } }]);
    vi.mocked(getDb).mockResolvedValue(db as never);

    const result = await findPlaces({ categoria: 'bar' });
    expect(result[0].categories).toEqual(['Bar', 'Pub']);
  });

  it('handles categories as object with no items property', async () => {
    const { db } = makeMockDb([{ ...fsqBar, categories: {} }]);
    vi.mocked(getDb).mockResolvedValue(db as never);

    const result = await findPlaces({ categoria: 'bar' });
    expect(result[0].categories).toEqual([]);
  });

  it('returns undefined dist_km when DB row has null dist_km', async () => {
    const { db } = makeMockDb([{ ...fsqBar, dist_km: null }]);
    vi.mocked(getDb).mockResolvedValue(db as never);

    const result = await findPlaces({ categoria: 'bar' });
    expect(result[0].dist_km).toBeUndefined();
  });

  // --- geocodeAddress via address-based cerca_de ---

  it('geocodes an address and queries DB with resulting coords', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ lat: '36.72', lon: '-4.42' }]),
    }));
    const { db } = makeMockDb([fsqBar]);
    vi.mocked(getDb).mockResolvedValue(db as never);

    const result = await findPlaces({ categoria: 'bar', cerca_de: { address: 'Calle Larios, Málaga' } });
    expect(result.find(p => p.name === 'Bar Central')).toBeDefined();
  });

  it('throws Nominatim error on HTTP failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    await expect(findPlaces({ categoria: 'bar', cerca_de: { address: 'nowhere' } }))
      .rejects.toThrow('Nominatim error 500');
  });

  it('throws when geocoding returns no results', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    }));

    await expect(findPlaces({ categoria: 'bar', cerca_de: { address: 'dirección inexistente' } }))
      .rejects.toThrow('Sin resultados');
  });
});
