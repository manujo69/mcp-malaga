import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { ChatComponent } from './chat.component';
import { ChatService } from '../../../core/chat.service';
import type { Place } from '../../../domain/place.model';
import type { ChatResponse } from '../../../domain/chat-response.model';

const mockPlace: Place = {
  id: '1',
  name: 'El Bar',
  address: 'Calle Larios 1',
  tel: null,
  website: null,
  latitude: 36.72,
  longitude: -4.42,
  categories: ['Bar'],
  dist_km: 0.5,
  markerType: 'bar',
  opening_hours: null,
};

describe('ChatComponent', () => {
  let chatServiceSpy: jasmine.SpyObj<ChatService>;

  beforeEach(async () => {
    chatServiceSpy = jasmine.createSpyObj('ChatService', ['send']);

    await TestBed.configureTestingModule({
      imports: [ChatComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [{ provide: ChatService, useValue: chatServiceSpy }],
    })
      .overrideComponent(ChatComponent, { set: { imports: [FormsModule], schemas: [NO_ERRORS_SCHEMA] } })
      .compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(ChatComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('starts in idle status', () => {
    const fixture = TestBed.createComponent(ChatComponent);
    expect(fixture.componentInstance.status()).toBe('idle');
  });

  it('send() does nothing when prompt is blank', async () => {
    const fixture = TestBed.createComponent(ChatComponent);
    const comp = fixture.componentInstance;
    comp.prompt.set('   ');
    await comp.send();
    expect(chatServiceSpy.send).not.toHaveBeenCalled();
    expect(comp.status()).toBe('idle');
  });

  it('send() transitions to loading then success', async () => {
    const response: ChatResponse = { response: 'Aquí tienes.', places: [mockPlace] };
    chatServiceSpy.send.and.returnValue(Promise.resolve(response));

    const fixture = TestBed.createComponent(ChatComponent);
    const comp = fixture.componentInstance;
    comp.prompt.set('tapas');

    const promise = comp.send();
    expect(comp.status()).toBe('loading');
    await promise;

    expect(comp.status()).toBe('success');
    expect(comp.places()).toEqual([mockPlace]);
  });

  it('send() transitions to error on failure', async () => {
    chatServiceSpy.send.and.returnValue(Promise.reject(new Error('Network error')));

    const fixture = TestBed.createComponent(ChatComponent);
    const comp = fixture.componentInstance;
    comp.prompt.set('tapas');
    await comp.send();

    expect(comp.status()).toBe('error');
    expect(comp.error()).toBe('Network error');
  });

  it('send() clears places and selection before the new request', async () => {
    chatServiceSpy.send.and.returnValue(Promise.resolve({ response: 'ok', places: [] }));

    const fixture = TestBed.createComponent(ChatComponent);
    const comp = fixture.componentInstance;
    comp.places.set([mockPlace]);
    comp.selectedPlace.set(mockPlace);
    comp.prompt.set('nueva búsqueda');

    const promise = comp.send();
    expect(comp.places()).toEqual([]);
    expect(comp.selectedPlace()).toBeNull();
    await promise;
  });

  it('summary() returns the last non-empty paragraph', async () => {
    const response: ChatResponse = { response: 'Introducción.\n\nConclusion.', places: [] };
    chatServiceSpy.send.and.returnValue(Promise.resolve(response));

    const fixture = TestBed.createComponent(ChatComponent);
    const comp = fixture.componentInstance;
    comp.prompt.set('test');
    await comp.send();

    expect(comp.summary()).toBe('Conclusion.');
  });

  it('togglePlace() selects a place', () => {
    const fixture = TestBed.createComponent(ChatComponent);
    const comp = fixture.componentInstance;
    comp.togglePlace(mockPlace);
    expect(comp.selectedPlace()).toEqual(mockPlace);
  });

  it('togglePlace() deselects when clicking the same place twice', () => {
    const fixture = TestBed.createComponent(ChatComponent);
    const comp = fixture.componentInstance;
    comp.togglePlace(mockPlace);
    comp.togglePlace(mockPlace);
    expect(comp.selectedPlace()).toBeNull();
  });
});
