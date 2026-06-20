import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ChatService } from './chat.service';

describe('ChatService', () => {
  let service: ChatService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ChatService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ChatService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('POSTs to /chat with the prompt and returns response', async () => {
    const promise = service.send('tapas cerca del centro');

    const req = httpMock.expectOne('http://localhost:3000/chat');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ prompt: 'tapas cerca del centro' });
    req.flush({ response: 'Aquí tienes algunos sitios', places: [] });

    const result = await promise;
    expect(result).toEqual({ response: 'Aquí tienes algunos sitios', places: [] });
  });

  it('defaults places to [] when the server omits it', async () => {
    const promise = service.send('algo');
    httpMock.expectOne('http://localhost:3000/chat').flush({ response: 'ok' });

    const result = await promise;
    expect(result.places).toEqual([]);
  });

  it('throws the server error message when response contains an error field', async () => {
    const promise = service.send('algo');
    httpMock.expectOne('http://localhost:3000/chat').flush({ response: '', error: 'Server exploded' });

    await expectAsync(promise).toBeRejectedWithError('Server exploded');
  });

  it('propagates HTTP-level errors (4xx / 5xx)', async () => {
    const promise = service.send('algo');
    httpMock.expectOne('http://localhost:3000/chat').flush('Internal Server Error', {
      status: 500,
      statusText: 'Internal Server Error',
    });

    await expectAsync(promise).toBeRejected();
  });
});
