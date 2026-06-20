import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import type { ChatResponse } from '../domain/chat-response.model';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly http = inject(HttpClient);

  async send(prompt: string): Promise<ChatResponse> {
    const res = await firstValueFrom(
      this.http.post<ChatResponse & { error?: string }>(`${environment.apiUrl}/chat`, { prompt }),
    );
    if (res.error) throw new Error(res.error);
    return { response: res.response, places: res.places ?? [] };
  }
}
