# Málaga Local MCP

> Servidor MCP (Node.js) que expone datos de hostelería de Málaga y permite preguntar en lenguaje natural. Claude entiende la pregunta, orquesta las tools y redacta la respuesta. Frontend en Angular con mapa interactivo.
>
> *Proyecto de portfolio / demo.*

---

## 1. Qué es

Un asistente conversacional para encontrar establecimientos de hostelería en Málaga capital: restaurantes, bares, tapas, cafeterías, heladerías, panaderías y cocinas de todo tipo. El usuario escribe algo como *"¿dónde tomo unas tapas cerca del Mercado Central?"* y el sistema responde combinando dos fuentes de datos en tiempo real.

La idea central: **el modelo no programa la comprensión del lenguaje; eso lo aporta Claude.** El trabajo de ingeniería es exponer *tools* deterministas bien descritas, y dejar que Claude decida cuáles llamar y cómo redactar el resultado.

## 2. Arquitectura

```
Angular SPA  ──►  POST /chat  ──►  Anthropic API (claude-sonnet-4-6)
 (chat UI +                          │
  mapa MapLibre)          tool_use find_places()
                                     │
                          ┌──────────┴──────────┐
                          │                     │
                    DuckDB + Parquet       Overpass API
                  (Foursquare ~27k POIs)   (OSM en vivo)
                          │                     │
                          └──── merge + dedup ──┘
                                     │
                          respuesta en texto + GeoJSON
```

El backend también expone un servidor MCP HTTP (`/mcp`) que permite usar las mismas tools desde Claude Desktop o Claude Code.

Principios:

- **Claude orquesta; las tools no piensan.** Cada tool hace una cosa y es determinista.
- **Dos fuentes, un resultado.** Foursquare cubre la mayoría de establecimientos; Overpass aporta datos OSM actualizados. Se combinan y se eliminan duplicados por proximidad (< 3 m haversine). OSM tiene prioridad.
- **MCP remoto, no stdio.** El servidor usa transporte Streamable HTTP para ser alcanzable desde la SPA desplegada.

## 3. Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | Angular 20, standalone components, signals, Bootstrap 5, MapLibre GL |
| Servidor | Node 22 + TypeScript (type stripping nativo, sin build step), Express |
| LLM | Anthropic SDK, `claude-sonnet-4-6` |
| Protocolo | `@modelcontextprotocol/sdk` (Streamable HTTP) |
| Datos estáticos | DuckDB + Parquet (`malaga_places.parquet`) |
| Datos en vivo | Overpass API (OpenStreetMap) |
| Geocoding | Nominatim (OpenStreetMap) |

## 4. Fuentes de datos

| Fuente | Uso | Coste | Estado |
|--------|-----|-------|--------|
| Foursquare OS Places (Parquet) | Base de ~27k POIs hostelería Málaga | Gratis (Apache 2.0) | Implementado |
| Overpass API (OSM) | Enriquecimiento y horarios en vivo | Gratis | Implementado |
| Nominatim (OSM) | Geocodificación de direcciones | Gratis | Implementado |

**Decisiones de producto:**
- Solo fuentes gratuitas (Google Places descartado por coste).
- Scraping de RestaurantGuru rechazado: `robots.txt` bloquea bots, derecho *sui generis* de BBDD (Dir. UE 96/9/CE) y fragilidad técnica.
- **Sin valoraciones ni precio:** ninguna fuente libre los da de forma fiable. Claude puede comentar su conocimiento general marcándolo como no-tiempo-real.

## 5. Pipeline de datos de Foursquare OS Places

Foursquare deprecó su bucket S3 público. Acceso actual vía Hugging Face (gated, solo aceptación de términos).

### ETL (una sola vez, en local)

```bash
# 1. Aceptar términos en HF (una vez, logueado):
#    https://huggingface.co/datasets/foursquare/fsq-os-places

# 2. Autenticar
hf auth login   # token de LECTURA

# 3. Descargar la partición (~10 GB)
hf download foursquare/fsq-os-places --repo-type dataset \
  --include "release/dt=2026-06-11/places/parquet/*.parquet" \
  --local-dir ./fsq
```

```sql
-- 4. Filtrar bbox Málaga y generar el slice
COPY (
  SELECT fsq_place_id, name, latitude, longitude,
         address, tel, website, fsq_category_labels,
         date_closed, date_refreshed
  FROM read_parquet('./fsq/release/dt=2026-06-11/places/parquet/*.parquet')
  WHERE latitude  BETWEEN 36.66 AND 36.78
    AND longitude BETWEEN -4.53 AND -4.34
) TO 'malaga_places.parquet' (FORMAT PARQUET);
```

Tras esto, `./fsq` (10 GB) se puede borrar. Solo se commitea `malaga_places.parquet` (pocos MB).

## 6. Modelo de datos del slice

`malaga_places.parquet` — **27.299 POIs** en el bbox de Málaga capital.

| Columna | Tipo | Nota |
|---------|------|------|
| `fsq_place_id` | string | ID estable, prefijo `fsq:` en runtime |
| `name` | string | |
| `latitude` / `longitude` | double | |
| `address`, `tel`, `website` | string | Pueden ser NULL |
| `fsq_category_labels` | string[] | Rutas jerárquicas, ej. `Dining and Drinking > Restaurant > Spanish Restaurant > Tapas Restaurant` |
| `date_closed` | date | NULL = activo |
| `date_refreshed` | date | Frescura del registro |

### Cobertura hostelería (top categorías)

| Categoría | Nº |
|-----------|-----|
| Tapas Restaurant | 561 |
| Spanish Restaurant | 581 |
| Café | 490 |
| Bar | 485 |
| Coffee Shop | 401 |
| Bakery | 300 |
| Ice Cream Parlor | 195 |
| Cocktail Bar | 168 |
| Pub | 160 |

## 7. Tool `find_places`

Consulta DuckDB y Overpass y devuelve resultados combinados.

**Parámetros:**
- `categoria` *(requerido)* — término semántico que Claude mapea al filtro correcto.
- `cerca_de` *(opcional)* — `{ address: string }` (Claude extrae, Node geocodifica) o `{ lat, lon }`.
- `limite` *(opcional, default 200)*.

**Categorías soportadas:**

| Coloquial | Fuente Foursquare | Fuente OSM |
|-----------|-------------------|------------|
| tapas | `…> Tapas Restaurant` | `amenity=restaurant + cuisine~tapas` |
| restaurante_espanol | `…> Spanish Restaurant` | `amenity=restaurant + cuisine~spanish` |
| mariscos | `…> Seafood Restaurant` | `cuisine~seafood` |
| mediterranea | `…> Mediterranean Restaurant` | `cuisine~mediterranean` |
| italiana | `…> Italian Restaurant` | `cuisine~italian` |
| pizza | `…> Pizzeria` | `cuisine~pizza` |
| japonesa | `…> Japanese Restaurant` | `cuisine~japanese\|sushi` |
| china | `…> Chinese Restaurant` | `cuisine~chinese` |
| mexicana | `…> Mexican Restaurant` | `cuisine~mexican` |
| argentina | `…> Argentinian Restaurant` | `cuisine~argentinian` |
| marroqui | `…> Moroccan Restaurant` | `cuisine~moroccan` |
| kebab | `…> Kebab Restaurant` | `cuisine~kebab` |
| turca | (kebab) | `cuisine~turkish` |
| americana | `…> American Restaurant` | `cuisine~american` |
| hamburguesa | `…> Burger Joint` | `cuisine~burger` |
| india | `…> Indian Restaurant` | `cuisine~indian` |
| francesa | `…> French Restaurant` | `cuisine~crepe\|bistro` |
| vegetariana | `…> Vegan and Vegetarian Restaurant` | `diet:vegetarian=only` |
| bar | `…> Bar` | `amenity=bar\|pub` |
| cafe | `…> Café / Coffee Shop` | `amenity=cafe` |
| heladeria | `…> Ice Cream Parlor` | `amenity=ice_cream` |
| panaderia | `…> Bakery` | `shop=bakery` |
| restaurante | `…> Restaurant` (genérico) | `amenity=restaurant` |

**Lógica de merge:**
1. DuckDB filtra el Parquet por categoría y, si hay `cerca_de`, ordena por distancia.
2. Overpass consulta OSM en el bbox de Málaga o en un radio alrededor de `coords`.
3. Se eliminan duplicados: si un POI OSM y uno FSQ están a menos de 3 m, se descarta el FSQ. OSM tiene prioridad (datos más frescos y con `opening_hours`).
4. El resultado combinado se ordena por `dist_km` si hay localización, o por nombre.

## 8. Endpoints del servidor

| Ruta | Método | Descripción |
|------|--------|-------------|
| `/chat` | POST | Proxy Anthropic con bucle agéntico. Body: `{ prompt: string }` |
| `/mcp` | GET / POST / DELETE | Servidor MCP HTTP (sesiones stateful) |
| `/health` | GET | Estado del servidor |

## 9. Estado actual

- [x] Arquitectura y decisiones de producto definidas
- [x] Pipeline de datos Foursquare resuelto y ejecutado
- [x] Slice `malaga_places.parquet` generado (27.299 POIs)
- [x] Servidor MCP Node.js implementado (Express + MCP SDK)
- [x] Tool `find_places` con DuckDB + Overpass + deduplicación
- [x] Geocodificación con Nominatim
- [x] Frontend Angular 20 con chat y mapa MapLibre
- [x] Integración con API de Anthropic (`/chat` agéntico)
- [ ] Capa de horarios OSM integrada en la respuesta de Claude
- [ ] Despliegue en producción
- [ ] Tools adicionales (transporte EMT, meteo, festivos)

## 10. Limitaciones conocidas

- Sin valoraciones ni precio (ninguna fuente libre los da de forma fiable).
- Horarios de Foursquare: no disponibles. OSM los tiene cuando el POI es de origen OSM.
- Frescura de Foursquare: release mensual.
- Overpass puede tardar o fallar bajo carga; el sistema lo gestiona con fallback silencioso a solo FSQ.
- El bbox rectangular incluye algo de mar/puerto (inocuo tras filtrar por categorías de hostelería).

## 11. Licencia y atribución

Datos de **Foursquare Open Source Places**, bajo licencia **Apache 2.0**. Debe conservarse el `NOTICE.txt` de Foursquare al redistribuir el slice. Datos cartográficos y de horarios de **OpenStreetMap** (ODbL).
