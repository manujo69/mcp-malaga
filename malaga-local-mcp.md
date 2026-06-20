# Málaga Local MCP

> Servidor MCP (Node.js) que envuelve APIs de la vida local de Málaga y permite preguntar en lenguaje natural. Claude entiende la pregunta, orquesta las tools y redacta la respuesta. Frontend en Angular.
>
> *Nombre provisional. Proyecto de portfolio / demo.*

---

## 1. Qué es

Un asistente conversacional sobre Málaga capital. El usuario pregunta cosas como *"¿me da tiempo a ir al Museo Picasso y encontrarlo abierto si salgo ahora?"* o *"¿dónde tomo unas tapas baratas cerca esta tarde?"*, y el sistema responde combinando datos de transporte, lugares, horarios y contexto.

La idea central: **el modelo no programa la comprensión del lenguaje; eso lo aporta Claude.** El trabajo de ingeniería es exponer un conjunto de *tools* deterministas bien descritas, y dejar que Claude decida cuáles llamar, en qué orden, y cómo redactar el resultado.

## 2. Arquitectura y principios

```
Angular SPA  ──►  API de Anthropic  ──►  Servidor MCP (Node.js)  ──►  APIs / datos de Málaga
 (geo + hora)      (orquesta tools)        (tools deterministas)
```

Principios acordados:

- **Claude orquesta; las tools no piensan.** Cada tool hace una cosa y es determinista. No se le pide al LLM calcular rutas ni contar registros.
- **Angular aporta contexto único:** geolocalización del navegador (Geolocation API) y hora actual. Eso resuelve el *"desde casa / ahora mismo"* que un cliente MCP de escritorio no tiene fácil.
- **MCP remoto, no stdio.** Para que la SPA desplegada use las tools, el servidor MCP debe ser alcanzable por HTTPS (transporte Streamable HTTP), no el stdio de escritorio.
- **Composición > consulta simple.** El valor aparece cuando una pregunta encadena varias tools (ver §9). Las consultas de un solo dato ya las hace una SPA normal.

## 3. Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | Angular |
| Servidor MCP | Node.js + `@modelcontextprotocol/sdk` (TypeScript) |
| ETL de datos | DuckDB (lectura de Parquet + filtrado) |
| Store en runtime | SQLite / en memoria (slice pequeño) |
| Orquestación LLM | API de Anthropic |

## 4. Fuentes de datos y pool de APIs

| Capacidad | Fuente | Tipo | Coste | Estado |
|-----------|--------|------|-------|--------|
| Hora actual | `get_current_time` (Node) | Local | — | Trivial |
| Festivos | Nager.Date | API en vivo | Gratis | Pendiente |
| Geocoding | Nominatim (OSM) | API en vivo | Gratis | Pendiente |
| Transporte EMT | API pública EMT Málaga (tiempo real) | API en vivo | Gratis | Pendiente |
| Cálculo de rutas | OpenTripPlanner + GTFS Málaga (vía Transitland) | Self-hosted | Gratis | Fase 2 |
| Sitios (bares, heladerías…) | Foursquare OS Places | Dataset estático → store local | Gratis | **Datos listos** |
| Horarios de locales | OSM / Overpass | API en vivo | Gratis | Pendiente |
| Meteo | Open-Meteo / AEMET | API en vivo | Gratis | Fase 2 |
| Datos abiertos Málaga | Tráfico, parking, agenda | API/ficheros | Gratis | Opcional |

**Decisiones de producto:**
- Solo fuentes gratuitas (Google Places descartado por coste).
- Scraping de RestaurantGuru rechazado: `robots.txt` bloquea bots, es re-agregador de Google, derecho *sui generis* de bases de datos (UE, Dir. 96/9/CE) y fragilidad técnica.

**Hueco asumido conscientemente:** ninguna fuente libre da *valoraciones* ni *precio* fiables, y Foursquare **no trae horarios**. Los horarios se resuelven con OSM/Overpass; el matiz cualitativo lo aporta Claude desde su conocimiento (marcado como no-tiempo-real, sin inventar precios).

## 5. Pipeline de datos de Foursquare OS Places

Foursquare deprecó su bucket S3 público. Acceso actual: Places Portal (token), Snowflake o Hugging Face (gated). El *gating* de HF es solo un checkbox de aceptación de términos (datos de contacto), no una cola de aprobación. El dato sigue siendo gratuito bajo **Apache 2.0** con atribución.

### ETL (una sola vez, en local)

```bash
# 1. Aceptar términos en la web del dataset (logueado), una vez:
#    https://huggingface.co/datasets/foursquare/fsq-os-places  →  "I agree"

# 2. Autenticar el CLI
hf auth login                      # token de LECTURA
hf auth whoami

# 3. Descargar la partición vigente (~10 GB; "216 GB" es la suma de todas)
hf download foursquare/fsq-os-places --repo-type dataset \
  --include "release/dt=2026-06-11/places/parquet/*.parquet" \
  --local-dir ./fsq
```

```sql
-- 4. Filtrar al bounding box de Málaga y generar el slice (DuckDB)
COPY (
  SELECT fsq_place_id, name, latitude, longitude,
         address, tel, website, fsq_category_labels,
         date_closed, date_refreshed
  FROM read_parquet('./fsq/release/dt=2026-06-11/places/parquet/*.parquet')
  WHERE latitude  BETWEEN 36.66 AND 36.78
    AND longitude BETWEEN -4.53 AND -4.34
) TO 'malaga_places.parquet' (FORMAT PARQUET);
```

Tras esto, `./fsq` (los 10 GB) se puede borrar; solo se commitea `malaga_places.parquet` (unos MB). El runtime nunca vuelve a tocar Hugging Face.

> **Notas:** el bbox de Málaga incluye una franja inofensiva de mar/puerto al sur; el filtro por categoría la descarta. DuckDB (columnar, lee Parquet nativo) hace el ETL; SQLite/memoria sirve en runtime. Lectura remota `hf://` posible con *secret* de HF, pero la descarga local resultó más robusta que pelear con LFS/Xet.

## 6. Modelo de datos del slice

`malaga_places.parquet` — **27.299 POIs** en el bbox de Málaga capital.

| Columna | Tipo | Nota |
|---------|------|------|
| `fsq_place_id` | string | ID estable |
| `name` | string | |
| `latitude` / `longitude` | double | Filtrado por bbox |
| `address`, `tel`, `website` | string | Pueden ser NULL |
| `fsq_category_labels` | string[] | **Rutas jerárquicas** |
| `date_closed` | date | NULL = abierto |
| `date_refreshed` | date | Frescura del registro |

Las categorías son rutas tipo `Dining and Drinking > Restaurant > Spanish Restaurant > Tapas Restaurant`, lo que permite filtrar a cualquier nivel del árbol.

### Cobertura gastronómica en Málaga (top categorías)

| Categoría | Nº |
|-----------|-----|
| Tapas Restaurant | 561 |
| Spanish Restaurant | 581 |
| Café | 490 |
| Bar | 485 |
| Coffee Shop | 401 |
| Bakery | 300 |
| Breakfast Spot | 265 |
| Ice Cream Parlor (heladerías) | 195 |
| Cocktail Bar | 168 |
| Pub | 160 |

## 7. Tool `find_places`

Primera tool del MCP. Consulta el slice local.

**Parámetros**
- `categoria` *(requerido)* — término semántico; Claude lo mapea a la ruta Foursquare.
- `cerca_de` *(opcional)* — coordenadas o nombre de lugar (geocodificado con Nominatim) para ordenar/filtrar por distancia.
- `limite` *(opcional)*.
- ~~`abierto_a`~~ — **no servible desde Foursquare** (sin horarios); se resolverá con OSM/Overpass en una capa aparte.

**Mapa categoría coloquial → filtro**
| Usuario dice | Filtro |
|--------------|--------|
| tapas | `…> Tapas Restaurant` |
| heladería | `…> Ice Cream Parlor` |
| café | `…> Café` / `Coffee Shop` |
| bar | `…> Bar` y derivados |
| restaurante | `…> Restaurant` |
| panadería | `…> Bakery` |

**Filtrado en DuckDB**
```sql
-- Match exacto de una categoría
WHERE list_contains(fsq_category_labels,
        'Dining and Drinking > Restaurant > Spanish Restaurant > Tapas Restaurant')

-- Grupo amplio por patrón
WHERE len(list_filter(fsq_category_labels, x -> x LIKE '%> Bar%')) > 0
```

**Decisión pendiente:** filtrar por *string de etiqueta* (rápido, para la demo) vs. por `fsq_category_ids` + dataset *Categories* (IDs estables, robusto, v2).

## 8. Tipos de pregunta (de menos a más interesante)

1. **Consulta directa** — *"¿cuánto falta para el 11 en la Alameda?"* (1 tool).
2. **Resolución difusa** — *"el bar de la playa desde Teatinos"* (Claude resuelve nombres vagos).
3. **Composición y razonamiento** — varias tools + síntesis.
4. **Mezcla con conocimiento del mundo** — meteo, eventos, etc.

**Casos estrella para la demo:**
- *"¿Me da tiempo a ir al Picasso y encontrarlo abierto si salgo ahora?"* → hora + geocoding + routing + horario + festivo. Cadena de 5-6 tools.
- *"Tapas baratas esta tarde a partir de las 5"* → `find_places` + capa OSM de horarios.

## 9. Despliegue (gratis, para demo)

- **Frontend Angular** → Vercel o Render estático (sin reposo).
- **Servidor MCP Node + slice** → Render free web service (sin tarjeta; se duerme a los 15 min, arranque en frío 30-50 s — mitigable con keep-alive) o Northflank (sin sleep).
- **El Parquet de 10 GB no se aloja en ningún sitio**: el slice de pocos MB viaja dentro del repo.

## 10. Estado actual

- [x] Arquitectura y decisiones de producto definidas
- [x] Pipeline de datos Foursquare resuelto y ejecutado
- [x] Slice `malaga_places.parquet` generado (27.299 POIs, bbox verificado)
- [x] Cobertura de categorías validada
- [x] Diseño de `find_places`
- [ ] Esqueleto del servidor MCP (Node) ← **siguiente paso**
- [ ] Tool `find_places` implementada sobre el slice
- [ ] Tools de transporte / geocoding / festivos
- [ ] Capa OSM de horarios
- [ ] Frontend Angular + integración API de Anthropic
- [ ] Despliegue

## 11. Limitaciones conocidas

- Sin valoraciones ni precio (ninguna fuente libre los da).
- Horarios solo vía OSM, con cobertura irregular.
- Frescura de Foursquare: release mensual.
- El bbox rectangular incluye algo de mar/puerto (inocuo tras filtrar categorías).

## 12. Licencia y atribución

Datos de **Foursquare Open Source Places**, bajo licencia **Apache 2.0**. Debe conservarse el `NOTICE.txt` de Foursquare al redistribuir el slice. Datos cartográficos y de horarios de **OpenStreetMap** (ODbL) cuando se integren.
