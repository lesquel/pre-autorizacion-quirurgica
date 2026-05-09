/*
 * Build-time env injection para Angular.
 *
 * Angular usa fileReplacements (build-time) — no lee process.env en runtime.
 * Este script reescribe `src/environments/environment.production.ts` ANTES
 * del `ng build`, sustituyendo `apiBaseUrl` por el valor de la env var
 * `BACKEND_API_URL` (Vercel project settings → Environment Variables).
 *
 * Vercel hace checkout fresco en cada build, así que la mutación NO persiste
 * entre deploys — el archivo en main sigue con el placeholder.
 *
 * Si la env var no está set, dejamos el placeholder y log un warning. El
 * build NO falla porque eso bloquearía la PRIMERA preview deploy antes de
 * que el dev pueda configurar la var.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const target = join(here, '..', 'src', 'environments', 'environment.production.ts');

const apiUrl =
  process.env.BACKEND_API_URL?.trim() ||
  process.env.NG_APP_API_URL?.trim() ||
  '';

if (!apiUrl) {
  console.warn(
    '[inject-env] BACKEND_API_URL no está set — el build usará el placeholder ' +
      "'https://api.example.com'. Configurá la env var en Vercel " +
      '(Settings → Environment Variables) para que el frontend hable con tu backend.',
  );
  process.exit(0);
}

const before = readFileSync(target, 'utf8');
const after = before.replace(/apiBaseUrl:\s*'[^']*'/, `apiBaseUrl: '${apiUrl}'`);

if (before === after) {
  console.error(
    `[inject-env] no encontré el patrón apiBaseUrl: '...' en ${target}. ` +
      'El template del environment puede haber cambiado — revisá scripts/inject-env.mjs.',
  );
  process.exit(1);
}

writeFileSync(target, after);
console.log(`[inject-env] apiBaseUrl → ${apiUrl}`);
