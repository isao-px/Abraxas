import { fmt, naiveDate, fmtClock, fmtDate, fmtElapsed, fmtDuration, getJson } from './common.js';

const $ = (id) => document.getElementById(id);
const READOUT = { sog: 1, cog: 0, awa: 0, aws: 1, twa: 0, tws: 1, vmg: 1, pitch: 1, roll: 1 };
const CHARTS = [
  { key: 'sog', title: 'Vitesse (kn)', color: '#1f5f7a', zero: true },
  { key: 'vmg', title: 'VMG (kn)', color: '#2f7d5b', zero: true },
  { key: 'roll', title: 'Roll (°)', color: '#a86a00', zero: true },
  { key: 'pitch', title: 'Pitch (°)', color: '#6b4c9a', zero: false },
];
const BAND = { tack: 'rgba(31,95,122,0.16)', gybe: 'rgba(168,106,0,0.22)' };

function showMessage(text) {
  $('message').textContent = text;
  $('message').hidden = false;
}

async function main() {
  const id = Number(new URLSearchParams(location.search).get('id'));
  if (!Number.isInteger(id) || id <= 0) return showMessage('Session introuvable. Choisis une session dans la liste.');
  let data;
  try {
    data = await getJson('/api/sessions/' + id);
  } catch (e) {
    return showMessage(e.message);
  }
  if (data.meta.empty) return showMessage("Cette session ne contient aucune donnée.");
  $('content').hidden = false;
  $('timebar').hidden = false;
  render(data);
}

function addRow(dl, label, valueText, small, jumpTo) {
  const row = document.createElement('div');
  row.className = 'row';
  const dt = document.createElement('dt');
  dt.textContent = label;
  const dd = document.createElement('dd');
  dd.append(valueText);
  if (small) {
    const s = document.createElement('small');
    s.textContent = ' ' + small;
    dd.append(s);
  }
  if (jumpTo !== undefined && jumpTo !== null) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'link';
    b.textContent = 'voir';
    b.addEventListener('click', () => window.setTime(jumpTo));
    dd.append(b);
  }
  row.append(dt, dd);
  dl.append(row);
}

function statGroup(title, rows) {
  const panel = document.createElement('section');
  panel.className = 'panel';
  const h = document.createElement('h2');
  h.textContent = title;
  const dl = document.createElement('dl');
  for (const r of rows) addRow(dl, ...r);
  panel.append(h, dl);
  return panel;
}

const kn = (v) => (v === null ? '–' : fmt(v, 1) + ' kn');
const deg = (v) => (v === null ? '–' : fmt(v, 1) + '°');
const pct = (v) => (v === null ? '–' : fmt(v * 100, 0) + ' %');
const sec = (v) => (v === null ? '–' : fmt(v, 0) + ' s');

function render(data) {
  const { session, meta, series, stats, manoeuvres } = data;
  const n = meta.n;
  const t0 = naiveDate(meta.t0).getTime();
  const start = new Date(t0);
  const end = new Date(t0 + meta.duration_s * 1000);

  const name = session.name || 'Session ' + session.id;
  $('title').textContent = name;
  document.title = 'Abraxas – ' + name;
  $('subtitle').textContent = fmtDate(start) + ', ' + fmtClock(t0).slice(0, 5) + ' à ' + fmtClock(end.getTime()).slice(0, 5) + ' (' + fmtDuration(meta.duration_s) + ')';

  for (const w of meta.warnings) {
    const p = document.createElement('p');
    p.className = 'notice';
    p.textContent = w;
    $('warnings').append(p);
  }

  const tack = stats.tack;
  const gybe = stats.gybe;
  const countText = (m) => (m.count ? '(' + m.count + ')' : '');
  $('stats').append(
    statGroup('Vitesse', [
      ['Vitesse max', kn(stats.speed_max)],
      ['Vitesse moyenne', kn(stats.speed_mean)],
      ['Distance', stats.distance_nm === null ? '–' : fmt(stats.distance_nm, 2) + ' nm', stats.distance_km === null ? '' : fmt(stats.distance_km, 1) + ' km'],
    ]),
    statGroup('VMG', [
      ['VMG max au près', kn(stats.vmg_up_max)],
      ['VMG moyenne au près', kn(stats.vmg_up_mean)],
      ['VMG max au portant', kn(stats.vmg_down_max)],
      ['VMG moyenne au portant', kn(stats.vmg_down_mean)],
    ]),
    statGroup('Assiette', [
      ['Pitch moyen', deg(stats.pitch_mean)],
      ['Pitch max', deg(stats.pitch_max)],
      ['Roll moyen', deg(stats.roll_mean)],
      ['Roll max', deg(stats.roll_max)],
    ]),
    statGroup('Manœuvres', [
      ['Vitesse conservée en virement', pct(tack.retention_mean), countText(tack)],
      ['Vitesse conservée en empannage', pct(gybe.retention_mean), countText(gybe)],
      ['Temps moyen pour repartir', sec(stats.recover_mean_s)],
      ['Meilleur virement', tack.best ? pct(tack.best.retention) : '–', '', tack.best ? tack.best.t : null],
      ['Meilleur empannage', gybe.best ? pct(gybe.best.retention) : '–', '', gybe.best ? gybe.best.t : null],
    ])
  );

  renderManoeuvres(manoeuvres);

  const xs = Array.from({ length: n }, (_, i) => i);
  let cursor = 0;
  const plots = [];
  let pending = false;

  function redraw() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      for (const u of plots) u.redraw(false);
    });
  }

  const latFill = fillForward(series.lat);
  const lonFill = fillForward(series.lon);
  const hasTrack = meta.has_gps && latFill[0] !== null;
  let marker = null;
  if (hasTrack) {
    const map = L.map('map');
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    const points = [];
    for (let i = 0; i < n; i++) if (series.lat[i] !== null && series.lon[i] !== null) points.push([series.lat[i], series.lon[i]]);
    L.polyline(points, { color: '#1f5f7a', weight: 3 }).addTo(map);
    map.fitBounds(points, { padding: [20, 20] });
    marker = L.circleMarker([latFill[0], lonFill[0]], { radius: 8, color: '#141413', weight: 3, fillColor: '#f0eee6', fillOpacity: 1 }).addTo(map);
  } else {
    $('map').textContent = 'Pas de données GPS pour cette session.';
    $('map').style.padding = '16px';
  }

  for (const c of CHARTS) {
    const figure = document.createElement('figure');
    const caption = document.createElement('figcaption');
    caption.textContent = c.title;
    figure.append(caption);
    $('charts').append(figure);
    if (!series[c.key].some((v) => v !== null)) {
      const empty = document.createElement('p');
      empty.className = 'empty';
      empty.textContent = 'Pas de données.';
      figure.append(empty);
      continue;
    }
    const holder = document.createElement('div');
    holder.className = 'chart';
    figure.append(holder);
    plots.push(makeChart(holder, c, xs, series[c.key], manoeuvres, () => cursor, (t) => window.setTime(t)));
  }

  const slider = $('slider');
  slider.max = n - 1;

  window.setTime = (t) => {
    cursor = Math.max(0, Math.min(n - 1, Math.round(t)));
    slider.value = cursor;
    $('clock').textContent = fmtClock(t0 + cursor * 1000);
    $('elapsed').textContent = fmtElapsed(cursor);
    for (const key in READOUT) $('r-' + key).textContent = fmt(series[key][cursor], READOUT[key]);
    if (marker) {
      marker.setLatLng([latFill[cursor], lonFill[cursor]]);
      $('position').textContent = fmt(latFill[cursor], 5) + ', ' + fmt(lonFill[cursor], 5);
    }
    redraw();
  };
  slider.addEventListener('input', () => window.setTime(Number(slider.value)));
  window.setTime(0);
}

function fillForward(values) {
  const out = [];
  let last = null;
  for (const v of values) {
    if (v !== null) last = v;
    out.push(last);
  }
  const firstValid = values.find((v) => v !== null);
  return out.map((v) => (v === null ? (firstValid === undefined ? null : firstValid) : v));
}

function makeChart(holder, c, xs, ys, manoeuvres, getCursor, setTime) {
  const stroke = '#141413';
  const grid = 'rgba(20,20,19,0.1)';
  const opts = {
    width: holder.clientWidth || 300,
    height: 150,
    legend: { show: false },
    cursor: { show: false },
    scales: {
      x: { time: false },
      y: c.zero ? { range: (u, min, max) => [Math.min(min, 0), Math.max(max, 0)] } : {},
    },
    axes: [
      {
        stroke,
        grid: { stroke: grid },
        splits: (u, i, min, max) => {
          const steps = [10, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200];
          const step = steps.find((s) => (max - min) / s <= 6) || 7200;
          const out = [];
          for (let v = Math.ceil(min / step) * step; v <= max; v += step) out.push(v);
          return out;
        },
        values: (u, splits) => splits.map(fmtElapsed),
      },
      { stroke, grid: { stroke: grid }, size: 46 },
    ],
    series: [{}, { stroke: c.color, width: 1.8, spanGaps: false, points: { show: false } }],
    hooks: {
      drawClear: [
        (u) => {
          const { top, height } = u.bbox;
          for (const m of manoeuvres) {
            const x1 = u.valToPos(m.t_start, 'x', true);
            const x2 = u.valToPos(m.t_end, 'x', true);
            u.ctx.fillStyle = BAND[m.type];
            u.ctx.fillRect(x1, top, Math.max(x2 - x1, 3), height);
          }
        },
      ],
      draw: [
        (u) => {
          const { top, height } = u.bbox;
          const x = Math.round(u.valToPos(getCursor(), 'x', true));
          u.ctx.save();
          u.ctx.strokeStyle = stroke;
          u.ctx.lineWidth = 2;
          u.ctx.beginPath();
          u.ctx.moveTo(x, top);
          u.ctx.lineTo(x, top + height);
          u.ctx.stroke();
          u.ctx.restore();
        },
      ],
    },
  };

  const u = new uPlot(opts, [xs, ys], holder);
  new ResizeObserver(() => u.setSize({ width: holder.clientWidth, height: 150 })).observe(holder);

  let dragging = false;
  const seek = (e) => setTime(u.posToVal(e.clientX - u.over.getBoundingClientRect().left, 'x'));
  u.over.style.touchAction = 'pan-y';
  u.over.addEventListener('pointerdown', (e) => {
    dragging = true;
    u.over.setPointerCapture(e.pointerId);
    seek(e);
  });
  u.over.addEventListener('pointermove', (e) => {
    if (dragging) seek(e);
  });
  u.over.addEventListener('pointerup', () => (dragging = false));
  u.over.addEventListener('pointercancel', () => (dragging = false));
  return u;
}

function renderManoeuvres(list) {
  const box = $('manoeuvres');
  if (list.length === 0) {
    box.textContent = 'Aucune manœuvre détectée (il faut le GPS et l’anémomètre).';
    return;
  }
  const table = document.createElement('table');
  const head = table.createTHead().insertRow();
  for (const h of ['Début', 'Type', 'Vitesse avant', 'Vitesse mini', 'Conservée', 'Repart en']) {
    const th = document.createElement('th');
    th.textContent = h;
    head.append(th);
  }
  const body = table.createTBody();
  for (const m of list) {
    const tr = body.insertRow();
    const cells = [fmtElapsed(m.t_start), m.type === 'tack' ? 'Virement' : 'Empannage', fmt(m.v_in, 1) + ' kn', fmt(m.v_min, 1) + ' kn', fmt(m.retention * 100, 0) + ' %', m.recover_s === null ? '–' : m.recover_s + ' s'];
    for (const text of cells) tr.insertCell().textContent = text;
    tr.addEventListener('click', () => window.setTime(m.t_cross));
  }
  const wrap = document.createElement('div');
  wrap.className = 'table-wrap';
  wrap.append(table);
  box.append(wrap);
}

main();
