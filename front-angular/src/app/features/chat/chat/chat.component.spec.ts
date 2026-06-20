import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
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
  let fixture: ComponentFixture<ChatComponent>;
  let comp: ChatComponent;
  let chatService: jasmine.SpyObj<ChatService>;

  beforeEach(async () => {
    const chatServiceSpy = jasmine.createSpyObj('ChatService', ['send']);

    await TestBed.configureTestingModule({
      imports: [ChatComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [{ provide: ChatService, useValue: chatServiceSpy }],
    })
      .overrideComponent(ChatComponent, { set: { imports: [FormsModule], schemas: [NO_ERRORS_SCHEMA] } })
      .compileComponents();

    chatService = TestBed.inject(ChatService) as jasmine.SpyObj<ChatService>;
    fixture = TestBed.createComponent(ChatComponent);
    comp = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(comp).toBeTruthy();
  });

  it('starts in idle status', () => {
    expect(comp.status()).toBe('idle');
  });

  // --- send() ---

  it('send() does nothing when prompt is blank', async () => {
    comp.prompt.set('   ');
    await comp.send();
    expect(chatService.send).not.toHaveBeenCalled();
    expect(comp.status()).toBe('idle');
  });

  it('send() calls the service with the exact prompt text', async () => {
    chatService.send.and.returnValue(Promise.resolve({ response: 'ok', places: [] }));
    comp.prompt.set('tapas cerca del centro');
    await comp.send();
    expect(chatService.send).toHaveBeenCalledWith('tapas cerca del centro');
  });

  it('send() transitions to loading then success', async () => {
    const response: ChatResponse = { response: 'Aquí tienes.', places: [mockPlace] };
    chatService.send.and.returnValue(Promise.resolve(response));
    comp.prompt.set('tapas');

    const promise = comp.send();
    expect(comp.status()).toBe('loading');
    await promise;

    expect(comp.status()).toBe('success');
    expect(comp.places()).toEqual([mockPlace]);
  });

  it('send() transitions to error on failure', async () => {
    chatService.send.and.returnValue(Promise.reject(new Error('Network error')));
    comp.prompt.set('tapas');
    await comp.send();

    expect(comp.status()).toBe('error');
    expect(comp.error()).toBe('Network error');
  });

  it('send() clears places and selection before the new request', async () => {
    chatService.send.and.returnValue(Promise.resolve({ response: 'ok', places: [] }));
    comp.places.set([mockPlace]);
    comp.selectedPlace.set(mockPlace);
    comp.prompt.set('nueva búsqueda');

    const promise = comp.send();
    expect(comp.places()).toEqual([]);
    expect(comp.selectedPlace()).toBeNull();
    await promise;
  });

  // --- computed: summary ---

  it('summary() returns the last non-empty paragraph', async () => {
    chatService.send.and.returnValue(
      Promise.resolve({ response: 'Introducción.\n\nConclusion.', places: [] }),
    );
    comp.prompt.set('test');
    await comp.send();

    expect(comp.summary()).toBe('Conclusion.');
  });

  // --- togglePlace ---

  it('togglePlace() selects a place', () => {
    comp.togglePlace(mockPlace);
    expect(comp.selectedPlace()).toEqual(mockPlace);
  });

  it('togglePlace() deselects when clicking the same place twice', () => {
    comp.togglePlace(mockPlace);
    comp.togglePlace(mockPlace);
    expect(comp.selectedPlace()).toBeNull();
  });

  // --- template: conditional blocks ---

  it('shows error alert when status is error', () => {
    comp.status.set('error');
    comp.error.set('Algo salió mal');
    fixture.detectChanges();

    const alert: HTMLElement = fixture.nativeElement.querySelector('.alert-danger');
    expect(alert).toBeTruthy();
    expect(alert.textContent?.trim()).toBe('Algo salió mal');
  });

  it('hides error alert when status is idle', () => {
    comp.status.set('idle');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.alert-danger')).toBeNull();
  });

  it('shows response card when status is success', () => {
    comp.status.set('success');
    comp.response.set('Para tapas:\n\nEl Bar.');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.response-card')).toBeTruthy();
  });

  it('shows places list when there are visible places', () => {
    comp.status.set('success');
    comp.places.set([mockPlace]);
    comp.visiblePlaces.set([mockPlace]);
    fixture.detectChanges();

    const items = fixture.nativeElement.querySelectorAll('.place-item');
    expect(items.length).toBe(1);
    expect(items[0].textContent).toContain('El Bar');
  });

  it('hides places list when visible places is empty', () => {
    comp.status.set('success');
    comp.places.set([]);
    comp.visiblePlaces.set([]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.places-list')).toBeNull();
  });

  // --- edge case ---

  it('destroys without errors', () => {
    expect(() => fixture.destroy()).not.toThrow();
  });
});
