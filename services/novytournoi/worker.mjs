import { cleanState, validCode } from '../../labo/novytournoi/model.mjs';

const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
const error = (message, status) => json({ error: message }, status);
const publicRecord = row => ({ code: row.code, state: row.state, revision: row.revision, updatedAt: row.updatedAt });
const digest = async text => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))), b => b.toString(16).padStart(2, '0')).join('');
const validToken = token => /^[a-f0-9]{64}$/.test(token || '');
async function readBody(request) {
  // Enforce the limit while streaming, including requests without Content-Length.
  const reader = request.body?.getReader();
  if (!reader) throw Error('Requête vide.');
  const chunks = []; let bytes = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > 65536) { await reader.cancel(); throw Error('Requête trop volumineuse.'); }
    chunks.push(value);
  }
  const combined = new Uint8Array(bytes); let offset = 0;
  for (const c of chunks) { combined.set(c, offset); offset += c.byteLength; }
  const parsed = JSON.parse(new TextDecoder().decode(combined));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw Error('Requête invalide.');
  return parsed;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim());
    if (origin && !allowed.includes(origin)) return error('Origine non autorisée.', 403);
    let response;
    try {
      const url = new URL(request.url);
      if (request.method === 'OPTIONS') response = new Response(null, { status: 204 });
      else if (url.pathname === '/api/health' && request.method === 'GET') response = json({ ok: true, service: 'NovyTournoi' });
      else if (url.pathname === '/api/tournaments' && request.method === 'POST') {
        const body = await readBody(request);
        if (!validCode(body.code) || !validToken(body.editorToken)) response = error('Code ou autorisation invalide.', 400);
        else {
          const state = cleanState(body.state, { requireStarted: true });
          const stub = env.TOURNAMENTS.get(env.TOURNAMENTS.idFromName(body.code));
          response = await stub.fetch(new Request('https://tournament/create', { method: 'POST', body: JSON.stringify({ code: body.code, editorHash: await digest(body.editorToken), state }) }));
        }
      } else {
        const match = url.pathname.match(/^\/api\/tournaments\/([A-HJ-NP-Z2-9]{12})$/);
        if (!match) response = error('Adresse inconnue.', 404);
        else if (!['GET', 'PUT'].includes(request.method)) response = error('Méthode non autorisée.', 405);
        else {
          const stub = env.TOURNAMENTS.get(env.TOURNAMENTS.idFromName(match[1]));
          if (request.method === 'GET') response = await stub.fetch('https://tournament/');
          else {
            const token = request.headers.get('Authorization')?.replace(/^Bearer /, '');
            if (!validToken(token)) response = error('Autorisation de l’organisateur requise.', 401);
            else {
              const body = await readBody(request);
              if (!Number.isSafeInteger(body.revision) || body.revision < 1 || !/^[a-f0-9-]{36}$/.test(body.mutationId || '')) response = error('Version de sauvegarde invalide.', 400);
              else response = await stub.fetch(new Request('https://tournament/', { method: 'PUT', body: JSON.stringify({ state: cleanState(body.state, { requireStarted: true }), revision: body.revision, mutationId: body.mutationId, editorHash: await digest(token) }) }));
            }
          }
        }
      }
    } catch (e) {
      // Internal storage errors must not masquerade as malformed user data.
      response = e instanceof SyntaxError || /invalid|Il faut|vide|volumineuse/i.test(e.message) ? error('Données invalides : vérifiez le tournoi envoyé.', 400) : error('Le stockage est momentanément indisponible. Réessayez.', 503);
    }
    const headers = new Headers(response.headers);
    if (origin) headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Vary', 'Origin');
    headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    headers.set('Cache-Control', 'no-store');
    return new Response(response.body, { status: response.status, headers });
  }
};

export class TournamentStore {
  constructor(ctx) { this.ctx = ctx; }
  async fetch(request) {
    if (request.method === 'GET') {
      const row = await this.ctx.storage.get('tournament');
      return row ? json(publicRecord(row)) : error('Aucun tournoi trouvé pour ce code.', 404);
    }
    const input = await request.json();
    return this.ctx.storage.transaction(async storage => {
      const row = await storage.get('tournament');
      if (request.method === 'POST') {
        if (row) return row.editorHash === input.editorHash ? json(publicRecord(row)) : error('Ce code est déjà utilisé. Recréez le partage.', 409);
        const created = { code: input.code, state: input.state, editorHash: input.editorHash, revision: 1, updatedAt: new Date().toISOString() };
        await storage.put('tournament', created);
        return json(publicRecord(created), 201);
      }
      if (!row) return error('Tournoi introuvable.', 404);
      if (row.editorHash !== input.editorHash) return error('Seul l’organisateur peut modifier les résultats.', 403);
      // A replay after a lost response must not create a false conflict.
      if (row.lastMutation === input.mutationId) return json(publicRecord(row));
      if (row.revision !== input.revision) return error('Les résultats ont changé ailleurs. Rechargez la version du serveur.', 409);
      const updated = { ...row, state: input.state, revision: row.revision + 1, lastMutation: input.mutationId, updatedAt: new Date().toISOString() };
      await storage.put('tournament', updated);
      return json(publicRecord(updated));
    });
  }
}
