import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChatService } from '../../../core/chat.service';
import type { Place } from '../../../domain/place.model';
import { PlaceMapComponent } from '../place-map/place-map.component';

@Component({
  selector: 'app-chat',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, PlaceMapComponent],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss',
})
export class ChatComponent {
  private readonly chat = inject(ChatService);

  readonly prompt = signal('');
  readonly status = signal<'idle' | 'loading' | 'success' | 'error'>('idle');
  readonly response = signal('');
  readonly places = signal<Place[]>([]);
  readonly error = signal('');

  readonly selectedPlace = signal<Place | null>(null);
  readonly hoveredPlace = signal<Place | null>(null);
  readonly visiblePlaces = signal<Place[]>([]);
  readonly summary = computed(() =>
    this.response()
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter(Boolean)
      .at(-1) ?? '',
  );

  async send(): Promise<void> {
    if (!this.prompt().trim()) return;
    this.status.set('loading');
    this.places.set([]);
    this.selectedPlace.set(null);
    try {
      const result = await this.chat.send(this.prompt());
      this.response.set(result.response);
      this.places.set(result.places);
      this.status.set('success');
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Error desconocido');
      this.status.set('error');
    }
  }

  togglePlace(place: Place): void {
    this.selectedPlace.set(this.selectedPlace()?.id === place.id ? null : place);
  }
}
