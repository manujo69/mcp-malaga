import type { Place } from '../../../domain/place.model';

export interface Bounds {
  south: number;
  north: number;
  west: number;
  east: number;
}

export function metersPerPixel(zoom: number, lat: number): number {
  return (156543.03 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);
}

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function inBounds(place: Place, bounds: Bounds): boolean {
  return (
    place.latitude >= bounds.south &&
    place.latitude <= bounds.north &&
    place.longitude >= bounds.west &&
    place.longitude <= bounds.east
  );
}

export function filterVisiblePlaces(
  places: Place[],
  bounds: Bounds | null,
  zoom: number,
  centerLat: number,
  markerSizePx: number,
  maxVisible: number,
): Place[] {
  if (!bounds || places.length === 0) return [];

  const thresholdM = markerSizePx * metersPerPixel(zoom, centerLat);

  const sorted = places
    .filter(p => inBounds(p, bounds))
    .sort((a, b) => (a.dist_km ?? Infinity) - (b.dist_km ?? Infinity));

  const visible: Place[] = [];
  for (const candidate of sorted) {
    if (visible.length >= maxVisible) break;
    const tooClose = visible.some(
      v => haversineM(v.latitude, v.longitude, candidate.latitude, candidate.longitude) < thresholdM,
    );
    if (!tooClose) visible.push(candidate);
  }

  return visible;
}
