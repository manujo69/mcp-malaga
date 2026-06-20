import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: mockCreate };
  },
}));

vi.mock('../tools/findPlaces.ts', () => ({
  findPlaces: vi.fn().mockResolvedValue([]),
  CATEGORY_MAP: {
    bar: { mode: 'like' as const, pattern: '%> Bar%' },
    tapas: { mode: 'exact' as const, pattern: 'Tapas Restaurant' },
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function startServer() {
  const { default: chatRouter } = await import('./chat.ts');
  const app = express();
  app.use(express.json());
  app.use('/', chatRouter);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as AddressInfo).port;
  const stop = () => new Promise<void>((resolve) => server.close(() => resolve()));
  return { port, stop };
}

async function post(port: number, body: unknown) {
  const res = await fetch(`http://localhost:${port}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

const endTurnResponse = (text: string) => ({
  stop_reason: 'end_turn',
  content: [{ type: 'text', text }],
});

const toolUseResponse = (categoria: string) => ({
  stop_reason: 'tool_use',
  content: [
    { type: 'text', text: '' },
    { type: 'tool_use', id: 'tu_1', name: 'find_places', input: { categoria } },
  ],
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /chat', () => {
  let port: number;
  let stop: () => Promise<void> = async () => {};

  beforeEach(async () => {
    vi.clearAllMocks();
    ({ port, stop } = await startServer());
  });

  afterEach(async () => {
    await stop();
  });

  it('returns 400 when prompt is missing from body', async () => {
    const { status, body } = await post(port, {});
    expect(status).toBe(400);
    expect(typeof body['error']).toBe('string');
  });

  it('returns 400 when prompt is an empty string', async () => {
    const { status } = await post(port, { prompt: '' });
    expect(status).toBe(400);
  });

  it('returns 400 when prompt is whitespace only', async () => {
    const { status } = await post(port, { prompt: '   ' });
    expect(status).toBe(400);
  });

  it('returns 200 with response text on end_turn', async () => {
    mockCreate.mockResolvedValueOnce(endTurnResponse('Aquí tienes algunos bares.'));

    const { status, body } = await post(port, { prompt: 'bares cerca' });
    expect(status).toBe(200);
    expect(body['response']).toBe('Aquí tienes algunos bares.');
    expect(body['places']).toEqual([]);
  });

  it('concatenates multiple text blocks in end_turn', async () => {
    mockCreate.mockResolvedValueOnce({
      stop_reason: 'end_turn',
      content: [
        { type: 'text', text: 'Primera parte. ' },
        { type: 'text', text: 'Segunda parte.' },
      ],
    });

    const { body } = await post(port, { prompt: 'test' });
    expect(body['response']).toBe('Primera parte. Segunda parte.');
  });

  it('calls findPlaces on tool_use and continues the loop', async () => {
    const { findPlaces } = await import('../tools/findPlaces.ts');
    vi.mocked(findPlaces).mockResolvedValue([{
      id: 'p1', name: 'Bar Pepe', address: null, tel: null, website: null,
      latitude: 36.72, longitude: -4.42, categories: ['Bar'],
      markerType: 'bar', opening_hours: null,
    }]);

    mockCreate
      .mockResolvedValueOnce(toolUseResponse('bar'))
      .mockResolvedValueOnce(endTurnResponse('Encontré un bar.'));

    const { status, body } = await post(port, { prompt: 'bares' });
    expect(status).toBe(200);
    expect(vi.mocked(findPlaces)).toHaveBeenCalledWith({ categoria: 'bar' });
    expect(body['response']).toBe('Encontré un bar.');
    expect((body['places'] as unknown[]).length).toBe(1);
  });

  it('returns an is_error tool result when findPlaces throws', async () => {
    const { findPlaces } = await import('../tools/findPlaces.ts');
    vi.mocked(findPlaces).mockRejectedValue(new Error('DB down'));

    mockCreate
      .mockResolvedValueOnce(toolUseResponse('bar'))
      .mockResolvedValueOnce(endTurnResponse('No pude buscar.'));

    const { status } = await post(port, { prompt: 'bares' });
    expect(status).toBe(200);

    const secondCall = mockCreate.mock.calls[1][0] as { messages: { role: string; content: unknown[] }[] };
    const toolResultMsg = secondCall.messages.at(-1);
    expect(toolResultMsg?.role).toBe('user');
    const toolResult = (toolResultMsg?.content as { is_error?: boolean }[])[0];
    expect(toolResult.is_error).toBe(true);
  });

  it('returns 500 when Anthropic throws', async () => {
    mockCreate.mockRejectedValue(new Error('Network error'));

    const { status } = await post(port, { prompt: 'test' });
    expect(status).toBe(500);
  });
});
