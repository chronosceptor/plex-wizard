# Plex Wizard

Webapp para auditar y enriquecer la metadata de tu librería de música en Plex. Detecta problemas de metadata y permite corregirlos directamente desde el navegador, integrando MusicBrainz, Last.fm y Discogs.

## Stack

- **Backend**: Python 3.11+ · FastAPI · PlexAPI
- **Frontend**: React 18 · Vite · TailwindCSS · TanStack Query

## Requisitos

- Python 3.11+
- Node.js 18+
- Plex Media Server con token de acceso
- Cuentas opcionales: Last.fm API key · Discogs personal token

## Instalación

### 1. Variables de entorno

Crea un archivo `.env` en la raíz del proyecto:

```env
# Requerido
PLEX_URL=http://tu-servidor:32400
PLEX_TOKEN=tu-plex-token

# Opcional — habilita enrichment de metadata
LASTFM_API_KEY=tu-lastfm-api-key
DISCOGS_TOKEN=tu-discogs-token
```

> **Plex token**: abre Plex en el navegador → Settings → Account → busca `X-Plex-Token` en la URL.
> **Last.fm key**: `last.fm/api/account/create`
> **Discogs token**: `discogs.com/settings/developers → Generate token`

### 2. Backend

```bash
python3 -m venv venv
venv/bin/pip install -r backend/requirements.txt

cd backend
../venv/bin/uvicorn main:app --reload --port 8000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Abre `http://localhost:5173`. Si solo tienes una librería de música, se selecciona automáticamente y el scan arranca solo.

---

## Flujo de uso

1. La app detecta tu librería y lanza el **scan automático** al abrirse.
2. El sidebar muestra el progreso paso a paso con tiempo por etapa — puedes navegar libremente mientras escanea.
3. Cada sección se desbloquea en cuanto su paso específico termina, sin esperar al scan completo.
4. El **Dashboard** muestra un resumen con conteos de cada problema.
5. Desde cada tabla puedes aplicar correcciones directamente a Plex.

---

## Auditorías

| Sección | Qué detecta | Acciones disponibles |
| --- | --- | --- |
| **Artistas sin match** | GUID `local://` — nunca matcheados con ningún agente | Auto-match (MB), Fix manual |
| **Albums sin match** | Albums con GUID `local://` | Fix match (MB) |
| **Albums sin portada** | `thumb` vacío en Plex | — |
| **Sin género** | Artistas sin tags de género | Enrich (LFM + Discogs) |
| **Sin foto / bio** | Sin imagen o descripción del artista | Enrich (LFM) |
| **Sin país** | Campo `country` vacío en Plex | Ver MB, Enrich (LFM + Discogs), Fix match |
| **Tracks incompletos** | Tracks sin año de album, sin album o sin artista | — |
| **Stats de escucha** | Nunca escuchados · top 20 · sin escuchar +180 días | Fix match para "nunca escuchados" |

---

## Corrección de metadata

### Fix Match
Equivalente a "Fix Incorrect Match" en la UI de Plex, pero desde la tabla:
- Busca el artista/album en el agente de Plex (MusicBrainz)
- Muestra candidatos con score de confianza y link **MB ↗** para validar
- Aplica el match → Plex descarga automáticamente foto, bio, género, país, artistas similares
- Al aplicar, el ítem desaparece de la lista

### Auto-match (Artistas sin match)
Proceso semi-automático que compara albums:
1. Busca el artista en MusicBrainz por nombre
2. Para cada candidato, descarga su discografía de MB
3. Calcula el % de albums de Plex que coinciden con MB
4. Muestra candidatos rankeados con barra de confianza (verde ≥70%)
5. Los albums coincidentes se resaltan para facilitar la validación

### Ver MB (Artistas sin país)
Para artistas con MBID ya asignado, consulta MusicBrainz directamente:
- Muestra país, tipo, año de fundación, géneros con votos
- Botones "Aplicar país", "Aplicar géneros", "Aplicar todo"
- Link **MB ↗** para verificar antes de aplicar

### Enrich (Last.fm + Discogs)
Modal con dos tabs para enriquecer artistas desde fuentes externas:

**Last.fm tab:**
- Tags del artista (crowd-sourced, muy buenos para música electrónica)
- Bio/descripción completa
- Artistas similares · listener count
- "Aplicar como géneros" · "Aplicar bio" · "Aplicar tags + bio"

**Discogs tab:**
- Búsqueda del artista en Discogs con foto
- Link directo a la página del artista en Discogs
- Los géneros/estilos por release se aplican desde "Albums sin match"

---

## Estructura del proyecto

```text
plex-wizard/
├── .env                          # Credenciales (no commitear — en .gitignore)
├── venv/                         # Virtualenv Python
├── backend/
│   ├── main.py                   # FastAPI app + todos los endpoints
│   ├── plex_client.py            # Conexión a PlexServer
│   ├── scan_manager.py           # Scan en background con caché por paso
│   ├── mb_client.py              # Cliente MusicBrainz API
│   ├── lastfm_client.py          # Cliente Last.fm API
│   ├── discogs_client.py         # Cliente Discogs API
│   ├── requirements.txt
│   └── audits/
│       ├── albums.py             # Albums sin portada
│       ├── artists.py            # Artistas sin género / sin foto+bio
│       ├── artists_country.py    # Artistas sin país (incluye flag hasMbid)
│       ├── unmatched.py          # Artistas y albums con GUID local://
│       ├── tracks.py             # Tracks sin año de album, sin album/artista
│       └── listening_stats.py    # Stats de escucha por artista
└── frontend/
    ├── package.json
    ├── vite.config.js            # Proxy /api → localhost:8000
    ├── tailwind.config.js
    └── src/
        ├── App.jsx
        ├── main.jsx
        ├── context/
        │   └── ScanContext.jsx   # Estado global del scan + resultados por paso
        ├── hooks/
        │   └── useAuditData.js   # Lee resultados del contexto por clave de audit
        ├── api/
        │   └── plex.js           # Funciones fetch hacia el backend
        ├── components/
        │   ├── Layout.jsx        # Sidebar + nav + progreso del scan
        │   ├── AuditTable.jsx    # Tabla con filtro y ordenación
        │   ├── ScanGate.jsx      # Bloquea página hasta que su paso termina
        │   ├── StepList.jsx      # Lista de pasos con tiempo real por etapa
        │   ├── FixMatchModal.jsx # Fix match para artistas y albums (MB)
        │   ├── AutoMatchModal.jsx# Auto-match con comparación de albums (MB)
        │   ├── MBDataModal.jsx   # Datos de MB para artistas con MBID
        │   └── EnrichModal.jsx   # Enrich con tabs Last.fm + Discogs
        └── pages/
            ├── Dashboard.jsx
            ├── ArtistNoMatch.jsx
            ├── AlbumNoMatch.jsx
            ├── AlbumAudit.jsx
            ├── ArtistGenreAudit.jsx
            ├── ArtistPhotoAudit.jsx
            ├── ArtistCountryAudit.jsx
            ├── TrackAudit.jsx
            └── ListeningStats.jsx
```

---

## API del backend

### Scan

| Método | Endpoint | Descripción |
| --- | --- | --- |
| `POST` | `/api/scan/start?library=X` | Inicia scan en background |
| `GET` | `/api/scan/status?library=X` | Estado + progreso por paso con tiempos |
| `GET` | `/api/scan/results?library=X` | Todos los resultados cuando termina |

### Auditorías (leen del caché del scan)

| Método | Endpoint | Descripción |
| --- | --- | --- |
| `GET` | `/api/audit/summary?library=X` | Conteos de todos los problemas |
| `GET` | `/api/audit/albums-no-artwork?library=X` | Albums sin portada |
| `GET` | `/api/audit/artists-no-genre?library=X` | Artistas sin género |
| `GET` | `/api/audit/artists-no-photo?library=X` | Artistas sin foto/bio |
| `GET` | `/api/audit/artists-no-country?library=X` | Artistas sin país |
| `GET` | `/api/audit/artists-no-match?library=X` | Artistas sin match (local://) |
| `GET` | `/api/audit/albums-no-match?library=X` | Albums sin match (local://) |
| `GET` | `/api/audit/tracks-incomplete?library=X` | Tracks con metadata incompleta |
| `GET` | `/api/audit/listening-stats?library=X` | Stats de escucha |

### Artistas — Fix / Enrich

| Método | Endpoint | Descripción |
| --- | --- | --- |
| `GET` | `/api/artist/{id}/matches?query=X` | Candidatos en agente Plex (MB) |
| `PUT` | `/api/artist/{id}/fix-match` | Aplica match al artista |
| `PUT` | `/api/artist/{id}/refresh` | Refresca metadata desde el agente |
| `GET` | `/api/artist/{id}/auto-match` | Auto-match comparando albums con MB |
| `GET` | `/api/artist/{id}/mb-data` | Datos del artista desde MB API |
| `PUT` | `/api/artist/{id}/apply-mb` | Aplica país/géneros de MB a Plex |
| `GET` | `/api/artist/{id}/lastfm-data` | Tags, bio y similares desde Last.fm |
| `PUT` | `/api/artist/{id}/apply-lastfm` | Aplica tags/bio de Last.fm a Plex |
| `GET` | `/api/artist/{id}/discogs-search` | Busca el artista en Discogs |
| `PUT` | `/api/artist/{id}/apply-discogs` | Aplica géneros/estilos de Discogs a Plex |

### Albums — Fix / Enrich

| Método | Endpoint | Descripción |
| --- | --- | --- |
| `GET` | `/api/album/{id}/matches?query=X` | Candidatos en agente Plex (MB) |
| `PUT` | `/api/album/{id}/fix-match` | Aplica match al album |
| `PUT` | `/api/album/{id}/refresh` | Refresca metadata del album |
| `GET` | `/api/album/{id}/discogs-search` | Busca el album en Discogs |
| `PUT` | `/api/album/{id}/apply-discogs` | Aplica géneros/estilos de Discogs al album |

Documentación interactiva en `http://localhost:8000/docs` (Swagger UI).

---

## Notas

- El scan completo tarda ~15-20 minutos en una librería de 1200+ artistas. El paso más lento es "Tracks" que consulta cada track individualmente. Los resultados de cada paso están disponibles en cuanto ese paso termina.
- El `.env` está en `.gitignore` — nunca commitear credenciales.
- Este proyecto no duplica las funcionalidades de `../scripts` (análisis de filesystem, duplicados, bitrates, beets) — se enfoca en metadata del agente de Plex y enriquecimiento desde APIs externas.
- El campo `year` de los tracks en Plex Music vive a nivel de **album** (`parentYear`), no de track individual. El audit de tracks lo accede correctamente desde el XML de Plex.
