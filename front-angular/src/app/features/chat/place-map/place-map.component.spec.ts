import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MapService } from '@maplibre/ngx-maplibre-gl';
import { PlaceMapComponent } from './place-map.component';
import { CategoryIconPipe } from '../../../shared/pipes/category-icon/category-icon.pipe';
import type { Place } from '../../../domain/place.model';

const mockPlace: Place = {
  id: '1',
  name: 'El Bar',
  address: 'Calle Larios 1',
  tel: '952000000',
  website: 'http://elbar.com',
  latitude: 36.72,
  longitude: -4.42,
  categories: ['Bar'],
  dist_km: 0.5,
  markerType: 'bar',
  opening_hours: 'Mo-Fr 09:00-21:00',
};

const anotherPlace: Place = { ...mockPlace, id: '2', name: 'Otra Tapería' };

describe('PlaceMapComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlaceMapComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: MapService, useValue: { mapInstance: null, fitBounds: jasmine.createSpy() } },
      ],
    })
      .overrideComponent(PlaceMapComponent, { set: { imports: [CategoryIconPipe], schemas: [NO_ERRORS_SCHEMA] } })
      .compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(PlaceMapComponent);
    fixture.componentRef.setInput('places', []);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('visiblePlaces is empty on init because map bounds are unknown', () => {
    const fixture = TestBed.createComponent(PlaceMapComponent);
    fixture.componentRef.setInput('places', [mockPlace]);
    fixture.detectChanges();
    // mapBounds starts null → filterVisiblePlaces returns []
    expect((fixture.componentInstance as any).visiblePlaces()).toEqual([]);
  });

  it('visiblePlacesChange emits [] on creation when map bounds are unknown', () => {
    const fixture = TestBed.createComponent(PlaceMapComponent);
    const emitted: Place[][] = [];
    fixture.componentInstance.visiblePlacesChange.subscribe((v: Place[]) => emitted.push(v));
    fixture.componentRef.setInput('places', [mockPlace]);
    fixture.detectChanges();
    expect(emitted).toContain(jasmine.arrayWithExactContents([]));
  });

  it('onMarkerClick emits the place when it is not yet selected', () => {
    const fixture = TestBed.createComponent(PlaceMapComponent);
    fixture.componentRef.setInput('places', [mockPlace]);
    fixture.componentRef.setInput('selectedPlace', null);
    fixture.detectChanges();

    const emitted: (Place | null)[] = [];
    fixture.componentInstance.placeSelected.subscribe((p: Place | null) => emitted.push(p));

    fixture.componentInstance.onMarkerClick(new MouseEvent('click'), mockPlace);
    expect(emitted).toEqual([mockPlace]);
  });

  it('onMarkerClick emits null to deselect the already-selected place', () => {
    const fixture = TestBed.createComponent(PlaceMapComponent);
    fixture.componentRef.setInput('places', [mockPlace]);
    fixture.componentRef.setInput('selectedPlace', mockPlace);
    fixture.detectChanges();

    const emitted: (Place | null)[] = [];
    fixture.componentInstance.placeSelected.subscribe((p: Place | null) => emitted.push(p));

    fixture.componentInstance.onMarkerClick(new MouseEvent('click'), mockPlace);
    expect(emitted).toEqual([null]);
  });

  it('onMarkerClick selects a different place when one is already selected', () => {
    const fixture = TestBed.createComponent(PlaceMapComponent);
    fixture.componentRef.setInput('places', [mockPlace, anotherPlace]);
    fixture.componentRef.setInput('selectedPlace', mockPlace);
    fixture.detectChanges();

    const emitted: (Place | null)[] = [];
    fixture.componentInstance.placeSelected.subscribe((p: Place | null) => emitted.push(p));

    fixture.componentInstance.onMarkerClick(new MouseEvent('click'), anotherPlace);
    expect(emitted).toEqual([anotherPlace]);
  });
});
