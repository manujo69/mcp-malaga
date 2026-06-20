# mcp-malaga

Búsqueda de establecimientos de hostelería en Málaga con lenguaje natural: restaurantes, bares, tapas, cafeterías, heladerías y más. El usuario escribe una pregunta en el chat y el sistema combina datos de Foursquare (~27 000 POIs) con resultados en tiempo real de OpenStreetMap.

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
Angular → POST /chat → Claude → tool find_places()
  ├── Nominatim (geocodifica dirección → lat/lon)
  ├── DuckDB  → consulta SQL sobre Foursquare Parquet (~27k POIs)
  └── Overpass API → consulta OSM en tiempo real
       → merge + deduplicación por distancia (< 3 m)
  → Claude genera respuesta en texto → Angular muestra resultados en chat + mapa
```

Claude extrae categoría y ubicación del prompt. El backend lanza en paralelo DuckDB (datos Foursquare) y Overpass (datos OpenStreetMap en vivo), combina ambas fuentes y elimina duplicados por proximidad geográfica.

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
