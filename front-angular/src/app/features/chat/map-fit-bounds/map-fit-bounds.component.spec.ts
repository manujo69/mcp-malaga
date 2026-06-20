import { TestBed } from '@angular/core/testing';
import { MapService } from '@maplibre/ngx-maplibre-gl';
import { MapFitBoundsComponent } from './map-fit-bounds.component';
import type { Place } from '../../../domain/place.model';

const mockPlace: Place = {
  id: '1',
  name: 'El Bar',
  address: null,
  tel: null,
  website: null,
  latitude: 36.72,
  longitude: -4.42,
  categories: [],
  markerType: 'bar',
  opening_hours: null,
};

const anotherPlace: Place = {
  ...mockPlace,
  id: '2',
  latitude: 36.73,
  longitude: -4.43,
};

describe('MapFitBoundsComponent', () => {
  let mapService: { mapInstance: unknown; fitBounds: jasmine.Spy };

  beforeEach(async () => {
    mapService = { mapInstance: null, fitBounds: jasmine.createSpy('fitBounds') };

    await TestBed.configureTestingModule({
      imports: [MapFitBoundsComponent],
      providers: [{ provide: MapService, useValue: mapService }],
    }).compileComponents();
  });

  it('should create with empty places', () => {
    const fixture = TestBed.createComponent(MapFitBoundsComponent);
    fixture.componentRef.setInput('places', []);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('does not call fitBounds when places is empty', () => {
    mapService.mapInstance = {};
    const fixture = TestBed.createComponent(MapFitBoundsComponent);
    fixture.componentRef.setInput('places', []);
    fixture.detectChanges();
    expect(mapService.fitBounds).not.toHaveBeenCalled();
  });

  it('does not call fitBounds when mapInstance is null', () => {
    const fixture = TestBed.createComponent(MapFitBoundsComponent);
    fixture.componentRef.setInput('places', [mockPlace]);
    fixture.detectChanges();
    expect(mapService.fitBounds).not.toHaveBeenCalled();
  });

  it('calls fitBounds with correct bounds when map is ready and places are set', () => {
    mapService.mapInstance = {};
    const fixture = TestBed.createComponent(MapFitBoundsComponent);
    fixture.componentRef.setInput('places', [mockPlace, anotherPlace]);
    fixture.detectChanges();

    expect(mapService.fitBounds).toHaveBeenCalledWith(
      [
        [Math.min(-4.42, -4.43), Math.min(36.72, 36.73)],
        [Math.max(-4.42, -4.43), Math.max(36.72, 36.73)],
      ],
      { padding: 80, maxZoom: 16 },
    );
  });

  it('destroys without errors', () => {
    const fixture = TestBed.createComponent(MapFitBoundsComponent);
    fixture.componentRef.setInput('places', []);
    fixture.detectChanges();
    expect(() => fixture.destroy()).not.toThrow();
  });

  it('calls fitBounds again when places input changes', () => {
    mapService.mapInstance = {};
    const fixture = TestBed.createComponent(MapFitBoundsComponent);
    fixture.componentRef.setInput('places', [mockPlace]);
    fixture.detectChanges();
    expect(mapService.fitBounds).toHaveBeenCalledTimes(1);

    fixture.componentRef.setInput('places', [mockPlace, anotherPlace]);
    fixture.detectChanges();
    expect(mapService.fitBounds).toHaveBeenCalledTimes(2);
  });
});
