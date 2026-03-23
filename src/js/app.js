/**
 * STELLARIS — Main Application v2
 * Sky rendering, controls, navigation, mini-map
 */
(function() {
'use strict';

// ══════ STATE ══════
const S = {
  lat: 51.5074, lon: -0.1278, locName: 'London', locCountry: 'UK',
  az: 180, alt: 45, zoom: 1, focus: 50,
  show: { constellations: true, labels: true, grid: true, milkyway: true, planets: true, tracking: false },
  scope: 'refractor80', eyepiece: 40, barlow: false,
  fieldStars: [], // random faint stars
  animFrame: null, lastTime: 0, trackingInterval: null
};

const SCOPES = {
  binoculars:   { name:'7×50 Binoculars',  type:'Binoculars',    ap:50,  fl:350,  maxMag:14 },
  refractor80:  { name:'80mm Refractor',    type:'Achromatic Refractor', ap:80,  fl:880,  maxMag:160 },
  newtonian200: { name:'200mm Newtonian',   type:'Newtonian Reflector',  ap:200, fl:1200, maxMag:400 },
  dobsonian12:  { name:'12″ Dobsonian',     type:'Dobsonian Reflector',  ap:305, fl:1433, maxMag:610 },
  schmidt16:    { name:'16″ SCT',           type:'Schmidt-Cassegrain',   ap:406, fl:4064, maxMag:812 },
  observatory:  { name:'Giant Observatory', type:'Ritchey-Chrétien',     ap:4000,fl:60000,maxMag:8000 }
};

// ══════ GENERATE FIELD STARS ══════
function generateFieldStars(count) {
  S.fieldStars = [];
  for (let i = 0; i < count; i++) {
    const ra = Math.random() * 360;
    const dec = Math.asin(2 * Math.random() - 1) * Astronomy.DEG;
    const mag = 3 + Math.random() * 5;
    const temp = Math.random();
    let color;
    if (temp < 0.15) color = '#ffaa77';
    else if (temp < 0.3) color = '#ffd4a0';
    else if (temp < 0.7) color = '#ffffff';
    else if (temp < 0.85) color = '#cce0ff';
    else color = '#99bbff';
    S.fieldStars.push({ ra, dec, mag, color, twinklePhase: Math.random() * Math.PI * 2 });
  }
}

// ══════ DOM REFS ══════
const $ = id => document.getElementById(id);
let canvas, ctx, miniCanvas, miniCtx;

// ══════ RENDERING ══════
function renderSky() {
  if (!canvas) return;
  const W = canvas.width = canvas.clientWidth;
  const H = canvas.height = canvas.clientHeight;
  if (W === 0 || H === 0) return;

  const jd = Astronomy.julianDate();
  const lst = Astronomy.localSiderealTime(jd, S.lon);
  const tf = Astronomy.twilightFactor(jd, S.lat, S.lon);

  // Sky gradient based on sun position
  if (tf > 0.5) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, `rgba(40,80,160,${tf * 0.6})`);
    g.addColorStop(0.5, `rgba(120,160,220,${tf * 0.4})`);
    g.addColorStop(1, `rgba(200,180,140,${tf * 0.5})`);
    ctx.fillStyle = g;
  } else if (tf > 0.1) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, `rgba(10,15,40,${1 - tf})`);
    g.addColorStop(1, `rgba(40,30,50,${tf * 2})`);
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = '#050810';
  }
  ctx.fillRect(0, 0, W, H);

  const scale = W / (120 / S.zoom);
  const nightFactor = Math.max(0, 1 - tf * 1.5);
  const now = performance.now() / 1000;

  // Helper: alt/az to screen xy
  function toScreen(objAz, objAlt) {
    let daz = objAz - S.az;
    if (daz > 180) daz -= 360;
    if (daz < -180) daz += 360;
    const x = W / 2 + daz * scale;
    const y = H / 2 - (objAlt - S.alt) * scale;
    return { x, y, visible: x > -20 && x < W + 20 && y > -20 && y < H + 20 };
  }

  // Grid
  if (S.show.grid && nightFactor > 0.2) {
    ctx.strokeStyle = `rgba(60,80,120,${0.12 * nightFactor})`;
    ctx.lineWidth = 0.5;
    for (let a = 0; a <= 360; a += 15) {
      const p1 = toScreen(a, 0), p2 = toScreen(a, 90);
      if (Math.abs(a - S.az) < 80 || Math.abs(a - S.az + 360) < 80 || Math.abs(a - S.az - 360) < 80) {
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
      }
    }
    for (let al = 0; al <= 90; al += 10) {
      const pts = [];
      for (let a = S.az - 70; a <= S.az + 70; a += 2) {
        pts.push(toScreen(a, al));
      }
      ctx.beginPath();
      pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
      ctx.stroke();
    }
    // Labels
    if (S.show.labels) {
      ctx.font = '9px JetBrains Mono';
      ctx.fillStyle = `rgba(90,120,160,${0.4 * nightFactor})`;
      for (let a = 0; a <= 360; a += 30) {
        const p = toScreen(a, 0);
        if (p.visible) ctx.fillText(a + '°', p.x + 2, p.y - 3);
      }
    }
  }

  // Milky Way glow
  if (S.show.milkyway && nightFactor > 0.3) {
    const mwPts = Astronomy.milkyWayPoints();
    mwPts.forEach(mp => {
      const h = Astronomy.equatorialToHorizontal(mp.ra, mp.dec, S.lat, lst);
      if (h.alt < -5) return;
      const p = toScreen(h.az, h.alt);
      if (!p.visible) return;
      const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 40 * S.zoom);
      grd.addColorStop(0, `rgba(120,140,180,${0.06 * nightFactor})`);
      grd.addColorStop(1, 'transparent');
      ctx.fillStyle = grd;
      ctx.fillRect(p.x - 40, p.y - 40, 80, 80);
    });
  }

  // Field stars (random faint ones)
  if (nightFactor > 0.2) {
    S.fieldStars.forEach(star => {
      const h = Astronomy.equatorialToHorizontal(star.ra, star.dec, S.lat, lst);
      if (h.alt < -2) return;
      const p = toScreen(h.az, h.alt);
      if (!p.visible) return;
      const twinkle = 0.5 + 0.5 * Math.sin(now * 1.5 + star.twinklePhase);
      const bright = Math.max(0.1, (8 - star.mag) / 8) * nightFactor * twinkle;
      const size = Math.max(0.5, (7 - star.mag) / 4) * Math.min(S.zoom, 3);
      ctx.globalAlpha = bright * 0.8;
      ctx.fillStyle = star.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  // Catalogue stars
  const starPositions = [];
  Astronomy.STARS.forEach(s => {
    const [name, ra, dec, mag, spec, con] = s;
    if (mag > 6) return;
    const h = Astronomy.equatorialToHorizontal(ra, dec, S.lat, lst);
    if (h.alt < -2) return;
    const p = toScreen(h.az, h.alt);
    if (!p.visible) return;
    const bright = Math.max(0.2, (7 - mag) / 7) * nightFactor;
    const size = Math.max(1, (6 - mag) / 2.5) * Math.min(S.zoom, 4);
    // Star color from spectral type
    let color = '#f0f4ff';
    if (spec && spec[0] === 'O') color = '#aaccff';
    else if (spec && spec[0] === 'B') color = '#bbddff';
    else if (spec && spec[0] === 'A') color = '#ffffff';
    else if (spec && spec[0] === 'F') color = '#fff8e0';
    else if (spec && spec[0] === 'G') color = '#ffe8a0';
    else if (spec && spec[0] === 'K') color = '#ffbb70';
    else if (spec && spec[0] === 'M') color = '#ff8866';
    ctx.globalAlpha = bright;
    // Glow for bright stars
    if (mag < 2 && nightFactor > 0.3) {
      const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size * 4);
      grd.addColorStop(0, color);
      grd.addColorStop(1, 'transparent');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(p.x, p.y, size * 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(p.x, p.y, size, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    starPositions.push({ name, x: p.x, y: p.y, mag, az: h.az, alt: h.alt, ra, dec, spec, constellation: con });
    // Labels
    if (S.show.labels && mag < 2.5 && nightFactor > 0.3 && S.zoom >= 0.8) {
      ctx.font = '10px JetBrains Mono';
      ctx.fillStyle = `rgba(200,220,240,${0.6 * nightFactor})`;
      ctx.fillText(name, p.x + size + 4, p.y + 3);
    }
  });

  // Constellation lines
  if (S.show.constellations && nightFactor > 0.3) {
    ctx.strokeStyle = `rgba(100,140,200,${0.15 * nightFactor})`;
    ctx.lineWidth = 1;
    Astronomy.CONSTELLATION_LINES.forEach(([s1, s2]) => {
      const p1 = starPositions.find(s => s.name === s1);
      const p2 = starPositions.find(s => s.name === s2);
      if (p1 && p2) {
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
      }
    });
  }

  // Planets
  if (S.show.planets && nightFactor > 0) {
    Object.entries(Astronomy.PLANETS).forEach(([key, p]) => {
      const pos = Astronomy.planetPosition(key, jd);
      if (!pos) return;
      const h = Astronomy.equatorialToHorizontal(pos.ra, pos.dec, S.lat, lst);
      if (h.alt < -2) return;
      const pt = toScreen(h.az, h.alt);
      if (!pt.visible) return;
      const size = Math.max(3, (8 - (pos.magnitude || 0)) / 2) * Math.min(S.zoom, 3);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0.5, nightFactor);
      ctx.beginPath(); ctx.arc(pt.x, pt.y, size, 0, Math.PI * 2); ctx.fill();
      // Glow
      const grd = ctx.createRadialGradient(pt.x, pt.y, size, pt.x, pt.y, size * 3);
      grd.addColorStop(0, p.color + '40'); grd.addColorStop(1, 'transparent');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, size * 3, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      if (S.show.labels) {
        ctx.font = '11px JetBrains Mono';
        ctx.fillStyle = p.color;
        ctx.fillText(p.symbol + ' ' + p.name, pt.x + size + 5, pt.y + 4);
      }
    });
    // Sun indicator (if above horizon)
    const sun = Astronomy.sunPosition(jd);
    const sh = Astronomy.equatorialToHorizontal(sun.ra, sun.dec, S.lat, lst);
    if (sh.alt > -5) {
      const sp = toScreen(sh.az, sh.alt);
      if (sp.visible) {
        const grd = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, 30);
        grd.addColorStop(0, 'rgba(255,220,100,0.8)'); grd.addColorStop(1, 'transparent');
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.arc(sp.x, sp.y, 30, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffe060';
        ctx.beginPath(); ctx.arc(sp.x, sp.y, 8, 0, Math.PI * 2); ctx.fill();
        if (S.show.labels) {
          ctx.font = '11px JetBrains Mono'; ctx.fillStyle = '#ffe060';
          ctx.fillText('☀ Sun', sp.x + 14, sp.y + 4);
        }
      }
    }
    // Moon
    const moon = Astronomy.moonPosition(jd);
    const mh = Astronomy.equatorialToHorizontal(moon.ra, moon.dec, S.lat, lst);
    if (mh.alt > -2) {
      const mp = toScreen(mh.az, mh.alt);
      if (mp.visible) {
        ctx.fillStyle = '#e8e0d0';
        ctx.beginPath(); ctx.arc(mp.x, mp.y, 6 * Math.min(S.zoom, 3), 0, Math.PI * 2); ctx.fill();
        if (S.show.labels) {
          ctx.font = '11px JetBrains Mono'; ctx.fillStyle = '#e8e0d0';
          ctx.fillText('☽ Moon', mp.x + 12, mp.y + 4);
        }
      }
    }
  }

  // DSO markers
  Astronomy.DSO.forEach(d => {
    const h = Astronomy.equatorialToHorizontal(d.ra, d.dec, S.lat, lst);
    if (h.alt < 0) return;
    const p = toScreen(h.az, h.alt);
    if (!p.visible) return;
    const bright = nightFactor * 0.6;
    if (bright < 0.1) return;
    ctx.globalAlpha = bright;
    ctx.fillStyle = d.type === 'galaxy' ? '#8080d0' : d.type === 'nebula' ? '#d08080' : '#80c0a0';
    const sz = Math.max(2, (10 - d.mag) / 3) * Math.min(S.zoom, 3);
    if (d.type === 'galaxy') {
      ctx.beginPath(); ctx.ellipse(p.x, p.y, sz * 1.5, sz, 0.5, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(p.x, p.y, sz, 0, Math.PI * 2); ctx.fill();
    }
    if (S.show.labels && d.mag < 8 && S.zoom >= 1) {
      ctx.font = '9px JetBrains Mono';
      ctx.fillStyle = `rgba(180,180,220,${bright})`;
      ctx.fillText(d.id + ' ' + d.name, p.x + sz + 4, p.y + 3);
    }
    ctx.globalAlpha = 1;
  });

  // Horizon line
  const hl = toScreen(S.az, 0);
  if (hl.y > 0 && hl.y < H) {
    ctx.strokeStyle = `rgba(80,120,60,${0.3 * nightFactor})`;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(0, hl.y); ctx.lineTo(W, hl.y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = '9px JetBrains Mono'; ctx.fillStyle = 'rgba(80,120,60,0.5)';
    ctx.fillText('HORIZON', 8, hl.y - 4);
  }

  // Render mini-map
  renderMiniMap(jd, lst, nightFactor);

  S.animFrame = requestAnimationFrame(renderSky);
}

// ══════ MINI-MAP ══════
function renderMiniMap(jd, lst, nightFactor) {
  if (!miniCanvas) return;
  const W = 160, H = 160;
  miniCtx.fillStyle = '#050810';
  miniCtx.fillRect(0, 0, W, H);
  // All-sky projection (azimuthal)
  function miniProject(az, alt) {
    const r = (90 - alt) / 90 * (W / 2 - 5);
    const a = (az - 180) * Astronomy.RAD;
    return { x: W / 2 + r * Math.sin(a), y: H / 2 - r * Math.cos(a) };
  }
  // Horizon circle
  miniCtx.strokeStyle = 'rgba(60,80,100,0.4)';
  miniCtx.lineWidth = 1;
  miniCtx.beginPath(); miniCtx.arc(W / 2, H / 2, W / 2 - 5, 0, Math.PI * 2); miniCtx.stroke();
  // Stars on mini-map
  Astronomy.STARS.forEach(s => {
    if (s[3] > 3.5) return;
    const h = Astronomy.equatorialToHorizontal(s[1], s[2], S.lat, lst);
    if (h.alt < 0) return;
    const p = miniProject(h.az, h.alt);
    const sz = Math.max(0.8, (4 - s[3]) / 2);
    miniCtx.fillStyle = `rgba(200,220,255,${(4 - s[3]) / 5 * nightFactor})`;
    miniCtx.beginPath(); miniCtx.arc(p.x, p.y, sz, 0, Math.PI * 2); miniCtx.fill();
  });
  // Planets on mini-map
  Object.entries(Astronomy.PLANETS).forEach(([key, pl]) => {
    const pos = Astronomy.planetPosition(key, jd);
    if (!pos) return;
    const h = Astronomy.equatorialToHorizontal(pos.ra, pos.dec, S.lat, lst);
    if (h.alt < 0) return;
    const p = miniProject(h.az, h.alt);
    miniCtx.fillStyle = pl.color;
    miniCtx.beginPath(); miniCtx.arc(p.x, p.y, 2, 0, Math.PI * 2); miniCtx.fill();
  });
  // Viewport indicator
  const fovDeg = 120 / S.zoom;
  const c = miniProject(S.az, S.alt);
  const halfFov = (fovDeg / 180) * (W / 2 - 5);
  miniCtx.strokeStyle = 'rgba(212,168,67,0.7)';
  miniCtx.lineWidth = 1.5;
  miniCtx.strokeRect(c.x - halfFov / 2, c.y - halfFov / 2, halfFov, halfFov);
  // Cardinal points
  miniCtx.font = '8px JetBrains Mono'; miniCtx.fillStyle = 'rgba(150,170,200,0.6)';
  miniCtx.textAlign = 'center';
  miniCtx.fillText('N', W / 2, 10);
  miniCtx.fillText('S', W / 2, H - 3);
  miniCtx.fillText('E', 7, H / 2 + 3);
  miniCtx.fillText('W', W - 7, H / 2 + 3);
  miniCtx.textAlign = 'start';
}

// ══════ UI UPDATES ══════
function updateUI() {
  const jd = Astronomy.julianDate();
  // UTC time
  const now = new Date();
  $('live-time').textContent = now.toUTCString().slice(17, 25) + ' UTC';
  // Local time (approximate via longitude offset)
  const tzOffset = Math.round(S.lon / 15);
  const localH = (now.getUTCHours() + tzOffset + 24) % 24;
  const localM = now.getUTCMinutes();
  $('local-time-display').textContent = String(localH).padStart(2, '0') + ':' + String(localM).padStart(2, '0');
  // Day/Night indicator
  const tf = Astronomy.twilightFactor(jd, S.lat, S.lon);
  const dnBadge = $('day-night-indicator');
  if (tf > 0.5) { dnBadge.textContent = '☀ Day'; dnBadge.className = 'day-night-badge day'; }
  else if (tf > 0.1) { dnBadge.textContent = '🌅 Twilight'; dnBadge.className = 'day-night-badge twilight'; }
  else { dnBadge.textContent = '🌙 Night'; dnBadge.className = 'day-night-badge night'; }
  // Scope info
  const sc = SCOPES[S.scope];
  if (sc) {
    const mag = (sc.fl / S.eyepiece) * (S.barlow ? 2 : 1);
    const fov = 60 / mag;
    const ep = sc.ap / mag;
    $('spec-type').textContent = sc.type;
    $('spec-aperture').textContent = sc.ap >= 1000 ? (sc.ap / 1000) + 'm' : sc.ap + 'mm';
    $('spec-fl').textContent = sc.fl >= 1000 ? (sc.fl / 1000).toFixed(1) + 'm' : sc.fl + 'mm';
    $('spec-maxmag').textContent = sc.maxMag + '×';
    $('spec-limmag').textContent = (2.7 + 5 * Math.log10(sc.ap)).toFixed(1);
    $('spec-res').textContent = (116 / sc.ap).toFixed(2) + '″';
    $('spec-light').textContent = Math.round(Math.pow(sc.ap / 7, 2)) + '×';
    $('mag-val').textContent = Math.round(mag) + '×';
    $('fov-val').textContent = fov.toFixed(2) + '°';
    $('exit-pupil').textContent = ep.toFixed(1) + 'mm';
  }
  // Visible objects list
  const lst = Astronomy.localSiderealTime(jd, S.lon);
  const objList = $('obj-list');
  const items = [];
  Astronomy.DSO.forEach(d => {
    const h = Astronomy.equatorialToHorizontal(d.ra, d.dec, S.lat, lst);
    if (h.alt > 10) items.push({ name: d.name, type: d.type, alt: h.alt, id: d.id, emoji: d.emoji });
  });
  Object.entries(Astronomy.PLANETS).forEach(([key, pl]) => {
    const pos = Astronomy.planetPosition(key, jd);
    if (!pos) return;
    const h = Astronomy.equatorialToHorizontal(pos.ra, pos.dec, S.lat, lst);
    if (h.alt > 5) items.push({ name: pl.name, type: 'planet', alt: h.alt, id: pl.symbol, emoji: pl.symbol });
  });
  items.sort((a, b) => b.alt - a.alt);
  objList.innerHTML = items.slice(0, 10).map(o =>
    `<div class="obj-item" data-name="${o.name}"><span class="obj-name">${o.emoji || '·'} ${o.name}</span><span class="obj-type">${o.type}</span><span class="obj-alt">${Math.round(o.alt)}°</span></div>`
  ).join('');
  // Bortle dots
  const dots = $('bortle-dots');
  const bortle = parseInt($('bortle-val').textContent) || 5;
  dots.innerHTML = Array.from({ length: 9 }, (_, i) =>
    `<div class="bortle-dot${i < bortle ? ' active' : ''}"></div>`
  ).join('');
  // DYK facts
  const facts = [
    'The Andromeda Galaxy is 2.5 million light-years away but visible to the naked eye.',
    'A neutron star\'s density: a teaspoon weighs about 6 billion tons.',
    'Betelgeuse is so large that if it replaced our Sun, it would engulf Mars.',
    'Light from the Sun takes 8 minutes 20 seconds to reach Earth.',
    'The Milky Way contains between 100 and 400 billion stars.',
    'Saturn\'s rings are mostly water ice particles, from tiny grains to house-sized.',
    'Polaris is currently within ~0.7° of the true north celestial pole.',
    'The Pleiades cluster contains over 1,000 confirmed members.',
  ];
  $('dyk-text').textContent = facts[Math.floor(now.getMinutes() / 8) % facts.length];
}

// ══════ BORTLE CLASS by location type ══════
function getBortle(name) {
  name = name.toLowerCase();
  if (name.includes('alma') || name.includes('namibrand') || name.includes('atacama') || name.includes('warrumbungle') || name.includes('nobeyama'))
    return [1, 'Pristine Dark Site'];
  if (name.includes('mauna kea') || name.includes('white sands') || name.includes('siding spring') || name.includes('oukaïmeden'))
    return [2, 'Excellent Dark Site'];
  if (name.includes('roque') || name.includes('teide') || name.includes('mcdonald'))
    return [3, 'Rural Sky'];
  if (name.includes('observatory'))
    return [4, 'Rural/Suburban'];
  if (name.includes('cape town') || name.includes('stockholm') || name.includes('ottawa') || name.includes('athens'))
    return [6, 'Bright Suburban'];
  if (name.includes('london') || name.includes('paris') || name.includes('rome') || name.includes('berlin') || name.includes('rio') || name.includes('mexico') || name.includes('jerusalem') || name.includes('seoul') || name.includes('cairo'))
    return [7, 'Suburban/Urban'];
  if (name.includes('new york') || name.includes('tokyo') || name.includes('hong kong') || name.includes('singapore') || name.includes('los angeles') || name.includes('sydney') || name.includes('moscow'))
    return [8, 'City Sky'];
  return [5, 'Suburban Sky'];
}

// ══════ INIT ══════
function init() {
  canvas = $('sky-canvas');
  ctx = canvas.getContext('2d');
  miniCanvas = $('mini-map');
  miniCtx = miniCanvas.getContext('2d');

  generateFieldStars(800);

  // Navigation
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.app-section').forEach(s => s.classList.remove('active'));
      const sec = $('section-' + btn.dataset.section);
      if (sec) sec.classList.add('active');
      // Lazy-init pages
      if (btn.dataset.section === 'telescope-lab') StellarisPages.initTelescopeLab();
      if (btn.dataset.section === 'constellations') StellarisPages.initConstellations(navigateToConstellation);
      if (btn.dataset.section === 'skymap') StellarisPages.initAladinLite();
    });
  });

  // Location select
  $('location-select').addEventListener('change', e => {
    const parts = e.target.value.split(',');
    S.lat = parseFloat(parts[0]); S.lon = parseFloat(parts[1]);
    S.locName = parts[2]; S.locCountry = parts[3];
    $('coord-lat').textContent = Math.abs(S.lat).toFixed(2) + '° ' + (S.lat >= 0 ? 'N' : 'S');
    $('coord-lon').textContent = Math.abs(S.lon).toFixed(2) + '° ' + (S.lon >= 0 ? 'E' : 'W');
    const [b, d] = getBortle(S.locName);
    $('bortle-val').textContent = b;
    $('bortle-desc').textContent = d;
    generateFieldStars(800);
  });

  // Sliders
  const azSlider = $('az-slider'), altSlider = $('alt-slider'), zoomSlider = $('zoom-slider'), focusSlider = $('focus-slider');
  azSlider.addEventListener('input', () => { S.az = +azSlider.value; $('az-readout').textContent = S.az + '°'; });
  altSlider.addEventListener('input', () => { S.alt = +altSlider.value; $('alt-readout').textContent = S.alt + '°'; });
  zoomSlider.addEventListener('input', () => { S.zoom = +zoomSlider.value; $('zoom-readout').textContent = S.zoom.toFixed(1) + '×'; $('zoom-val-display').textContent = S.zoom.toFixed(1) + '×'; });
  focusSlider.addEventListener('input', () => {
    S.focus = +focusSlider.value;
    const quality = 1 - Math.abs(S.focus - 50) / 50;
    const ep = $('focus-ep');
    if (ep) ep.style.left = (S.focus / 100 * 70) + 'px';
    $('focus-readout').textContent = quality > 0.9 ? 'Optimal Focus' : quality > 0.6 ? 'Near Focus' : 'Defocused';
    const fql = $('fq-label');
    if (quality > 0.9) { fql.textContent = '⬤ In Focus'; fql.style.color = 'var(--success)'; }
    else if (quality > 0.6) { fql.textContent = '◐ Near Focus'; fql.style.color = 'var(--warning)'; }
    else { fql.textContent = '○ Defocused'; fql.style.color = 'var(--danger)'; }
  });

  // Step buttons
  $('az-left').addEventListener('click', () => { S.az = (S.az - 5 + 360) % 360; azSlider.value = S.az; $('az-readout').textContent = S.az + '°'; });
  $('az-right').addEventListener('click', () => { S.az = (S.az + 5) % 360; azSlider.value = S.az; $('az-readout').textContent = S.az + '°'; });
  $('alt-down').addEventListener('click', () => { S.alt = Math.max(0, S.alt - 5); altSlider.value = S.alt; $('alt-readout').textContent = S.alt + '°'; });
  $('alt-up').addEventListener('click', () => { S.alt = Math.min(90, S.alt + 5); altSlider.value = S.alt; $('alt-readout').textContent = S.alt + '°'; });
  $('zoom-out').addEventListener('click', () => { S.zoom = Math.max(1, S.zoom - 0.5); zoomSlider.value = S.zoom; $('zoom-readout').textContent = S.zoom.toFixed(1) + '×'; $('zoom-val-display').textContent = S.zoom.toFixed(1) + '×'; });
  $('zoom-in').addEventListener('click', () => { S.zoom = Math.min(20, S.zoom + 0.5); zoomSlider.value = S.zoom; $('zoom-readout').textContent = S.zoom.toFixed(1) + '×'; $('zoom-val-display').textContent = S.zoom.toFixed(1) + '×'; });

  // Toggle buttons
  $('tog-constellations').addEventListener('click', function() { S.show.constellations = !S.show.constellations; this.classList.toggle('active'); });
  $('tog-labels').addEventListener('click', function() { S.show.labels = !S.show.labels; this.classList.toggle('active'); });
  $('tog-grid').addEventListener('click', function() { S.show.grid = !S.show.grid; this.classList.toggle('active'); });
  $('tog-milkyway').addEventListener('click', function() { S.show.milkyway = !S.show.milkyway; this.classList.toggle('active'); });
  $('tog-planets').addEventListener('click', function() { S.show.planets = !S.show.planets; this.classList.toggle('active'); });
  $('tog-tracking').addEventListener('click', function() {
    S.show.tracking = !S.show.tracking;
    this.classList.toggle('active');
    if (S.show.tracking) {
      S.trackingInterval = setInterval(() => {
        S.az = (S.az + 0.25) % 360;
        azSlider.value = S.az;
        $('az-readout').textContent = Math.round(S.az) + '°';
      }, 1000);
    } else {
      clearInterval(S.trackingInterval);
    }
  });

  // Telescope selection
  document.querySelectorAll('.scope-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.scope-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      S.scope = card.dataset.scope;
      updateUI();
    });
  });

  // Eyepiece selection
  document.querySelectorAll('.ep-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.ep-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (btn.dataset.ep === 'barlow') { S.barlow = !S.barlow; }
      else { S.eyepiece = +btn.dataset.ep; }
      updateUI();
    });
  });

  // Mini-map click to navigate
  miniCanvas.addEventListener('click', e => {
    const rect = miniCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const dx = x - 80, dy = y - 80;
    const r = Math.sqrt(dx * dx + dy * dy);
    if (r > 75) return;
    S.az = ((Math.atan2(dx, -dy) * Astronomy.DEG) + 180 + 360) % 360;
    S.alt = Math.max(0, 90 - (r / 75) * 90);
    azSlider.value = S.az; altSlider.value = S.alt;
    $('az-readout').textContent = Math.round(S.az) + '°';
    $('alt-readout').textContent = Math.round(S.alt) + '°';
  });

  // Catalogue
  buildCatalogue();
  $('cat-search').addEventListener('input', () => buildCatalogue($('cat-search').value));
  document.querySelectorAll('.cat-filter').forEach(f => {
    f.addEventListener('click', () => {
      document.querySelectorAll('.cat-filter').forEach(b => b.classList.remove('active'));
      f.classList.add('active');
      buildCatalogue($('cat-search').value, f.dataset.type);
    });
  });

  // Mouse drag on canvas
  let dragging = false, dragStart = {};
  canvas.addEventListener('mousedown', e => { dragging = true; dragStart = { x: e.clientX, y: e.clientY, az: S.az, alt: S.alt }; });
  window.addEventListener('mousemove', e => {
    if (!dragging) return;
    const scale = canvas.clientWidth / (120 / S.zoom);
    S.az = (dragStart.az - (e.clientX - dragStart.x) / scale + 360) % 360;
    S.alt = Math.max(0, Math.min(90, dragStart.alt + (e.clientY - dragStart.y) / scale));
    azSlider.value = S.az; altSlider.value = S.alt;
    $('az-readout').textContent = Math.round(S.az) + '°';
    $('alt-readout').textContent = Math.round(S.alt) + '°';
  });
  window.addEventListener('mouseup', () => { dragging = false; });

  // Mouse wheel zoom
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    S.zoom = Math.max(1, Math.min(20, S.zoom + (e.deltaY < 0 ? 0.3 : -0.3)));
    zoomSlider.value = S.zoom;
    $('zoom-readout').textContent = S.zoom.toFixed(1) + '×';
    $('zoom-val-display').textContent = S.zoom.toFixed(1) + '×';
  }, { passive: false });

  // Scope diagram
  drawScopeDiagram();

  // Start
  updateUI();
  setInterval(updateUI, 5000);
  renderSky();

  // Loading screen
  setTimeout(() => {
    const ls = $('loading-screen');
    if (ls) { ls.classList.add('fade-out'); setTimeout(() => ls.remove(), 1000); }
  }, 2600);
}

// ══════ CATALOGUE ══════
function buildCatalogue(search, filter) {
  search = (search || '').toLowerCase();
  filter = filter || 'all';
  const grid = $('catalogue-grid');
  grid.innerHTML = Astronomy.DSO
    .filter(d => {
      if (filter !== 'all' && d.type !== filter) return false;
      if (search && !d.name.toLowerCase().includes(search) && !d.id.toLowerCase().includes(search)) return false;
      return true;
    })
    .map(d => `
      <div class="cat-card">
        <div class="cat-card-img">${d.emoji || '⭐'}</div>
        <div class="cat-card-body">
          <div class="cat-card-name">${d.name}</div>
          <div class="cat-card-altname">${d.id} · ${d.dist}</div>
          <div class="cat-card-meta">
            <div class="cat-meta-item"><span>Type </span><span>${d.type}</span></div>
            <div class="cat-meta-item"><span>Mag </span><span>${d.mag}</span></div>
            <div class="cat-meta-item"><span>Size </span><span>${d.size}</span></div>
          </div>
        </div>
      </div>
    `).join('');
}

// ══════ NAVIGATE TO CONSTELLATION ══════
function navigateToConstellation(name) {
  const con = Astronomy.CONSTELLATIONS.find(c => c.name === name);
  if (!con || !con.stars.length) return;
  const star = Astronomy.STARS.find(s => s[0] === con.stars[0]);
  if (!star) return;
  const jd = Astronomy.julianDate();
  const lst = Astronomy.localSiderealTime(jd, S.lon);
  const h = Astronomy.equatorialToHorizontal(star[1], star[2], S.lat, lst);
  S.az = h.az; S.alt = Math.max(10, h.alt);
  $('az-slider').value = S.az; $('alt-slider').value = S.alt;
  $('az-readout').textContent = Math.round(S.az) + '°';
  $('alt-readout').textContent = Math.round(S.alt) + '°';
  // Switch to observatory
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('[data-section="observatory"]').classList.add('active');
  document.querySelectorAll('.app-section').forEach(s => s.classList.remove('active'));
  $('section-observatory').classList.add('active');
}

// ══════ SCOPE DIAGRAM ══════
function drawScopeDiagram() {
  const c = $('scope-diagram');
  if (!c) return;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 220, 130);
  ctx.fillStyle = '#0a1020'; ctx.fillRect(0, 0, 220, 130);
  ctx.strokeStyle = '#304060'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(30, 30); ctx.lineTo(190, 50); ctx.lineTo(190, 80); ctx.lineTo(30, 100); ctx.closePath(); ctx.stroke();
  ctx.fillStyle = 'rgba(20,40,80,0.6)'; ctx.fill();
  ctx.fillStyle = '#1a3060';
  ctx.fillRect(185, 55, 25, 20);
  ctx.strokeRect(185, 55, 25, 20);
  ctx.fillStyle = 'rgba(100,180,255,0.15)';
  ctx.beginPath(); ctx.arc(30, 65, 30, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(100,180,255,0.3)'; ctx.stroke();
}

// ══════ KEYBOARD ══════
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  const step = e.shiftKey ? 15 : 5;
  switch (e.key) {
    case 'ArrowLeft': S.az = (S.az - step + 360) % 360; break;
    case 'ArrowRight': S.az = (S.az + step) % 360; break;
    case 'ArrowUp': S.alt = Math.min(90, S.alt + step); break;
    case 'ArrowDown': S.alt = Math.max(0, S.alt - step); break;
    case '+': case '=': S.zoom = Math.min(20, S.zoom + 0.5); break;
    case '-': S.zoom = Math.max(1, S.zoom - 0.5); break;
    default: return;
  }
  $('az-slider').value = S.az; $('alt-slider').value = S.alt; $('zoom-slider').value = S.zoom;
  $('az-readout').textContent = Math.round(S.az) + '°';
  $('alt-readout').textContent = Math.round(S.alt) + '°';
  $('zoom-readout').textContent = S.zoom.toFixed(1) + '×';
  $('zoom-val-display').textContent = S.zoom.toFixed(1) + '×';
});

// ══════ BOOT ══════
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

})();
