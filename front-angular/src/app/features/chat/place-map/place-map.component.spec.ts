import { TestBed } from '@angular/core/testing';
import { PlaceMapComponent } from './place-map.component';

describe('PlaceMapComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlaceMapComponent],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(PlaceMapComponent);
    fixture.componentRef.setInput('places', []);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
