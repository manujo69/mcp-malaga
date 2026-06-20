import { ChangeDetectionStrategy, Component, effect, inject, input } from '@angular/core';
import { MapService } from '@maplibre/ngx-maplibre-gl';
import type { LngLatBoundsLike } from 'maplibre-gl';
import type { Place } from '../../../domain/place.model';

@Component({
  selector: 'app-map-fit-bounds',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './map-fit-bounds.component.html',
  styleUrl: './map-fit-bounds.component.scss',
})
export class MapFitBoundsComponent {
  private readonly mapService = inject(MapService);
  readonly places = input.required<Place[]>();

  constructor() {
    effect(() => {
      const places = this.places();
      if (!places.length) return;

      const lngs = places.map((p) => p.longitude);
      const lats = places.map((p) => p.latitude);
      const bounds: LngLatBoundsLike = [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ];

      if (!this.mapService.mapInstance) return;
      this.mapService.fitBounds(bounds, { padding: 80, maxZoom: 16 });
    });
  }
}
