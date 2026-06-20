import { TestBed } from '@angular/core/testing';
import { MapService } from '@maplibre/ngx-maplibre-gl';
import { MapFitBoundsComponent } from './map-fit-bounds.component';

describe('MapFitBoundsComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MapFitBoundsComponent],
      providers: [{ provide: MapService, useValue: { mapInstance: null, fitBounds: () => {} } }],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(MapFitBoundsComponent);
    fixture.componentRef.setInput('places', []);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
