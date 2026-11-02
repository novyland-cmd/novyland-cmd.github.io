import assert from 'node:assert/strict';
import { emptyState, chooseWinner, randomCode, randomToken } from '../../labo/novytournoi/model.mjs';
import { startFormat } from '../../labo/novytournoi/formats.mjs';
const endpoint = process.argv[2] || 'http://127.0.0.1:8788';
const origin = process.argv[3] || 'http://127.0.0.1:8765';
for (const [n, mode] of [[2, 'double'], [3, 'roundRobin'], [4, 'single'], [5, 'double'], [7, 'swiss'], [16, 'swiss']]) {
  const state = startFormat({ ...emptyState(), name: 'Contrôle formats — données fictives', players: Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'Test ' + i })) }, mode);
  const code = randomCode(), editorToken = randomToken();
  let response = await fetch(endpoint + '/api/tournaments', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ code, editorToken, state }) });
  assert.equal(response.status, 201, await response.clone().text()); let revision = (await response.json()).revision;
  for (let guard = 0; guard < 100 && !state.championIds.length; guard++) {
    const match = state.rounds.flat().find(m => m.ready && !m.auto && !m.winner); assert(match);
    chooseWinner(state, match.id, match.slots[match.id.endsWith('grand-final') ? 1 : 0]);
    response = await fetch(endpoint + '/api/tournaments/' + code, { method: 'PUT', headers: { Origin: origin, 'Content-Type': 'application/json', Authorization: 'Bearer ' + editorToken }, body: JSON.stringify({ state, revision, mutationId: crypto.randomUUID() }) });
    assert.equal(response.status, 200, await response.clone().text()); const saved = await response.json(); revision++;
    assert.equal(saved.revision, revision); assert.deepEqual(saved.state, state);
  }
  assert(state.championIds.length);
  const read = await (await fetch(endpoint + '/api/tournaments/' + code, { headers: { Origin: origin } })).json();
  assert.deepEqual(read.state, state); assert(!JSON.stringify(read).includes(editorToken));
  console.log(`Partage vérifié : ${n} joueurs, ${mode}, champion enregistré et consultable.`);
}
