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
