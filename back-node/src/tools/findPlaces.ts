import { getDb, PARQUET_PATH } from '../data/db.ts';
import { searchOverpass } from './searchOverpass.ts';

interface CategoryFilter {
  mode: 'exact' | 'like';
  pattern: string;
}

export const CATEGORY_MAP: Record<string, CategoryFilter> = {
  // Cocina española
  tapas:              { mode: 'exact', pattern: 'Dining and Drinking > Restaurant > Spanish Restaurant > Tapas Restaurant' },
  restaurante_espanol:{ mode: 'like',  pattern: '%> Spanish Restaurant%' },
  mariscos:           { mode: 'exact', pattern: 'Dining and Drinking > Restaurant > Seafood Restaurant' },
  mediterranea:       { mode: 'exact', pattern: 'Dining and Drinking > Restaurant > Mediterranean Restaurant' },

  // Cocinas internacionales
  italiana:           { mode: 'exact', pattern: 'Dining and Drinking > Restaurant > Italian Restaurant' },
  pizza:              { mode: 'exact', pattern: 'Dining and Drinking > Restaurant > Pizzeria' },
  japonesa:           { mode: 'like',  pattern: '%> Japanese Restaurant%' },
  china:              { mode: 'exact', pattern: 'Dining and Drinking > Restaurant > Asian Restaurant > Chinese Restaurant' },
  mexicana:           { mode: 'exact', pattern: 'Dining and Drinking > Restaurant > Mexican Restaurant' },
  argentina:          { mode: 'exact', pattern: 'Dining and Drinking > Restaurant > Latin American Restaurant > South American Restaurant > Argentinian Restaurant' },
  marroqui:           { mode: 'exact', pattern: 'Dining and Drinking > Restaurant > Moroccan Restaurant' },
  kebab:              { mode: 'exact', pattern: 'Dining and Drinking > Restaurant > Kebab Restaurant' },
  turca:              { mode: 'exact', pattern: 'Dining and Drinking > Restaurant > Turkish Restaurant' },
  americana:          { mode: 'exact', pattern: 'Dining and Drinking > Restaurant > American Restaurant' },
  campero:            { mode: 'like',  pattern: '%> Campero%' },
  india:              { mode: 'exact', pattern: 'Dining and Drinking > Restaurant > Indian Restaurant' },
  francesa:           { mode: 'exact', pattern: 'Dining and Drinking > Restaurant > French Restaurant' },

  // Comida rápida y casual
  hamburguesa:        { mode: 'exact', pattern: 'Dining and Drinking > Restaurant > Burger Joint' },
  vegetariana:        { mode: 'exact', pattern: 'Dining and Drinking > Restaurant > Vegan and Vegetarian Restaurant' },

  // Bebidas y otros
  bar:                { mode: 'like',  pattern: '%> Bar%' },
  cafe:               { mode: 'like',  pattern: '%> Caf%' },
  heladeria:          { mode: 'exact', pattern: 'Dining and Drinking > Dessert Shop > Ice Cream Parlor' },
  panaderia:          { mode: 'like',  pattern: '%> Bakery%' },

  // Genérico
  restaurante:        { mode: 'like',  pattern: '%> Restaurant%' },
};

type CercaDe = { lat: number; lon: number } | { address: string };

export interface FindPlacesArgs {
  categoria: string;
  cerca_de?: CercaDe;
  limite?: number;
  radio_metros?: number;
}

async function geocodeAddress(address: string): Promise<{ lat: number; lon: number }> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', address);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('countrycodes', 'es');

  const res = await fetch(url, {
    headers: { 'User-Agent': 'mcp-malaga/0.1 (educational project)' },
  });
  if (!res.ok) throw new Error(`Nominatim error ${res.status}`);

  const data = (await res.json()) as Array<{ lat: string; lon: string }>;
  if (!data.length) throw new Error(`Sin resultados de geocodificación para: ${address}`);

  console.log('[geocode]', address, '→', data[0].lat, data[0].lon);
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
}

export interface Place {
  id: string;
  name: string;
  address: string | null;
  tel: string | null;
  website: string | null;
  latitude: number;
  longitude: number;
  categories: string[];
  dist_km?: number;
  markerType: string;
  opening_hours: string | null;
}

const DEDUP_THRESHOLD_M = 3;

export function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function escapeSql(s: string): string {
  return s.replace(/'/g, "''");
}

export async function findPlaces(args: FindPlacesArgs): Promise<Place[]> {
  const { categoria, cerca_de, limite = 200, radio_metros } = args;
  const filter = CATEGORY_MAP[categoria];
  if (!filter) throw new Error(`Categoría desconocida: ${categoria}`);

  const pattern = escapeSql(filter.pattern);
  const categoryClause =
    filter.mode === 'exact'
      ? `list_contains(fsq_category_labels, '${pattern}')`
      : `len(list_filter(fsq_category_labels, lambda x: x LIKE '${pattern}')) > 0`;

  const parquet = escapeSql(PARQUET_PATH.replace(/\\/g, '/'));

  let coords: { lat: number; lon: number } | undefined;
  if (cerca_de) {
    coords = 'address' in cerca_de ? await geocodeAddress(cerca_de.address) : cerca_de;
  }

  let distanceExpr: string;
  let orderClause: string;
  if (coords) {
    const { lat, lon } = coords;
    distanceExpr = `sqrt(
        power((latitude  - ${lat})  * 111.0, 2) +
        power((longitude - (${lon})) * 111.0 * cos(radians(${lat})), 2)
      )`;
    orderClause = 'ORDER BY dist_km ASC';
  } else {
    distanceExpr = 'NULL';
    orderClause = 'ORDER BY name ASC';
  }

  const effectiveRadiusM = radio_metros ?? 2000;
  const effectiveRadiusKm = effectiveRadiusM / 1000;
  const radioClause = coords ? `AND ${distanceExpr} <= ${effectiveRadiusKm}` : '';

  const sql = `
    SELECT
      fsq_place_id             AS id,
      name,
      address,
      tel,
      website,
      latitude,
      longitude,
      fsq_category_labels      AS categories,
      ${distanceExpr}          AS dist_km
    FROM read_parquet('${parquet}')
    WHERE ${categoryClause}
      AND date_closed IS NULL
      ${radioClause}
    ${orderClause}
    LIMIT ${limite}
  `;

  console.log('[findPlaces] args:', JSON.stringify(args));
  console.log('[findPlaces] sql:', sql.replace(/\s+/g, ' ').trim());

  const db = await getDb();
  const conn = await db.connect();
  let fsqPlaces: Place[] = [];
  try {
    const result = await conn.run(sql);
    const colNames = result.columnNames();

    const rows: Record<string, unknown>[] = [];
    for (let i = 0; i < result.chunkCount; i++) {
      const chunk = result.getChunk(i);
      rows.push(...chunk.getRowObjects(colNames));
    }

    fsqPlaces = rows.map((r) => {
      const rawCats = r['categories'] as { items?: string[] } | string[] | null;
      const categories: string[] =
        rawCats == null
          ? []
          : Array.isArray(rawCats)
            ? rawCats
            : (rawCats.items ?? []);

      return {
        id: String(r['id'] ?? ''),
        name: String(r['name'] ?? ''),
        address: r['address'] != null ? String(r['address']) : null,
        tel: r['tel'] != null ? String(r['tel']) : null,
        website: r['website'] != null ? String(r['website']) : null,
        latitude: Number(r['latitude']),
        longitude: Number(r['longitude']),
        categories,
        dist_km:
          r['dist_km'] != null
            ? Number(Number(r['dist_km']).toFixed(3))
            : undefined,
        markerType: categoria,
        opening_hours: null,
      };
    });
  } finally {
    conn.closeSync();
  }

  const radiusM = effectiveRadiusM;

  let osmPlaces: Place[] = [];
  try {
    osmPlaces = await searchOverpass(categoria, coords, radiusM);
  } catch (err) {
    console.warn('[findPlaces] Overpass no disponible, usando solo FSQ:', err);
  }

  const dedupedFsq = fsqPlaces.filter(
    (fsq) =>
      !osmPlaces.some(
        (osm) =>
          haversineM(fsq.latitude, fsq.longitude, osm.latitude, osm.longitude) <=
          DEDUP_THRESHOLD_M,
      ),
  );

  console.log(
    `[findPlaces] FSQ: ${fsqPlaces.length}, OSM: ${osmPlaces.length}, dedup eliminados: ${fsqPlaces.length - dedupedFsq.length}`,
  );

  const combined = [...osmPlaces, ...dedupedFsq];
  if (coords) {
    combined.sort((a, b) => (a.dist_km ?? Infinity) - (b.dist_km ?? Infinity));
  }
  return combined.slice(0, 200);
}
