import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { CATEGORY_MAP, findPlaces } from './tools/findPlaces.ts';

export function createServer(): McpServer {
  const server = new McpServer(
    { name: 'mcp-malaga', version: '0.1.0' },
    { capabilities: { logging: {} } },
  );

  const categoryKeys = Object.keys(CATEGORY_MAP) as [string, ...string[]];

  server.registerTool(
    'find_places',
    {
      title: 'Buscar lugares en Málaga',
      description:
        'Busca establecimientos en Málaga (bares, restaurantes, heladerías, etc.) ' +
        'en el dataset Foursquare Open Source Places. ' +
        'Devuelve nombre, dirección, teléfono, web y coordenadas. ' +
        'NO incluye horarios ni valoraciones. ' +
        'Solo devuelve establecimientos activos (sin fecha de cierre).',
      inputSchema: {
        categoria: z
          .enum(categoryKeys)
          .describe('Tipo de establecimiento: ' + categoryKeys.join(', ')),
        cerca_de: z
          .union([
            z.object({
              lat: z.number().describe('Latitud decimal (ej: 36.7213)'),
              lon: z.number().describe('Longitud decimal (ej: -4.4214)'),
            }),
            z.object({
              address: z
                .string()
                .describe('Nombre de calle o lugar en Málaga. Ej: "Calle Sondalezas, Málaga"'),
            }),
          ])
          .optional()
          .describe('Ubicación para ordenar por distancia'),
        limite: z
          .number()
          .int()
          .min(1)
          .max(50)
          .default(10)
          .describe('Número máximo de resultados (1-50, default 10)'),
        radio_metros: z
          .number()
          .positive()
          .default(2000)
          .describe('Radio de búsqueda en metros alrededor de cerca_de (default 2000). Ej: 100, 500, 1000, 5000'),
      },
    },
    async ({ categoria, cerca_de, limite, radio_metros }) => {
      const places = await findPlaces({ categoria, cerca_de, limite, radio_metros });
      return {
        content: [{ type: 'text', text: JSON.stringify(places, null, 2) }],
      };
    },
  );

  return server;
}
