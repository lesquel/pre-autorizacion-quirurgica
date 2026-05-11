# Deploy — Pre-Autorización Quirúrgica

Backend en cualquier platform que corra Docker (Railway, Fly, Render,
Cloud Run, ECS, k8s). Frontend en Vercel.

## Backend (Docker)

### Build

```sh
cd backend
docker build -t pre-autorizacion-backend:latest .
```

Imagen final: ~150–200 MB (multi-stage, runtime sobre `python:3.13-slim-bookworm`).

### Run local

```sh
docker run --rm -p 8000:8000 \
  -e APP_ENV=development \
  -e JWT_SECRET="$(openssl rand -hex 32)" \
  pre-autorizacion-backend:latest
```

Verificar: `curl http://localhost:8000/health` → `{"status":"ok"}`.

### Variables de entorno (producción)

El platform debe inyectar estas vía secrets/variables (NUNCA hardcodear en
la imagen):

| Variable | Obligatoria | Notas |
|---|---|---|
| `APP_ENV` | sí | `production` (activa fail-stop del JWT default y CORS=*) |
| `JWT_SECRET` | sí | 32+ chars random; `openssl rand -hex 32` |
| `JWT_ISSUER` | no | default `pre-autorizacion-quirurgica` (validado al decode) |
| `JWT_AUDIENCE` | no | default `pre-autorizacion-api` |
| `CORS_ORIGINS` | sí | CSV de origins; **incluí la URL de Vercel** (`https://<proj>.vercel.app`) |
| `NOTION_TOKEN` | si usás Notion | sin esto, fallback a `InMemory*Repository` |
| `NOTION_DB_*` | con `NOTION_TOKEN` | 7 DB ids — ver `.env.example` |
| `DEEPSEEK_API_KEY` | sí | LLM de texto |
| `GOOGLE_API_KEY` | sí | Gemini Vision para PDFs |
| `PORT` | platform-set | default 8000; Cloud Run / Fly inyectan el suyo |

`.env.example` en `backend/` lista todas con comentarios.

### Healthcheck

`GET /health` responde 200 con `{"status":"ok"}`. El Dockerfile lo usa
internamente con stdlib (`urllib.request`) — sin dep extra como `curl`.

### Por platform

- **Railway / Render**: detectan el `Dockerfile` automáticamente. Setear
  env vars en el dashboard. `PORT` lo inyectan ellos.
- **Fly.io**: `fly launch --dockerfile backend/Dockerfile` y luego
  `fly secrets set JWT_SECRET=... DEEPSEEK_API_KEY=...`.
- **Cloud Run**: `gcloud run deploy --source backend/` (necesita Buildpacks
  o `--source` directo). Memoria mínima: 512 MiB. Concurrency: 80.

### CORS para Vercel

Antes de deployar el frontend, asegurate que el backend tenga la URL
final de Vercel en `CORS_ORIGINS`. Ejemplo:

```sh
CORS_ORIGINS=https://pre-auth-quirurgica.vercel.app,https://pre-auth-quirurgica-git-main-tu-org.vercel.app
```

Si querés permitir TODAS las preview deployments de Vercel (no
recomendado en prod), tendrías que sacar `allow_credentials=True` del
`CORSMiddleware` en `main.py` — el guard de Settings no lo permite con
`*` por seguridad.

## Frontend (Vercel)

### Setup inicial

1. Importar el repo en https://vercel.com/new.
2. **Root Directory**: `frontend`.
3. Vercel auto-detecta Angular; `vercel.json` ya define el resto.
4. Settings → Environment Variables, agregar:
   - `BACKEND_API_URL` = `https://<tu-backend>.fly.dev` (o equivalente).
     Setear para `Production`, `Preview` y opcionalmente `Development`.

### Cómo funciona el inject de la URL del backend

Angular hace `fileReplacements` en build (NO lee `process.env` en runtime).
El script `frontend/scripts/inject-env.mjs` corre ANTES de `ng build` y
reescribe `apiBaseUrl` en `src/environments/environment.production.ts`
con el valor de `BACKEND_API_URL`. El cambio NO se commitea — Vercel hace
checkout fresco en cada deploy.

Build command (definido en `vercel.json` y `package.json`):

```sh
node scripts/inject-env.mjs && ng build --configuration production
```

Si `BACKEND_API_URL` no está set, el build sigue (con un warning) y usa
el placeholder `https://api.example.com` — útil para una preview rota
hasta que configures la var.

### Output dir

Angular 21 + `@angular/build` emite a `dist/frontend/browser/`.
`vercel.json` ya apunta ahí.

### SPA fallback

`vercel.json` tiene un `rewrite` `/(.*)` → `/index.html`. Sin esto, una
URL profunda (`/auditor/case/PAC-00481`) navegada directo da 404 en
Vercel. El rewrite garantiza que el bundle de Angular maneje el routing.

### Open Graph image (compartir en redes)

`frontend/public/og-image.svg` está commiteado con la imagen 1200×630
(brand mark + título serif + 3 outcomes del PRD). Los meta tags
`og:image` y `twitter:image` en `src/index.html` apuntan a ese SVG.

**Cobertura actual** (SVG):
- ✓ Twitter / X
- ✓ Slack
- ✓ Discord
- ✓ iMessage
- ✗ Facebook (requiere PNG/JPG)
- ✗ LinkedIn (requiere PNG/JPG)

**Para cubrir también LinkedIn y Facebook**: convertí el SVG a PNG.
Una forma rápida:

```sh
cd frontend/public
npx svgexport og-image.svg og-image.png 1200:630
```

Después actualizá `frontend/src/index.html` cambiando los 2 valores
de `og:image` y `twitter:image` de `og-image.svg` → `og-image.png`
(y borrá el meta `og:image:type` que indica `image/svg+xml`).

**Verificá** con [opengraph.xyz](https://www.opengraph.xyz/) o
[LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/).

### Headers de seguridad

`vercel.json` setea:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

Y `Cache-Control: public, max-age=31536000, immutable` para assets
hasheados (`.js`, `.css`, fonts, imágenes).

## Flow end-to-end del primer deploy

1. **Backend primero** (necesitamos su URL para configurar el frontend):
   ```sh
   # Ejemplo Fly:
   cd backend && fly launch --dockerfile Dockerfile
   fly secrets set JWT_SECRET="$(openssl rand -hex 32)" \
     DEEPSEEK_API_KEY=... GOOGLE_API_KEY=... \
     NOTION_TOKEN=... NOTION_DB_PATIENTS=... [...el resto...] \
     CORS_ORIGINS=https://pre-auth-quirurgica.vercel.app
   ```
2. **Anotar la URL del backend**: `https://pre-auth-backend.fly.dev`.
3. **Frontend en Vercel**:
   - Import repo → Root: `frontend`.
   - Env vars: `BACKEND_API_URL=https://pre-auth-backend.fly.dev`.
   - Deploy.
4. **Verificar CORS**: si el navegador rechaza requests, falta agregar
   la URL de Vercel a `CORS_ORIGINS` del backend (`fly secrets set ...`
   y `fly deploy` para refrescar).

## Validación rápida post-deploy

```sh
# Backend health
curl https://<backend>.fly.dev/health

# Backend OpenAPI (debe listar /api/v1/patients, /cases, etc)
curl https://<backend>.fly.dev/openapi.json | jq '.paths | keys'

# Frontend levanta sin errores en consola y golpea el backend en /api/v1/auth/login.
```
