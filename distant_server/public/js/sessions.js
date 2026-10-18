import { fmtDate, fmtDuration, naiveDate, fmtClock, getJson } from './common.js';

const list = document.getElementById('list');

function row(s) {
  const start = naiveDate(s.start);
  const end = naiveDate(s.stop || s.last_ts || s.start);
  const seconds = (end - start) / 1000;

  const link = document.createElement('a');
  link.className = 'session-row';
  link.href = '/session?id=' + s.id;

  const main = document.createElement('span');
  main.className = 'session-main';
  const title = document.createElement('strong');
  title.textContent = s.name || 'Session ' + s.id;
  const when = document.createElement('span');
  when.textContent = fmtDate(start) + ', ' + fmtClock(start).slice(0, 5);
  main.append(title, when);

  const meta = document.createElement('span');
  meta.className = 'session-meta';
  const notes = [fmtDuration(seconds)];
  if (s.n_gps === 0) notes.push('sans GPS');
  if (s.n_anemo === 0) notes.push('sans vent');
  meta.textContent = notes.join(' · ');

  link.append(main, meta);
  return link;
}

try {
  const sessions = await getJson('/api/sessions');
  list.textContent = '';
  if (sessions.length === 0) {
    const empty = document.createElement('p');
    empty.append('Aucune session pour le moment. ');
    const a = document.createElement('a');
    a.href = '/upload';
    a.textContent = 'Importe une base de données.';
    empty.append(a);
    list.append(empty);
  }
  for (const s of sessions) list.append(row(s));
} catch (e) {
  list.textContent = 'Impossible de charger les sessions : ' + e.message;
}
