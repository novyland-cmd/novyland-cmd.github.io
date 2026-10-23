// Exécuter avec : node --test novytools/applications/chrono-joueurs/tests/session.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source = await readFile(new URL('../session.js', import.meta.url), 'utf8');
const m = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const players = [{name:'Alice',color:'#2f5d50'},{name:'Bob',color:'#346dad'}];
test('Les pauses sont exclues, y compris après annulation et fin en pause', () => {
  const s = m.createSession(players,0,'Test',1000);
  m.nextTurn(s,4000); assert.equal(s.turns[0].duration,3000);
  m.togglePause(s,6000); assert.equal(m.currentDuration(s,20000),2000);
  m.togglePause(s,9000); m.undoTurn(s,10000);
  assert.equal(s.active,0); assert.equal(m.currentDuration(s,10000),6000);
  assert.equal(s.turns.length,0);
  m.nextTurn(s,12000); m.togglePause(s,14000); m.finishSession(s,17000);
  const stats = m.statistics(s);
  assert.equal(stats.total,10000); assert.equal(stats.average,5000);
  assert.equal(s.pauseTotal,6000);
  assert.equal(s.endedAt-s.startedAt,stats.total+s.pauseTotal);
  m.finishSession(s,18000); assert.equal(s.turns.length,2);
});
test('Une sauvegarde reprend le temps et valide les données', () => {
  const s = JSON.parse(JSON.stringify(m.createSession(players,1,'',1000)));
  assert(m.validSession(s)); assert.equal(m.currentDuration(s,61000),60000);
  assert(!m.validSession({...s,active:9}));
  assert(!m.validSession({...s,turns:[{player:0,duration:-1}]}));
});
test('La moyenne globale est pondérée par le nombre de tours', () => {
  const s=m.createSession(players,0,'',0);
  m.nextTurn(s,1000); m.nextTurn(s,4000); m.finishSession(s,9000);
  const stats=m.statistics(s);
  assert.equal(stats.total,9000); assert.equal(stats.average,3000);
  assert.equal(stats.players[0].count,2); assert.equal(stats.players[0].average,3000);
});
test('Un joueur sans tour ne reçoit pas de moyenne et une pause bloque le changement', () => {
  const s=m.createSession(players,0,'',0);
  m.togglePause(s,1000); m.nextTurn(s,2000); assert.equal(s.turns.length,0);
  m.finishSession(s,3000); assert.equal(m.statistics(s).players[1].average,null);
  assert.equal(s.turns[0].duration,1000);
});
