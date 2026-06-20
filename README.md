# mcp-malaga

Búsqueda de lugares en Málaga con lenguaje natural. El usuario escribe una pregunta en el chat y el sistema consulta ~27 000 POIs de Foursquare Open Source Places almacenados en Parquet.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | Angular 20, Bootstrap 5, MapLibre GL |
| Backend | Node 22 + TypeScript (sin build step), Express |
| LLM | Claude (Anthropic SDK) con tool use |
| Datos | DuckDB + Parquet (`malaga_places.parquet`) |
| Protocolo | MCP SDK (HTTP, sesiones stateful) |

## Flujo

```
Angular → POST /chat → Claude → tool find_places() → Nominatim → DuckDB → respuesta en texto
```

Claude extrae categoría y ubicación del prompt, geocodifica con Nominatim (OpenStreetMap) y filtra con SQL sobre el Parquet.

## Estructura

```
back-node/   Node/Express + MCP server + lógica de chat
front-angular/   Angular chat + mapa
```

## Arrancar

```bash
# Backend
cd back-node
cp .env.example .env   # añade ANTHROPIC_API_KEY
npm install
npm run dev            # puerto 3000

# Frontend (otra terminal)
cd front-angular
npm install
npm start              # puerto 4200
```

## Variables de entorno (`back-node/.env`)

```
PORT=3000
DATA_PATH=src/data/malaga_places.parquet
CORS_ORIGIN=http://localhost:4200
ANTHROPIC_API_KEY=sk-...
MODEL=claude-sonnet-4-6
```
