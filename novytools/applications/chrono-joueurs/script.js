import { createPlayerSelection, getColorDefinition, applyTokenAppearance } from '../../../assets/js/player-selection.js';
import {createSession, currentDuration, nextTurn, togglePause, undoTurn, finishSession, statistics, validSession} from './session.js';
import {formatElapsedTime as format} from '../minuteur/timer.js';
const $ = id => document.getElementById(id);
const key = 'novytools.chrono-joueurs.v1';
let session = null, saved = null, lastTap = -Infinity, wakeLock = null;
const say = text => { $('status').textContent = text; };
function save() {
  try { localStorage.setItem(key, JSON.stringify(session)); }
  catch { say('La sauvegarde est indisponible sur cet appareil. Gardez cette page ouverte.'); }
}
function node(tag, text, parent) {
  const el = document.createElement(tag); if (text !== undefined) el.textContent = text;
  if (parent) parent.append(el); return el;
}
function show(id) { for (const view of ['setup','restore','play','report']) $(view).hidden = view !== id; }
const playerSelection = createPlayerSelection({root: $('player-selection'), startButton: $('start-game'), min: 2, max: 8});
async function manageWakeLock() {
  if (!session || session.paused || session.endedAt !== null || document.visibilityState !== 'visible') {
    if (wakeLock) { await wakeLock.release().catch(() => {}); wakeLock = null; } return;
  }
  try { if (!wakeLock && navigator.wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch { /* Le chronomètre reste utilisable sans verrouillage. */ }
}
function renderPlay() {
  show('play');
  const p = session.players[session.active];
  $('active-player').textContent = p.name;
  const panel = document.querySelector('.play-panel');
  panel.style.setProperty('--player-color', p.color);
  // Choisir le texte offrant le meilleur contraste, y compris pour les anciennes sauvegardes.
  const channels = p.color.slice(1).match(/../g).map(hex => {
    const value = parseInt(hex, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  panel.style.setProperty('--player-text', luminance > 0.179 ? '#000' : '#fff');
  $('round').textContent = `Tour ${session.turns.length + 1} · Ronde ${Math.floor(session.turns.length / session.players.length) + 1}`;
  $('next-player').textContent = `Au suivant : ${session.players[(session.active + 1) % session.players.length].name}`;
  $('pause').textContent = session.paused ? 'Reprendre' : 'Pause';
  $('next-turn').disabled = session.paused;
  $('undo').disabled = !session.turns.length;
  $('pause-message').textContent = session.paused ? 'En pause — le temps de jeu est arrêté.' : '';
  tick(); manageWakeLock();
}
function stat(parent, label, value) { const el = node('div', undefined, parent); el.className = 'stat'; node('span', label, el); node('strong', value, el); }
function tick() {
  if (!session || session.endedAt !== null || $('play').hidden) return;
  const elapsed = currentDuration(session), stats = statistics(session);
  $('elapsed').textContent = format(elapsed);
  $('player-total').textContent = `Temps cumulé : ${format(stats.players[session.active].total + elapsed)}`;
  $('live-players').replaceChildren();
  stats.players.forEach((p, i) => {
    const card = node('div', undefined, $('live-players'));
    card.className = 'stat player-time-card';
    const token = node('span', undefined, card);
    token.className = 'player-token player-time-token';
    token.setAttribute('role', 'img');
    applyTokenAppearance(token, {...p, colorValue: p.color});
    const details = node('div', undefined, card);
    node('span', p.name, details);
    node('strong', format(p.total + (i === session.active ? elapsed : 0)), details);
  });
}
const duration = n => n === null ? '—' : format(n);
function renderTurns() {
  $('turns').replaceChildren(); const counts = session.players.map(() => 0);
  session.turns.forEach((t, i) => {
    counts[t.player]++;
    if ($('filter').value !== '' && Number($('filter').value) !== t.player) return;
    const row = node('tr', undefined, $('turns'));
    [i + 1, session.players[t.player].name, counts[t.player], format(t.duration)].forEach(v => node('td', v, row));
  });
}
function renderReport() {
  show('report'); manageWakeLock();
  $('report-title').textContent = session.name || 'Partie terminée';
  const date = n => new Date(n).toLocaleString('fr-CA');
  $('report-dates').textContent = `Du ${date(session.startedAt)} au ${date(session.endedAt)}`;
  const stats = statistics(session); $('global-stats').replaceChildren();
  for (const [label, value] of [['Temps de jeu actif',format(stats.total)],['Moyenne par tour',duration(stats.average)],['Durée réelle',format(session.endedAt - session.startedAt)],['Temps de pause',format(session.pauseTotal)],['Tours joués',session.turns.length]]) stat($('global-stats'),label,value);
  $('player-stats').replaceChildren();
  stats.players.forEach(p => {
    const row = node('tr', undefined, $('player-stats')); const name = node('th', undefined, row); name.scope = 'row';
    const dot = node('span', undefined, name); dot.className = 'dot'; dot.style.backgroundColor = p.color; dot.setAttribute('aria-hidden','true'); name.append(document.createTextNode(p.name));
    [p.count,format(p.total),duration(p.average),duration(p.shortest),duration(p.longest)].forEach(v => node('td',v,row));
  });
  $('filter').replaceChildren(); const all = node('option','Tous les joueurs',$('filter')); all.value = '';
  session.players.forEach((p,i) => { node('option',p.name,$('filter')).value = i; }); renderTurns();
}
$('setup').onsubmit = e => {
  e.preventDefault();
  if (!playerSelection.validate()) return;
  const players = playerSelection.getPlayers().map(p => ({name: p.name.trim() || p.letter,
    letter: p.letter, color: getColorDefinition(p.color).value}));
  session = createSession(players, 0, $('game-name').value.trim());
  save(); renderPlay(); $('next-turn').focus(); say('');
};
$('next-turn').onclick = () => {
  if (performance.now() - lastTap < 600) return;
  lastTap = performance.now(); nextTurn(session); save(); renderPlay();
};
$('pause').onclick = () => { togglePause(session); save(); renderPlay(); };
$('undo').onclick = () => { undoTurn(session); save(); renderPlay(); say('Dernier changement annulé. Le temps a été réattribué au joueur précédent.'); };
$('finish').onclick = () => $('finish-dialog').showModal();
$('cancel-finish').onclick = () => $('finish-dialog').close();
$('confirm-finish').onclick = () => { finishSession(session); save(); $('finish-dialog').close(); renderReport(); $('report-title').focus(); };
$('filter').onchange = renderTurns;
$('restore-game').onclick = () => { session = saved; session.endedAt === null ? renderPlay() : renderReport(); };
function reset() { session = null; saved = null; try { localStorage.removeItem(key); } catch {} show('setup'); manageWakeLock(); say(''); $('game-name').focus(); }
$('discard').onclick = () => { if (confirm('Effacer la partie sauvegardée ?')) reset(); };
$('new-game').onclick = reset;
function reportText() {
  const stats = statistics(session);
  return [session.name || 'Chrono des joueurs',`Temps actif : ${format(stats.total)} · Moyenne par tour : ${duration(stats.average)}`,`Durée réelle : ${format(session.endedAt-session.startedAt)} · Pauses : ${format(session.pauseTotal)}`,
    ...stats.players.map(p => `${p.name} : ${p.count} tours · Total ${format(p.total)} · Moyenne ${duration(p.average)} · Plus court ${duration(p.shortest)} · Plus long ${duration(p.longest)}`),
    '',...session.turns.map((t,i) => `Tour ${i+1} · ${session.players[t.player].name} · ${format(t.duration)}`)].join('\n');
}
$('copy').onclick = async () => { try { await navigator.clipboard.writeText(reportText()); say('Rapport copié.'); } catch { say('Copie indisponible. Utilisez l’export CSV.'); } };
$('csv').onclick = () => {
  // Neutraliser les formules lors de l’ouverture dans un tableur.
  const cell = v => '"' + String(v ?? '').replace(/^[=+@\-\t\r]/, "'$&").replaceAll('"','""') + '"';
  const stats = statistics(session);
  const rows = [['Partie',session.name],['Temps en millisecondes'],['Temps actif',stats.total],['Moyenne par tour',stats.average],['Durée réelle',session.endedAt-session.startedAt],['Pauses',session.pauseTotal],[],['Joueur','Tours','Total','Moyenne','Plus court','Plus long'],...stats.players.map(p => [p.name,p.count,p.total,p.average,p.shortest,p.longest]),[],['Tour','Joueur','Durée'],...session.turns.map((t,i) => [i+1,session.players[t.player].name,t.duration])];
  const url = URL.createObjectURL(new Blob(['\uFEFF'+rows.map(r => r.map(cell).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'}));
  const link = node('a'); link.href=url; link.download='chrono-joueurs.csv'; link.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
};
try { const raw = localStorage.getItem(key); if (raw) { const data = JSON.parse(raw); if (validSession(data)) saved = data; else say('La sauvegarde est invalide. Vous pouvez démarrer une nouvelle partie.'); } } catch { say('Impossible de lire la sauvegarde locale. Vous pouvez démarrer une nouvelle partie.'); }
if (saved) show('restore');
setInterval(tick,250);
document.addEventListener('visibilitychange', () => { manageWakeLock(); if (session) save(); tick(); });
window.addEventListener('pagehide', () => { if (session) save(); });
