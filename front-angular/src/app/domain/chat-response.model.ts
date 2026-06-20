import type { Place } from './place.model';

export interface ChatResponse {
  response: string;
  places: Place[];
}
