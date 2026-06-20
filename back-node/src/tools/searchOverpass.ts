import type { Place } from './findPlaces.ts';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const USER_AGENT = 'mcp-malaga/0.1 (educational project)';
const MALAGA_BBOX = '36.65,-4.55,36.77,-4.35';

const OVERPASS_FILTER: Record<string, string> = {
  tapas:               `["amenity"="restaurant"]["cuisine"~"tapas",i]`,
  restaurante_espanol: `["amenity"="restaurant"]["cuisine"~"spanish|regional|tapas",i]`,
  mariscos:            `["amenity"="restaurant"]["cuisine"~"seafood|fish",i]`,
  mediterranea:        `["amenity"="restaurant"]["cuisine"~"mediterranean",i]`,
  italiana:            `["amenity"="restaurant"]["cuisine"~"italian|italian_pizza|pasta",i]`,
  pizza:               `["amenity"="restaurant"]["cuisine"~"pizza|italian_pizza",i]`,
  japonesa:            `["amenity"="restaurant"]["cuisine"~"japanese|sushi|ramen",i]`,
  china:               `["amenity"="restaurant"]["cuisine"~"chinese|asian",i]`,
  mexicana:            `["amenity"="restaurant"]["cuisine"~"mexican",i]`,
  argentina:           `["amenity"="restaurant"]["cuisine"~"argentinian|steak_house",i]`,
  marroqui:            `["amenity"="restaurant"]["cuisine"~"moroccan|arab",i]`,
  kebab:               `["amenity"="restaurant"]["cuisine"~"kebab|turkish",i]`,
  turca:               `["amenity"="restaurant"]["cuisine"~"kebab|turkish",i]`,
  americana:           `["amenity"="restaurant"]["cuisine"~"american|burger|diner",i]`,
  hamburguesa:         `["amenity"="restaurant"]["cuisine"~"burger",i]`,
  india:               `["amenity"="restaurant"]["cuisine"~"indian|curry",i]`,
  francesa:            `["amenity"="restaurant"]["cuisine"~"crepe|bistro",i]`,
  vegetariana:         `["amenity"="restaurant"]["diet:vegetarian"="only"]`,
  bar:                 `["amenity"~"^(bar|pub)$"]`,
  cafe:                `["amenity"="cafe"]`,
  heladeria:           `["amenity"="ice_cream"]`,
  panaderia:           `["shop"="bakery"]`,
  restaurante:         `["amenity"="restaurant"]`,
};

interface OsmNode {
  type: 'node';
  id: number;
  lat: number;
  lon: number;
  tags: Record<string, string>;
}

interface OsmWay {
  type: 'way';
  id: number;
  center: { lat: number; lon: number };
  tags: Record<string, string>;
}

type OsmElement = OsmNode | OsmWay;

function buildAddress(tags: Record<string, string>): string | null {
  const street = tags['addr:street'] ?? tags['addr:place'];
  const number = tags['addr:housenumber'];
  if (street && number) return `${street} ${number}`;
  return street ?? null;
}

function buildCategories(tags: Record<string, string>): string[] {
  const amenity = tags.amenity ?? '';
  const cuisine = (tags.cuisine ?? '').toLowerCase();
  if (cuisine.includes('tapas') || cuisine.includes('spanish')) return ['Tapas Restaurant'];
  if (amenity === 'bar' || amenity === 'pub') return ['Bar'];
  if (amenity === 'cafe') return ['Café'];
  return ['Restaurant'];
}

function osmToPlace(
  e: OsmElement,
  categoria: string,
  centerLat?: number,
  centerLon?: number,
): Place {
  const tags = e.tags ?? {};
  const lat = e.type === 'node' ? e.lat : e.center.lat;
  const lon = e.type === 'node' ? e.lon : e.center.lon;

  let dist_km: number | undefined;
  if (centerLat !== undefined && centerLon !== undefined) {
    const dLat = (lat - centerLat) * 111.0;
    const dLon = (lon - centerLon) * 111.0 * Math.cos((centerLat * Math.PI) / 180);
    dist_km = Number(Math.sqrt(dLat * dLat + dLon * dLon).toFixed(3));
  }

  return {
    id: `osm:${e.type}:${e.id}`,
    name: tags.name ?? '',
    address: buildAddress(tags),
    tel: tags.phone ?? tags.mobile ?? tags['contact:phone'] ?? null,
    website: tags.website ?? tags['contact:website'] ?? null,
    latitude: lat,
    longitude: lon,
    categories: buildCategories(tags),
    dist_km,
    markerType: categoria,
    opening_hours: tags.opening_hours ?? null,
  };
}

export async function searchOverpass(
  categoria: string,
  coords?: { lat: number; lon: number },
  radiusM = 2000,
): Promise<Place[]> {
  const filter = OVERPASS_FILTER[categoria];
  if (!filter) return [];

  const areaClause = coords
    ? `(around:${radiusM},${coords.lat},${coords.lon})`
    : `(${MALAGA_BBOX})`;

  const query = `[out:json][timeout:15];
(
  node${filter}${areaClause};
  way${filter}${areaClause};
);
out center;`;

  console.log('[searchOverpass] categoria:', categoria, 'area:', areaClause);

  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT,
    },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);

  const data = (await res.json()) as { elements: OsmElement[] };
  const elements = data.elements ?? [];

  console.log(`[searchOverpass] ${elements.length} elementos OSM para "${categoria}"`);

  return elements
    .filter(e => (e.tags?.name ?? '').trim() !== '')
    .map(e => osmToPlace(e, categoria, coords?.lat, coords?.lon));
}
