/**
 * STELLARIS — Main Application v2
 * Sky rendering, controls, navigation, mini-map
 */
(function() {
'use strict';

// ══════ CONFIG & ASSETS ══════
const TEXTURES = {
  milkyway: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/The_Milky_Way_Stretches_Across_the_Paranal_Sky.jpg/2048px-The_Milky_Way_Stretches_Across_the_Paranal_Sky.jpg',
  jupiter:  'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/jupiter.jpg',
  mars:     'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/mars_1k_color.jpg',
  moon:     'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/moon_1024.jpg'
};
const images = {};

function preloadAssets(callback) {
  let loaded = 0;
  const keys = Object.keys(TEXTURES);
  keys.forEach(k => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      images[k] = img;
      loaded++;
      if (loaded === keys.length) callback();
    };
    img.onerror = () => {
      console.warn(`Failed to load texture: ${k}`);
      loaded++; // Continue anyway
      if (loaded === keys.length) callback();
    };
    img.src = TEXTURES[k];
  });
}

// ══════ STATE ══════
const S = {
  lat: 51.5074, lon: -0.1278, locName: 'London', locCountry: 'UK',
  az: 180, alt: 45, zoom: 1, focus: 50,
  show: { constellations: true, labels: true, grid: true, eqgrid: false, milkyway: true, planets: true, atmosphere: true, satellites: true, eyepiece: true, tracking: false },
  scope: 'refractor80', eyepiece: 40, barlow: false,
  fieldStars: [], // random faint stars
  drawnObjects: [], selectedObject: null,
  animFrame: null, lastTime: 0, trackingInterval: null,
  satellites: [
    { name: 'ISS (Zarya)', ra0: 100, dec0: 20, spdRa: 2.5, spdDec: 1.2, mag: -2 },
    { name: 'Hubble (HST)', ra0: 45, dec0: -10, spdRa: 1.8, spdDec: -0.5, mag: 1 }
  ],
  backgroundImg: null,
  bgParams: { ra: 0, dec: 0, fov: 0 },
  bgLoading: false,
  lastMove: 0,
  lastLocationRefreshKey: ''
};

const SCOPES = {
  naked:        { name:'Naked Eye',         type:'Human Eye',            ap:7,   fl:17,   maxMag:1 },
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
  const mwPts = Astronomy.milkyWayPoints();
  let generated = 0;
  while (generated < count) {
    const ra = Math.random() * 360;
    const dec = Math.asin(2 * Math.random() - 1) * Astronomy.DEG;
    let minDist = 90;
    for (let p of mwPts) {
      let dx = Math.abs(p.ra - ra);
      if (dx > 180) dx = 360 - dx;
      const dy = p.dec - dec;
      const d = Math.sqrt(dx*dx + dy*dy);
      if (d < minDist) minDist = d;
    }
    const prob = Math.max(0.02, 1 - (minDist / 20));
    if (Math.random() > prob) continue;

    const mag = 4 + Math.random() * 5;
    const temp = Math.random();
    let color = '#ffffff';
    if (temp < 0.15) color = '#ffaa77';
    else if (temp < 0.3) color = '#ffd4a0';
    else if (temp < 0.7) color = '#ffffff';
    else if (temp < 0.85) color = '#cce0ff';
    else color = '#99bbff';
    S.fieldStars.push({ ra, dec, mag, color, twinklePhase: Math.random() * Math.PI * 2 });
    generated++;
  }
}

// ══════ DOM REFS ══════
const $ = id => document.getElementById(id);
let canvas, ctx, miniCanvas, miniCtx;

function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value;
}

function isSectionActive(id) {
  const section = $(id);
  return !!section && section.classList.contains('active');
}

function isObservatoryActive() {
  return isSectionActive('section-observatory');
}

function queueRender() {
  if (!canvas || !isObservatoryActive()) return;
  if (S.animFrame == null) {
    S.animFrame = requestAnimationFrame(renderSky);
  }
}

function getScopeStats() {
  const sc = SCOPES[S.scope];
  if (!sc) return null;

  if (S.scope === 'naked') {
    return {
      type: 'Human Eye',
      aperture: '7mm',
      focalLength: '17mm',
      maxMag: '1x',
      limitingMag: '6.0',
      resolving: '60″',
      lightGather: '1x',
      magnification: '1x',
      fov: '120°',
      exitPupil: '7.0mm'
    };
  }

  const mag = (sc.fl / S.eyepiece) * (S.barlow ? 2 : 1);
  const fov = 60 / mag;
  const exitPupil = sc.ap / mag;

  return {
    type: sc.type,
    aperture: sc.ap >= 1000 ? (sc.ap / 1000) + 'm' : sc.ap + 'mm',
    focalLength: sc.fl >= 1000 ? (sc.fl / 1000).toFixed(1) + 'm' : sc.fl + 'mm',
    maxMag: sc.maxMag + 'x',
    limitingMag: (2.7 + 5 * Math.log10(sc.ap)).toFixed(1),
    resolving: (116 / sc.ap).toFixed(2) + '″',
    lightGather: Math.round(Math.pow(sc.ap / 7, 2)) + 'x',
    magnification: Math.round(mag) + 'x',
    fov: fov.toFixed(2) + '°',
    exitPupil: exitPupil.toFixed(1) + 'mm',
    opticalZoom: Math.max(1, Math.min(200, 120 / fov)),
    vignetteSize: Math.min(100, (fov / (120 / Math.max(S.zoom, 1))) * 100)
  };
}

function applyScopeMetrics(forceZoomSync) {
  const stats = getScopeStats();
  if (!stats) return;

  setText('spec-type', stats.type);
  setText('spec-aperture', stats.aperture);
  setText('spec-fl', stats.focalLength);
  setText('spec-maxmag', stats.maxMag);
  setText('spec-limmag', stats.limitingMag);
  setText('spec-res', stats.resolving);
  setText('spec-light', stats.lightGather);
  setText('mag-val', stats.magnification);
  setText('fov-val', stats.fov);
  setText('exit-pupil', stats.exitPupil);

  if (forceZoomSync && stats.opticalZoom) {
    S.zoom = stats.opticalZoom;
    if ($('zoom-slider')) $('zoom-slider').value = S.zoom;
    setText('zoom-readout', S.zoom.toFixed(1) + 'x');
    setText('zoom-val-display', S.zoom.toFixed(1) + 'x');
  }

  const vignette = $('scope-vignette');
  if (vignette) {
    if (S.scope === 'naked') {
      vignette.style.background = 'none';
    } else {
      const stop = Math.max(10, (stats.vignetteSize || 50) / 2 * 0.9);
      vignette.style.background = `radial-gradient(circle at center, transparent ${stop}%, rgba(5,8,12,0.98) ${stop + 3}%)`;
    }
  }
}

// ══════ RENDERING ══════
function renderSky() {
  S.animFrame = null;
  if (!canvas || !isObservatoryActive()) return;
  const W = canvas.width = canvas.clientWidth;
  const H = canvas.height = canvas.clientHeight;
  if (W === 0 || H === 0) {
    setTimeout(() => {
      if (isObservatoryActive()) queueRender();
    }, 250);
    return;
  }

  const jd = Astronomy.julianDate();
  const lst = Astronomy.localSiderealTime(jd, S.lon);
  const tf = Astronomy.twilightFactor(jd, S.lat, S.lon);

  // Sky gradient based on sun position
  if (S.show.atmosphere && tf > 0.5) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, `rgba(40,80,160,${tf * 0.6})`);
    g.addColorStop(0.5, `rgba(120,160,220,${tf * 0.4})`);
    g.addColorStop(1, `rgba(200,180,140,${tf * 0.5})`);
    ctx.fillStyle = g;
  } else if (S.show.atmosphere && tf > 0.1) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, `rgba(10,15,40,${1 - tf})`);
    g.addColorStop(1, `rgba(40,30,50,${tf * 2})`);
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = '#050810';
  }
  ctx.fillRect(0, 0, W, H);

  S.drawnObjects = [];

  const scale = W / (120 / S.zoom);
  const rawNightFactor = Math.max(0, 1 - tf * 1.5);
  // If atmosphere is OFF, we act as if it's night for star visibility
  const renderFactor = S.show.atmosphere ? rawNightFactor : 1.0;
  const nightFactor = renderFactor;
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

  // Dynamic Background Cutout (photographic)
  if (S.backgroundImg) {
    const jd = Astronomy.julianDate();
    const lst = Astronomy.localSiderealTime(jd, S.lon);
    const h = Astronomy.equatorialToHorizontal(S.bgParams.ra, S.bgParams.dec, S.lat, lst);
    const p = toScreen(h.az, h.alt);
    const bgSize = (S.bgParams.fov / (120 / S.zoom)) * W;
    
    ctx.save();
    ctx.globalAlpha = 0.8 * renderFactor;
    ctx.translate(p.x, p.y);
    // Approximate rotation to match equatorial projection
    ctx.rotate(-(lst - 180) * Math.PI/180); 
    ctx.drawImage(S.backgroundImg, -bgSize/2, -bgSize/2, bgSize, bgSize);
    ctx.restore();
  }

  // Grid
  if (S.show.grid && renderFactor > 0.2) {
    ctx.strokeStyle = `rgba(60,80,120,${0.12 * renderFactor})`;
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
      ctx.fillStyle = `rgba(90,120,160,${0.4 * renderFactor})`;
      for (let a = 0; a <= 360; a += 30) {
        const p = toScreen(a, 0);
        if (p.visible) ctx.fillText(a + '°', p.x + 2, p.y - 3);
      }
    }
  }

  // Equatorial Grid
  if (S.show.eqgrid && renderFactor > 0.2) {
    ctx.strokeStyle = `rgba(140,90,140,${0.15 * renderFactor})`;
    ctx.lineWidth = 0.5;
    for (let d = -80; d <= 80; d += 20) {
      const pts = [];
      for (let r = 0; r <= 360; r += 2) {
        const h = Astronomy.equatorialToHorizontal(r, d, S.lat, lst);
        if (h.alt >= 0) pts.push(toScreen(h.az, h.alt));
        else pts.push(null);
      }
      ctx.beginPath();
      let drawing = false;
      pts.forEach((p) => {
        if (!p) { drawing = false; return; }
        if (!drawing) { ctx.moveTo(p.x, p.y); drawing = true; }
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
    }
    for (let r = 0; r < 360; r += 30) {
      const pts = [];
      for (let d = -80; d <= 80; d += 2) {
        const h = Astronomy.equatorialToHorizontal(r, d, S.lat, lst);
        if (h.alt >= 0) pts.push(toScreen(h.az, h.alt));
        else pts.push(null);
      }
      ctx.beginPath();
      let drawing = false;
      pts.forEach((p) => {
        if (!p) { drawing = false; return; }
        if (!drawing) { ctx.moveTo(p.x, p.y); drawing = true; }
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
    }
  }

  // Milky Way photographic panorama
  if (S.show.milkyway && nightFactor > 0.1 && images.milkyway) {
    ctx.save();
    ctx.globalAlpha = 0.4 * nightFactor * renderFactor;
    ctx.globalCompositeOperation = 'screen';
    
    // Draw Milky Way by tiling the equirectangular panorama
    const img = images.milkyway;
    const tileSteps = 15; // 15x15 deg tiles
    for (let r = 0; r < 360; r += tileSteps) {
      for (let d = -60; d <= 60; d += tileSteps) {
        // Find 4 corners of the celestial tile
        const h1 = Astronomy.equatorialToHorizontal(r, d, S.lat, lst);
        const h2 = Astronomy.equatorialToHorizontal(r + tileSteps, d, S.lat, lst);
        const h3 = Astronomy.equatorialToHorizontal(r + tileSteps, d + tileSteps, S.lat, lst);
        const h4 = Astronomy.equatorialToHorizontal(r, d + tileSteps, S.lat, lst);
        
        if (h1.alt < -10 && h2.alt < -10 && h3.alt < -10 && h4.alt < -10) continue;
        
        const p1 = toScreen(h1.az, h1.alt);
        const p2 = toScreen(h2.az, h2.alt);
        const p3 = toScreen(h3.az, h3.alt);
        const p4 = toScreen(h4.az, h4.alt);
        
        if (!p1.visible && !p2.visible && !p3.visible && !p4.visible) continue;

        // Simplified: Draw a triangle for each quad
        const sx = (r / 360) * img.width;
        const sy = ((90 - d) / 180) * img.height;
        const sw = (tileSteps / 360) * img.width;
        const sh = (tileSteps / 180) * img.height;

        ctx.drawImage(img, sx, sy - sh, sw, sh, p1.x, p1.y - (p1.y-p4.y), Math.abs(p2.x-p1.x), Math.abs(p1.y-p4.y));
      }
    }
    ctx.restore();
  }

  // Field stars (random faint ones)
  if (renderFactor > 0.2) {
    S.fieldStars.forEach(star => {
      const h = Astronomy.equatorialToHorizontal(star.ra, star.dec, S.lat, lst);
      if (h.alt < -2) return;
      const p = toScreen(h.az, h.alt);
      if (!p.visible) return;
      const twinkle = 0.5 + 0.5 * Math.sin(now * 1.5 + star.twinklePhase);
      const bright = Math.max(0.1, (8 - star.mag) / 8) * renderFactor * twinkle;
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
    const bright = Math.max(0.2, (7 - mag) / 7) * renderFactor;
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
    // Photographic Star Halos
    if (mag < 3.5 && renderFactor > 0.3) {
      const glowSize = size * (mag < 1 ? 12 : 6);
      const grd = ctx.createRadialGradient(p.x, p.y, size, p.x, p.y, glowSize);
      grd.addColorStop(0, color + '66'); // 40 hex is ~0.25 alpha, 66 is ~0.4
      grd.addColorStop(0.3, color + '22'); // faint outer bloom
      grd.addColorStop(1, 'transparent');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(p.x, p.y, glowSize, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(p.x, p.y, size, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    starPositions.push({ name, x: p.x, y: p.y, mag, az: h.az, alt: h.alt, ra, dec, spec, constellation: con });
    S.drawnObjects.push({ name, x: p.x, y: p.y, az: h.az, alt: h.alt, sz: size, type: 'Star', mag: mag });
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

      const texKeys = { 'jupiter': 'jupiter', 'saturn': 'saturn', 'mars': 'mars' };
      const img = images[texKeys[key]];
      
      let baseSize = Math.max(3, (8 - (pos.magnitude || 0)) / 2) * Math.min(S.zoom, 3);
      let angSize = (key === 'jupiter') ? 50 : (key === 'saturn') ? 55 : (key === 'mars') ? 20 : 10;
      let pxSize = (angSize / 3600) * scale * 30; // Exaggerate for telescope feel
      let size = Math.max(baseSize, pxSize);

      ctx.globalAlpha = Math.max(0.5, nightFactor);
      
      if (img && S.zoom > 15) {
        ctx.save();
        ctx.translate(pt.x, pt.y);
        ctx.beginPath(); ctx.arc(0, 0, size, 0, Math.PI * 2); ctx.clip();
        ctx.drawImage(img, -size, -size, size * 2, size * 2);
        ctx.restore();
        
        ctx.strokeStyle = `rgba(255,255,255,${Math.min(0.2, 10/S.zoom)})`;
        ctx.beginPath(); ctx.arc(pt.x,pt.y, size, 0, Math.PI * 2); ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, baseSize, 0, Math.PI * 2); ctx.fill();
      }
      
      S.drawnObjects.push({ name: p.name, x: pt.x, y: pt.y, az: h.az, alt: h.alt, sz: size, type: 'Planet', mag: pos.magnitude });
      if (S.show.labels) {
        ctx.font = '11px Inter';
        ctx.fillStyle = p.color;
        ctx.fillText(p.symbol + ' ' + p.name, pt.x + size + 5, pt.y + 4);
      }
    });

    // Moon
    const moon = Astronomy.moonPosition(jd);
    const mh = Astronomy.equatorialToHorizontal(moon.ra, moon.dec, S.lat, lst);
    if (mh.alt > -2) {
      const mp = toScreen(mh.az, mh.alt);
      if (mp.visible) {
        let moonSize = 15 * S.zoom;
        if (images.moon && S.zoom > 5) {
          ctx.save();
          ctx.translate(mp.x, mp.y);
          ctx.beginPath(); ctx.arc(0, 0, moonSize, 0, Math.PI * 2); ctx.clip();
          ctx.drawImage(images.moon, -moonSize, -moonSize, moonSize * 2, moonSize * 2);
          ctx.restore();
        } else {
          ctx.fillStyle = '#e8e0d0';
          ctx.beginPath(); ctx.arc(mp.x, mp.y, 6 * Math.min(S.zoom, 3), 0, Math.PI * 2); ctx.fill();
        }
        S.drawnObjects.push({ name: 'Moon', x: mp.x, y: mp.y, az: mh.az, alt: mh.alt, sz: moonSize, type: 'Moon', mag: -12.7 });
        if (S.show.labels) {
          ctx.font = '11px Inter'; ctx.fillStyle = '#e8e0d0';
          ctx.fillText('☽ Moon', mp.x + moonSize + 5, mp.y + 4);
        }
      }
    }
  }

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
      S.drawnObjects.push({ name: 'Sun', x: sp.x, y: sp.y, az: sh.az, alt: sh.alt, sz: 8, type: 'Star', mag: -26.7 });
      if (S.show.labels) {
        ctx.font = '11px Inter'; ctx.fillStyle = '#ffe060';
        ctx.fillText('☀ Sun', sp.x + 14, sp.y + 4);
      }
    }
  }

    // DSO markers
  Astronomy.DSO.forEach(d => {
    const h = Astronomy.equatorialToHorizontal(d.ra, d.dec, S.lat, lst);
    if (h.alt < 0) return;
    const p = toScreen(h.az, h.alt);
    if (!p.visible) return;
    const bright = Math.min(1, nightFactor * 0.8 + (S.zoom / 100));
    if (bright < 0.1) return;
    ctx.globalAlpha = bright;
    ctx.fillStyle = d.type === 'galaxy' ? '#8080d0' : d.type === 'nebula' ? '#d08080' : '#80c0a0';
    const baseSz = Math.max(2, (10 - d.mag) / 3);
    const sz = baseSz * Math.pow(S.zoom, 0.7);
    if (d.type === 'galaxy') {
      ctx.beginPath(); ctx.ellipse(p.x, p.y, sz * 1.5, sz, 0.5, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(p.x, p.y, sz, 0, Math.PI * 2); ctx.fill();
    }
    S.drawnObjects.push({ name: d.id + ' ' + d.name, x: p.x, y: p.y, az: h.az, alt: h.alt, sz: sz, type: d.type.charAt(0).toUpperCase() + d.type.slice(1), mag: d.mag });
    if (S.show.labels && d.mag < 8 && S.zoom >= 1) {
      ctx.font = '9px JetBrains Mono';
      ctx.fillStyle = `rgba(180,180,220,${bright})`;
      ctx.fillText(d.id + ' ' + d.name, p.x + sz + 4, p.y + 3);
    }
    ctx.globalAlpha = 1;
  });

  // Satellites
  if (S.show.satellites && nightFactor > 0.1) {
    const timeSec = now;
    S.satellites.forEach(sat => {
      let ra = (sat.ra0 + sat.spdRa * timeSec * 0.05) % 360;
      let dec = sat.dec0 + Math.sin(timeSec * 0.01 + sat.spdDec) * 40;
      const h = Astronomy.equatorialToHorizontal(ra, dec, S.lat, lst);
      if (h.alt < 5) return;
      const p = toScreen(h.az, h.alt);
      if (!p.visible) return;
      
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(p.x, p.y, Math.min(S.zoom, 2.5), 0, Math.PI * 2); ctx.fill();
      S.drawnObjects.push({ name: sat.name, x: p.x, y: p.y, az: h.az, alt: h.alt, sz: 3, type: 'Satellite', mag: sat.mag });
      
      if (S.show.labels && S.zoom >= 1) {
        ctx.font = '9px JetBrains Mono';
        ctx.fillStyle = 'rgba(200,255,200,0.8)';
        ctx.fillText(sat.name, p.x + 4, p.y - 4);
      }
    });
  }

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

  // Update tooltip for selected object
  if (S.selectedObject) {
    const obj = S.drawnObjects.find(o => o.name === S.selectedObject.name);
    if (obj) {
      const tip = $('sky-tooltip');
      tip.style.left = obj.x + 15 + 'px';
      tip.style.top = obj.y - 15 + 'px';
      tip.classList.remove('hidden');
      $('tip-coords').textContent = `Az: ${Math.round(obj.az)}° Alt: ${Math.round(obj.alt)}°`;
    } else {
      $('sky-tooltip').classList.add('hidden');
    }
  }

  queueRender();
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

function updateUI() {
  const jd = Astronomy.julianDate();
  const now = new Date();
  $('live-time').textContent = now.toUTCString().slice(17, 25) + ' UTC';

  $('location-select').querySelectorAll('option').forEach(opt => {
    const parts = opt.value.split(',');
    const lLat = parseFloat(parts[0]), lLon = parseFloat(parts[1]);
    const tf = Astronomy.twilightFactor(jd, lLat, lLon);
    const isDay = tf > 0.5;
    const lstOffset = Math.round(lLon / 15);
    const lH = (now.getUTCHours() + lstOffset + 24) % 24;
    const lM = String(now.getUTCMinutes()).padStart(2, '0');
    
    let baseText = opt.dataset.baseText || opt.textContent;
    if(!opt.dataset.baseText) opt.dataset.baseText = baseText;
    opt.textContent = `${isDay ? '☀️' : '🌙'} [${String(lH).padStart(2,'0')}:${lM}] ${baseText}`;
  });

  const tzOffset = Math.round(S.lon / 15);
  const localH = (now.getUTCHours() + tzOffset + 24) % 24;
  const localM = now.getUTCMinutes();
  $('local-time-display').textContent = String(localH).padStart(2, '0') + ':' + String(localM).padStart(2, '0');

  const tf = Astronomy.twilightFactor(jd, S.lat, S.lon);
  const dnBadge = $('day-night-indicator');
  if (tf > 0.5) { dnBadge.textContent = '☀ Day'; dnBadge.className = 'day-night-badge day'; }
  else if (tf > 0.1) { dnBadge.textContent = '🌅 Twilight'; dnBadge.className = 'day-night-badge twilight'; }
  else { dnBadge.textContent = '🌙 Night'; dnBadge.className = 'day-night-badge night'; }

  const sc = SCOPES[S.scope];
  if (sc) {
    if (S.scope === 'naked') {
      $('spec-type').textContent = 'Human Eye';
      $('spec-aperture').textContent = '7mm';
      $('spec-fl').textContent = '17mm';
      $('spec-maxmag').textContent = '1×';
      $('spec-limmag').textContent = '6.0';
      $('spec-res').textContent = '60″';
      $('spec-light').textContent = '1×';
      $('mag-val').textContent = '1×';
      $('fov-val').textContent = '120°';
      $('exit-pupil').textContent = '7.0mm';
      $('scope-vignette').style.background = 'none';
      S.zoom = 1.0;
      $('zoom-slider').value = 1.0;
      $('zoom-readout').textContent = '1.0×';
      $('zoom-val-display').textContent = '1.0×';
    } else {
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

      S.zoom = Math.max(1, Math.min(200, 120 / fov));
      $('zoom-slider').value = S.zoom;
      $('zoom-readout').textContent = S.zoom.toFixed(1) + '×';
      $('zoom-val-display').textContent = S.zoom.toFixed(1) + '×';

      const size = Math.min(100, (fov / (120/S.zoom)) * 100);
      $('scope-vignette').style.background = `radial-gradient(circle at center, transparent ${Math.max(10, size/2 * 0.9)}%, rgba(5,8,12,0.98) ${size/2 + 2}%)`;
    }
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

function updateUI() {
  const jd = Astronomy.julianDate();
  const now = new Date();
  setText('live-time', now.toUTCString().slice(17, 25) + ' UTC');

  const refreshKey = `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}-${now.getUTCHours()}-${now.getUTCMinutes()}`;
  if (S.lastLocationRefreshKey !== refreshKey) {
    const locationSelect = $('location-select');
    if (locationSelect) {
      locationSelect.querySelectorAll('option').forEach(opt => {
        const parts = opt.value.split(',');
        const lLat = parseFloat(parts[0]);
        const lLon = parseFloat(parts[1]);
        const tf = Astronomy.twilightFactor(jd, lLat, lLon);
        const lstOffset = Math.round(lLon / 15);
        const lH = (now.getUTCHours() + lstOffset + 24) % 24;
        const lM = String(now.getUTCMinutes()).padStart(2, '0');
        const baseText = opt.dataset.baseText || opt.textContent;
        if (!opt.dataset.baseText) opt.dataset.baseText = baseText;
        opt.textContent = `${tf > 0.5 ? '☀' : '🌙'} [${String(lH).padStart(2,'0')}:${lM}] ${baseText}`;
      });
    }
    S.lastLocationRefreshKey = refreshKey;
  }

  const tzOffset = Math.round(S.lon / 15);
  const localH = (now.getUTCHours() + tzOffset + 24) % 24;
  const localM = now.getUTCMinutes();
  setText('local-time-display', String(localH).padStart(2, '0') + ':' + String(localM).padStart(2, '0'));

  const tf = Astronomy.twilightFactor(jd, S.lat, S.lon);
  const dnBadge = $('day-night-indicator');
  if (dnBadge) {
    if (tf > 0.5) { dnBadge.textContent = '☀ Day'; dnBadge.className = 'day-night-badge day'; }
    else if (tf > 0.1) { dnBadge.textContent = '🌆 Twilight'; dnBadge.className = 'day-night-badge twilight'; }
    else { dnBadge.textContent = '🌙 Night'; dnBadge.className = 'day-night-badge night'; }
  }

  applyScopeMetrics(false);

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
  if (objList) {
    objList.innerHTML = items.slice(0, 10).map(o =>
      `<div class="obj-item" data-name="${o.name}"><span class="obj-name">${o.emoji || '·'} ${o.name}</span><span class="obj-type">${o.type}</span><span class="obj-alt">${Math.round(o.alt)}°</span></div>`
    ).join('');
  }

  const dots = $('bortle-dots');
  const bortleVal = $('bortle-val');
  const bortle = bortleVal ? parseInt(bortleVal.textContent) || 5 : 5;
  if (dots) {
    dots.innerHTML = Array.from({ length: 9 }, (_, i) =>
      `<div class="bortle-dot${i < bortle ? ' active' : ''}"></div>`
    ).join('');
  }

  const facts = [
    'The Andromeda Galaxy is 2.5 million light-years away but visible to the naked eye.',
    'A neutron star\'s density: a teaspoon weighs about 6 billion tons.',
    'Betelgeuse is so large that if it replaced our Sun, it would engulf Mars.',
    'Light from the Sun takes 8 minutes 20 seconds to reach Earth.',
    'The Milky Way contains between 100 and 400 billion stars.',
    'Saturn\'s rings are mostly water ice particles, from tiny grains to house-sized.',
    'Polaris is currently within ~0.7° of the true north celestial pole.',
    'The Pleiades cluster contains over 1,000 confirmed members.'
  ];
  setText('dyk-text', facts[Math.floor(now.getMinutes() / 8) % facts.length]);
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
  console.log("Stellaris: Initializing...");
  // FORCE HIDE LOADING
  const ls = document.getElementById('loading-screen');
  if (ls) { ls.style.display = 'none'; }

  if (typeof EXTRA_STARS !== 'undefined' && Array.isArray(EXTRA_STARS)) {
    console.log("Stellaris: Merging " + EXTRA_STARS.length + " stars...");
    Astronomy.STARS.push(...EXTRA_STARS);
  }
  
  canvas = document.getElementById('sky-canvas');
  if (!canvas) { console.error("Canvas not found!"); return; }
  ctx = canvas.getContext('2d');
  miniCanvas = document.getElementById('mini-map');
  miniCtx = miniCanvas ? miniCanvas.getContext('2d') : null;

  generateFieldStars(2000);

  // Navigation
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.app-section').forEach(s => s.classList.remove('active'));
      const sec = $('section-' + btn.dataset.section);
      if (sec) sec.classList.add('active');
      if (btn.dataset.section === 'telescope-lab') {
        StellarisPages.initTelescopeLab();
      } else if (btn.dataset.section === 'constellations') {
        StellarisPages.initConstellations(navigateToConstellation);
      } else if (btn.dataset.section === 'skymap' && typeof SkyMap !== 'undefined') {
        SkyMap.init();
      } else if (btn.dataset.section === 'observatory') {
        queueRender();
      }
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
    generateFieldStars(3000);
    updateUI();
    queueRender();
  });

  // Sliders
  const azSlider = $('az-slider'), altSlider = $('alt-slider'), zoomSlider = $('zoom-slider'), focusSlider = $('focus-slider');
  azSlider.addEventListener('input', () => { S.az = +azSlider.value; $('az-readout').textContent = S.az + '°'; });
  altSlider.addEventListener('input', () => { S.alt = +altSlider.value; $('alt-readout').textContent = S.alt + '°'; });
  zoomSlider.addEventListener('input', () => { S.zoom = +zoomSlider.value; $('zoom-readout').textContent = S.zoom.toFixed(1) + '×'; $('zoom-val-display').textContent = S.zoom.toFixed(1) + '×'; });
  azSlider.addEventListener('input', queueRender);
  altSlider.addEventListener('input', queueRender);
  zoomSlider.addEventListener('input', () => { applyScopeMetrics(false); queueRender(); });
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

  focusSlider.addEventListener('input', queueRender);

  // Step buttons (null-safe for new UI)
  if($('az-left')) $('az-left').addEventListener('click', () => { S.az = (S.az - 5 + 360) % 360; azSlider.value = S.az; $('az-readout').textContent = S.az + '°'; });
  if($('az-right')) $('az-right').addEventListener('click', () => { S.az = (S.az + 5) % 360; azSlider.value = S.az; $('az-readout').textContent = S.az + '°'; });
  if($('alt-down')) $('alt-down').addEventListener('click', () => { S.alt = Math.max(0, S.alt - 5); altSlider.value = S.alt; $('alt-readout').textContent = S.alt + '°'; });
  if($('alt-up')) $('alt-up').addEventListener('click', () => { S.alt = Math.min(90, S.alt + 5); altSlider.value = S.alt; $('alt-readout').textContent = S.alt + '°'; });
  if($('zoom-out')) $('zoom-out').addEventListener('click', () => { S.zoom = Math.max(1, S.zoom - 0.5); zoomSlider.value = S.zoom; $('zoom-readout').textContent = S.zoom.toFixed(1) + '×'; $('zoom-val-display').textContent = S.zoom.toFixed(1) + '×'; });
  if($('zoom-in')) $('zoom-in').addEventListener('click', () => { S.zoom = Math.min(20, S.zoom + 0.5); zoomSlider.value = S.zoom; $('zoom-readout').textContent = S.zoom.toFixed(1) + '×'; $('zoom-val-display').textContent = S.zoom.toFixed(1) + '×'; });

  // Toggle buttons
  const redraw = () => { queueRender(); };
  if($('az-left')) $('az-left').addEventListener('click', redraw);
  if($('az-right')) $('az-right').addEventListener('click', redraw);
  if($('alt-down')) $('alt-down').addEventListener('click', redraw);
  if($('alt-up')) $('alt-up').addEventListener('click', redraw);
  if($('zoom-out')) $('zoom-out').addEventListener('click', () => { applyScopeMetrics(false); redraw(); });
  if($('zoom-in')) $('zoom-in').addEventListener('click', () => { applyScopeMetrics(false); redraw(); });
  
  $('toggle-constellations').addEventListener('click', function() { S.show.constellations = !S.show.constellations; this.classList.toggle('active'); redraw(); });
  $('toggle-labels').addEventListener('click', function() { S.show.labels = !S.show.labels; this.classList.toggle('active'); redraw(); });
  $('toggle-grid').addEventListener('click', function() { S.show.grid = !S.show.grid; this.classList.toggle('active'); redraw(); });
  $('toggle-eqgrid').addEventListener('click', function() { S.show.eqgrid = !S.show.eqgrid; this.classList.toggle('active'); redraw(); });
  $('toggle-milkyway').addEventListener('click', function() { S.show.milkyway = !S.show.milkyway; this.classList.toggle('active'); redraw(); });
  $('toggle-planets').addEventListener('click', function() { S.show.planets = !S.show.planets; this.classList.toggle('active'); redraw(); });
  $('toggle-atmosphere').addEventListener('click', function() { S.show.atmosphere = !S.show.atmosphere; this.classList.toggle('active'); redraw(); });
  $('toggle-satellites').addEventListener('click', function() { S.show.satellites = !S.show.satellites; this.classList.toggle('active'); redraw(); });
  $('toggle-eyepiece').addEventListener('click', function() {
    S.show.eyepiece = !S.show.eyepiece;
    this.classList.toggle('active');
    if($('scope-vignette')) $('scope-vignette').style.display = S.show.eyepiece ? 'block' : 'none';
    if($('scope-ring-outer')) $('scope-ring-outer').style.display = S.show.eyepiece ? 'block' : 'none';
    if($('scope-ring-inner')) $('scope-ring-inner').style.display = S.show.eyepiece ? 'block' : 'none';
    if($('scope-crosshair-h')) $('scope-crosshair-h').style.display = S.show.eyepiece ? 'block' : 'none';
    if($('scope-crosshair-v')) $('scope-crosshair-v').style.display = S.show.eyepiece ? 'block' : 'none';
    redraw();
  });
  $('toggle-tracking').addEventListener('click', function() {
    S.show.tracking = !S.show.tracking;
    this.classList.toggle('active');
    if (S.show.tracking) {
      S.trackingInterval = setInterval(() => {
        S.az = (S.az + 0.0625) % 360;
        azSlider.value = S.az;
        $('az-readout').textContent = Math.round(S.az) + '°';
        redraw();
      }, 250);
    } else {
      clearInterval(S.trackingInterval);
      redraw();
    }
  });

  // Telescope selection
  document.querySelectorAll('.scope-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.scope-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      S.scope = card.dataset.scope;
      applyScopeMetrics(true);
      updateUI();
      redraw();
    });
  });

  // Eyepiece selection
  document.querySelectorAll('.ep-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.ep-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (btn.dataset.ep === 'barlow') { S.barlow = !S.barlow; }
      else { S.eyepiece = +btn.dataset.ep; }
      applyScopeMetrics(true);
      updateUI();
      redraw();
    });
  });

  // Mini-map click to navigate
  if (miniCanvas) miniCanvas.addEventListener('click', e => {
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
    redraw();
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

  if($('cat-modal-close')) {
    $('cat-modal-close').addEventListener('click', () => {
      $('cat-modal').style.display = 'none';
    });
  }

  // Mouse drag on canvas
  let dragging = false, dragStart = {};
  canvas.addEventListener('mousedown', e => { dragging = true; dragStart = { x: e.clientX, y: e.clientY, az: S.az, alt: S.alt }; });
  window.addEventListener('mousemove', e => {
    if (!dragging) return;
    const scale = canvas.clientWidth / (120 / S.zoom);
    S.az = (dragStart.az - (e.clientX - dragStart.x) / scale + 360) % 360;
    S.alt = Math.max(0, Math.min(90, dragStart.alt + (e.clientY - dragStart.y) / scale));
    S.lastMove = Date.now();
    azSlider.value = S.az; altSlider.value = S.alt;
    $('az-readout').textContent = Math.round(S.az) + '°';
    $('alt-readout').textContent = Math.round(S.alt) + '°';
  });
  window.addEventListener('mouseup', e => { 
    if (dragging) {
      const dx = Math.abs(e.clientX - dragStart.x);
      const dy = Math.abs(e.clientY - dragStart.y);
      if (dx < 3 && dy < 3 && e.target === canvas) {
        handleCanvasClick(e);
      }
    }
    dragging = false; 
  });

  // Mouse wheel zoom
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const zoomStep = S.zoom > 10 ? 2 : S.zoom > 5 ? 1 : 0.4;
    S.zoom = Math.max(1, Math.min(200, S.zoom + (e.deltaY < 0 ? zoomStep : -zoomStep)));
    zoomSlider.value = S.zoom;
    $('zoom-readout').textContent = S.zoom.toFixed(1) + '×';
    $('zoom-val-display').textContent = S.zoom.toFixed(1) + '×';
  }, { passive: false });

  canvas.addEventListener('wheel', () => {
    applyScopeMetrics(false);
    queueRender();
  }, { passive: false });

  // Scope diagram
  drawScopeDiagram();

  // Start
  applyScopeMetrics(true);
  updateUI();
  setInterval(updateUI, 1000);
  queueRender();
}

function handleCanvasClick(e) {
  const rect = canvas.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const clickY = e.clientY - rect.top;
  
  let closest = null;
  let minDist = Infinity;
  S.drawnObjects.forEach(obj => {
    const dx = clickX - obj.x;
    const dy = clickY - obj.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < Math.max(10, obj.sz + 5) && dist < minDist) {
      minDist = dist;
      closest = obj;
    }
  });

  if (closest) {
    S.selectedObject = closest;
    animateTo(closest.az, closest.alt);
    const tip = $('sky-tooltip');
    $('tip-name').textContent = closest.name;
    $('tip-type').textContent = closest.type;
    $('tip-mag').textContent = 'Mag ' + (closest.mag != null ? closest.mag.toFixed(1) : '-');
  } else {
    S.selectedObject = null;
    $('sky-tooltip').classList.add('hidden');
  }
}

function animateTo(targetAz, targetAlt) {
  const startAz = S.az;
  const startAlt = S.alt;
  let diffAz = targetAz - startAz;
  if (diffAz > 180) diffAz -= 360;
  if (diffAz < -180) diffAz += 360;
  const diffAlt = targetAlt - startAlt;
  
  const duration = 800;
  const start = performance.now();
  
  function step(now) {
    let t = (now - start) / duration;
    if (t > 1) t = 1;
    const ease = 1 - Math.pow(1 - t, 3);
    S.az = (startAz + diffAz * ease + 360) % 360;
    S.alt = startAlt + diffAlt * ease;
    
    $('az-slider').value = S.az; $('alt-slider').value = S.alt;
    $('az-readout').textContent = Math.round(S.az) + '°';
    $('alt-readout').textContent = Math.round(S.alt) + '°';
    
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ══════ CATALOGUE ══════
function buildCatalogue(search, filter) {
  search = (search || '').toLowerCase();
  filter = filter || 'all';
  const grid = $('catalogue-grid');
  
  const items = [...Astronomy.DSO];
  Object.entries(Astronomy.PLANETS).forEach(([k, p]) => {
     items.push({ name: p.name, id: p.symbol, type: 'planet', mag: p.magnitude||0, size: p.diameter||'varies', dist: p.distance||'varies', emoji: p.symbol, isPlanet: true });
  });

  const filtered = items.filter(d => {
      if (filter !== 'all' && d.type !== filter) return false;
      if (search && !(d.name||'').toLowerCase().includes(search) && !(d.id||'').toLowerCase().includes(search)) return false;
      return true;
    });

  if (filtered.length === 0 && search && search.trim().length >= 2) {
    grid.innerHTML = `
      <div style="text-align:center; padding: 2em; grid-column: 1/-1;">
        <p style="color:var(--text-dim); margin-bottom:1em;">No local objects found for "${search}".</p>
        <button id="btn-search-ext" class="toggle-btn active" style="padding:10px 20px;">🌐 Search Simbad Astro Database</button>
      </div>
    `;
    $('btn-search-ext').addEventListener('click', () => searchExternalAPI(search));
  } else {
    grid.innerHTML = filtered.map(d => `
      <div class="cat-card" data-name="${d.name}" data-type="${d.type}">
        <div class="cat-card-img">${d.emoji || '⭐'}</div>
        <div class="cat-card-body">
          <div class="cat-card-name">${d.name}</div>
          <div class="cat-card-altname">${d.id} · ${d.dist}</div>
          <div class="cat-meta-item"><span>Type </span><span>${d.type}</span></div>
          <div class="cat-meta-item"><span>Mag </span><span>${d.mag}</span></div>
        </div>
      </div>
    `).join('');
    
    grid.querySelectorAll('.cat-card').forEach(card => {
      card.addEventListener('click', () => {
         openObjModal(card.dataset.name, card.dataset.type);
      });
    });
  }
}

function searchExternalAPI(query) {
  const grid = $('catalogue-grid');
  grid.innerHTML = '<div style="text-align:center; padding: 2em; grid-column: 1/-1;"><i>Querying Strasbourg CDS Database...</i></div>';
  
  fetch(`https://cdsweb.u-strasbg.fr/cgi-bin/nph-sesame/-ox/I?${encodeURIComponent(query)}`)
    .then(r => r.text())
    .then(xmlStr => {
      const jradMatch = xmlStr.match(/<jrad>([^<]+)<\/jrad>/);
      const jdedMatch = xmlStr.match(/<jded>([^<]+)<\/jded>/);
      const errMatch = xmlStr.match(/<INFO>([^<]+)<\/INFO>/);
      
      if (jradMatch && jdedMatch) {
         const ra = parseFloat(jradMatch[1]);
         const dec = parseFloat(jdedMatch[1]);
         
         const jd = Astronomy.julianDate();
         const lst = Astronomy.localSiderealTime(jd, S.lon);
         const p = Astronomy.equatorialToHorizontal(ra, dec, S.lat, lst);
         
         // Add target permanently to drawn objects
         Astronomy.DSO.push({ id: query.toUpperCase(), name: 'External Target', ra: ra, dec: dec, mag: 5, type: 'Target', emoji: '🔭', size: '-', dist: '-' });
         
         S.az = p.az; 
         S.alt = Math.max(0, p.alt);
         
         $('az-slider').value = S.az; $('alt-slider').value = S.alt;
         
         document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
         document.querySelector('[data-section="observatory"]').classList.add('active');
         document.querySelectorAll('.app-section').forEach(s => s.classList.remove('active'));
         $('section-observatory').classList.add('active');
         
         S.selectedObject = { name: query.toUpperCase() + ' External Target', type: 'Target' };
         animateTo(S.az, S.alt);
         buildCatalogue(); // refresh catalog state
      } else {
         const msg = errMatch ? errMatch[1] : 'Object not found in CDS database.';
         grid.innerHTML = `<div style="text-align:center; padding: 2em; grid-column: 1/-1; color:var(--danger);">${msg}</div>`;
      }
    })
    .catch(err => {
      grid.innerHTML = `<div style="text-align:center; padding: 2em; grid-column: 1/-1; color:var(--danger);">Network error querying CDS API.</div>`;
    });
}

function openObjModal(name, type) {
  $('cat-modal-title').textContent = name;
  $('cat-modal-img').src = 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/M42_Hubble.jpg/800px-M42_Hubble.jpg';
  $('cat-modal-desc').innerHTML = '<i>Querying astronomical databases...</i>';
  $('cat-modal').style.display = 'flex';
  
  fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name.split(',')[0])}`)
    .then(r => r.json())
    .then(data => {
      if(data.thumbnail) $('cat-modal-img').src = data.thumbnail.source;
      if(data.extract) $('cat-modal-desc').textContent = data.extract;
      else $('cat-modal-desc').textContent = 'No detailed summary available in the primary database.';
    })
    .catch(() => {
      $('cat-modal-desc').textContent = 'Failed to load Wikipedia data.';
    });
    
  $('cat-modal-locate').onclick = () => {
    $('cat-modal').style.display = 'none';
    const jd = Astronomy.julianDate();
    let ra, dec;
    if(type === 'planet') {
       const key = Object.keys(Astronomy.PLANETS).find(k => Astronomy.PLANETS[k].name === name);
       if(key) { const pos = Astronomy.planetPosition(key, jd); ra = pos.ra; dec = pos.dec; }
    } else {
       const dso = Astronomy.DSO.find(d => d.name === name);
       if(dso) { ra = dso.ra; dec = dso.dec; }
    }
    if(ra !== undefined) {
       const lst = Astronomy.localSiderealTime(jd, S.lon);
       const p = Astronomy.equatorialToHorizontal(ra, dec, S.lat, lst);
       S.az = p.az; S.alt = Math.max(0, p.alt);
       $('az-slider').value = S.az; $('alt-slider').value = S.alt;
       $('az-readout').textContent = Math.round(S.az) + '°';
       $('alt-readout').textContent = Math.round(S.alt) + '°';
       document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
       document.querySelector('[data-section="skymap"]').classList.add('active');
       document.querySelectorAll('.app-section').forEach(s => s.classList.remove('active'));
       $('section-skymap').classList.add('active');
       if (typeof SkyMap !== 'undefined') {
         SkyMap.init();
         SkyMap.pointTo(p.az, Math.max(0, p.alt));
       }
    }
  };
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
  queueRender();
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

document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-'].includes(e.key)) return;
  applyScopeMetrics(false);
  queueRender();
});

function updateBackground() {
  const now = Date.now();
  if (!isObservatoryActive() || !canvas) return;
  if (now - S.lastMove < 1000 || S.bgLoading) return;
  
  const jd = Astronomy.julianDate();
  const lst = Astronomy.localSiderealTime(jd, S.lon);
  const core = Astronomy.horizontalToEquatorial(S.az, S.alt, S.lat, lst);
  const fov = 120 / S.zoom;
  
  // Only update if moved significantly or zoom changed
  const dRa = Math.abs(core.ra - S.bgParams.ra);
  const dDec = Math.abs(core.dec - S.bgParams.dec);
  const dFov = Math.abs(fov - S.bgParams.fov);
  
  if (dRa < fov/4 && dDec < fov/4 && dFov < fov/4 && S.backgroundImg) return;

  S.bgLoading = true;
  const url = `https://alasky.cds.unistra.fr/DSS/DSSColor/cutout?ra=${core.ra.toFixed(4)}&dec=${core.dec.toFixed(4)}&width=${fov.toFixed(2)}&height=${fov.toFixed(2)}&size=1024`;
  
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    S.backgroundImg = img;
    S.bgParams = { ra: core.ra, dec: core.dec, fov: fov };
    S.bgLoading = false;
  };
  img.onerror = () => { S.bgLoading = false; };
  img.src = url;
}

// ══════ BOOT ══════
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    preloadAssets(init);
    // Init sky map (default page)
    if (typeof SkyMap !== 'undefined') SkyMap.init();
    // Init constellations search
    const csearch = document.getElementById('const-search');
    if (csearch) csearch.addEventListener('input', e => {
      document.querySelectorAll('.const-card').forEach(card => {
        const name = card.querySelector('.const-card-name');
        if (name) card.style.display = name.textContent.toLowerCase().includes(e.target.value.toLowerCase()) ? '' : 'none';
      });
    });
  });
} else {
  preloadAssets(init);
  if (typeof SkyMap !== 'undefined') SkyMap.init();
  const csearch = document.getElementById('const-search');
  if (csearch) csearch.addEventListener('input', e => {
    document.querySelectorAll('.const-card').forEach(card => {
      const name = card.querySelector('.const-card-name');
      if (name) card.style.display = name.textContent.toLowerCase().includes(e.target.value.toLowerCase()) ? '' : 'none';
    });
  });
}

// Expose pointTo for cross-module navigation
window.StellarisApp = {
  pointTo: function(az, alt) {
    S.az = az;
    S.alt = alt;
    const azSlider = document.getElementById('az-slider');
    const altSlider = document.getElementById('alt-slider');
    if (azSlider) { azSlider.value = az; }
    if (altSlider) { altSlider.value = alt; }
    queueRender();
    if (document.getElementById('az-readout')) document.getElementById('az-readout').textContent = Math.round(az) + '°';
    if (document.getElementById('alt-readout')) document.getElementById('alt-readout').textContent = Math.round(alt) + '°';
  }
};

setInterval(updateBackground, 2000);

// Safety fallback for slow resource loads
setTimeout(() => { if (!canvas) init(); }, 500);

})();
