import Anthropic from '@anthropic-ai/sdk';
import express from 'express';
import { findPlaces, CATEGORY_MAP } from '../tools/findPlaces.ts';
import type { FindPlacesArgs, Place } from '../tools/findPlaces.ts';

const router = express.Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.MODEL ?? 'claude-sonnet-4-6';

const SYSTEM_PROMPT = `Eres un asistente local para encontrar lugares en Málaga, España.
Tienes acceso a una base de datos con más de 27.000 lugares: restaurantes, bares, cafés, heladerías, panaderías y más.
Usa siempre la herramienta find_places para responder preguntas sobre dónde ir.
Cuando el usuario no especifique una ubicación, usa el centro de Málaga (lat: 36.7213, lon: -4.4214).
Responde siempre en español.

FORMATO DE RESPUESTA (obligatorio, sin excepciones):
- Una sola frase de cierre: destaca algo útil (zonas, locales con web/teléfono, variedad, etc.).
- NUNCA listes los lugares: la interfaz ya los muestra al usuario con nombre, dirección y distancia.
- NUNCA inventes datos que no estén en los resultados de la herramienta.
- NUNCA uses listas, tablas ni Markdown de formato (negrita, cursiva, etc.).`;

const FIND_PLACES_TOOL: Anthropic.Messages.Tool = {
  name: 'find_places',
  description:
    'Busca lugares en Málaga por categoría. Úsala para responder cualquier pregunta sobre dónde comer, beber o visitar.',
  input_schema: {
    type: 'object',
    properties: {
      categoria: {
        type: 'string',
        enum: Object.keys(CATEGORY_MAP),
        description:
          'Categoría del lugar: tapas, bar, cafe, heladeria, panaderia, restaurante_espanol, restaurante',
      },
      cerca_de: {
        type: 'object',
        description:
          'Ubicación para ordenar resultados por distancia. Usa "address" con el nombre del lugar (siempre incluye "Málaga"), o "lat"/"lon" si ya tienes coordenadas.',
        properties: {
          address: {
            type: 'string',
            description: 'Nombre de calle, barrio o lugar. Ej: "Calle Sondalezas, Málaga"',
          },
          lat: { type: 'number', description: 'Latitud decimal' },
          lon: { type: 'number', description: 'Longitud decimal' },
        },
      },
      limite: {
        type: 'integer',
        minimum: 1,
        maximum: 50,
        description: 'Número máximo de resultados (por defecto 10)',
      },
    },
    required: ['categoria'],
  },
};

router.post('/', async (req, res) => {
  const { prompt } = req.body as { prompt?: string };
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    res.status(400).json({ error: 'El campo prompt es obligatorio' });
    return;
  }

  const messages: Anthropic.Messages.MessageParam[] = [
    { role: 'user', content: prompt.trim() },
  ];
  const allPlaces: Place[] = [];

  try {
    while (true) {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        tools: [FIND_PLACES_TOOL],
        messages,
      });

      if (response.stop_reason === 'end_turn') {
        const text = response.content
          .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('');
        res.json({ response: text, places: allPlaces });
        return;
      }

      if (response.stop_reason === 'tool_use') {
        messages.push({ role: 'assistant', content: response.content });

        const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
        for (const block of response.content) {
          if (block.type === 'tool_use' && block.name === 'find_places') {
            try {
              const places = await findPlaces(block.input as FindPlacesArgs);
              allPlaces.push(...places);
              toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: JSON.stringify(places),
              });
            } catch (err) {
              toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: `Error: ${err instanceof Error ? err.message : String(err)}`,
                is_error: true,
              });
            }
          }
        }
        messages.push({ role: 'user', content: toolResults });
      }
    }
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Error al procesar la consulta' });
  }
});

export default router;
