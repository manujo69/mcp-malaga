import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { MapComponent, MarkerComponent, PopupComponent } from '@maplibre/ngx-maplibre-gl';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { Place } from '../../../domain/place.model';
import { MapFitBoundsComponent } from '../map-fit-bounds/map-fit-bounds.component';
import { filterVisiblePlaces, type Bounds } from '../map-visibility/map-visibility';
import { CategoryIconPipe } from '../../../shared/pipes/category-icon/category-icon.pipe';
import { translateHours } from '../utils/translate-hours';

const MARKER_SIZE_PX = 20;
const MAX_VISIBLE_MARKERS = 100;

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/bright';
const MALAGA_CENTER: [number, number] = [-4.4214, 36.7213];

@Component({
  selector: 'app-place-map',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MapComponent, MarkerComponent, PopupComponent, MapFitBoundsComponent, CategoryIconPipe],
  templateUrl: './place-map.component.html',
  styleUrl: './place-map.component.scss',
})
export class PlaceMapComponent {
  readonly places = input.required<Place[]>();
  readonly selectedPlace = input<Place | null>(null);
  readonly hoveredPlace = input<Place | null>(null);
  readonly placeSelected = output<Place | null>();
  readonly visiblePlacesChange = output<Place[]>();

  protected readonly MAP_STYLE = MAP_STYLE;
  protected readonly MALAGA_CENTER = MALAGA_CENTER;
  protected readonly translateHours = translateHours;

  private readonly mapBounds = signal<Bounds | null>(null);
  private readonly mapZoom = signal(13);

  protected readonly visiblePlaces = computed(() => {
    const bounds = this.mapBounds();
    const centerLat = bounds ? (bounds.north + bounds.south) / 2 : MALAGA_CENTER[1];
    return filterVisiblePlaces(this.places(), bounds, this.mapZoom(), centerLat, MARKER_SIZE_PX, MAX_VISIBLE_MARKERS);
  });

  constructor() {
    effect(() => this.visiblePlacesChange.emit(this.visiblePlaces()));
  }

  protected onMapLoad(map: MapLibreMap): void {
    this.updateViewport(map);
  }

  protected onViewportChange(event: { target: MapLibreMap }): void {
    this.updateViewport(event.target);
  }

  private updateViewport(map: MapLibreMap): void {
    const b = map.getBounds();
    this.mapBounds.set({ south: b.getSouth(), north: b.getNorth(), west: b.getWest(), east: b.getEast() });
    this.mapZoom.set(map.getZoom());
  }

  onMarkerClick(event: MouseEvent, place: Place): void {
    event.stopPropagation();
    this.placeSelected.emit(this.selectedPlace()?.id === place.id ? null : place);
  }
}
