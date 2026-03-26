/**
 * STELLARIS — Stellarium-Style Full Sky Map Engine
 * Full-screen interactive sky renderer with zoom, pan, live data
 * Azimuthal / Stereographic / All-Sky projections
 */

const SkyMap = (() => {
  'use strict';

  // ── State ───────────────────────────────────────────────
  let canvas, ctx;
  let W = 0, H = 0;

  const STATE = {
    lat: 51.5074, lon: -0.1278,
    locName: 'London', locCountry: 'UK',
    // View direction (az=0→N, az=90→E; alt=90→zenith)
    centerAz: 180, centerAlt: 45,
    fov: 90,           // degrees of vertical field
    projection: 'azimuthal',
    layers: {
      constellations: true,
      labels: true,
      planets: true,
      dso: true,
      milkyway: true,
      satellites: true,
      grid: true,
      eqgrid: false
    },
    dragging: false, dragStart: {x:0,y:0,az:0,alt:0},
    pinching: false, pinchDist0: 0, fov0: 90,
    hoveredObj: null,
    selectedObj: null,
    initialized: false,
    toolbarInitialized: false,
    interactionInitialized: false,
    // Satellites (simulated orbital motion)
    satellites: [
      { name:'ISS', ra0:100,  dec0:52,   spdRa:4.2,  spdDec:0.8,  mag:-3.5, color:'#ffffaa', trail:[] },
      { name:'HST', ra0:45,   dec0:28,   spdRa:3.6,  spdDec:-0.4, mag:1.5,  color:'#aaffff', trail:[] },
      { name:'CSS', ra0:210,  dec0:41,   spdRa:4.0,  spdDec:0.5,  mag:0.5,  color:'#ffddaa', trail:[] },
      { name:'GPS', ra0:320,  dec0:-15,  spdRa:1.0,  spdDec:0.2,  mag:3.5,  color:'#aaaaff', trail:[] }
    ],
    animFrame: null,
    lastRender: 0
  };

  function queueDraw() {
    if (STATE.animFrame == null) {
      STATE.animFrame = requestAnimationFrame(draw);
    }
  }

  // ── Coordinate Helpers ──────────────────────────────────
  function toRad(d) { return d * Math.PI / 180; }
  function toDeg(r) { return r * 180 / Math.PI; }

  // Convert Altitude/Azimuth → canvas x,y using azimuthal equidistant projection
  function project(az, alt) {
    const cx = W / 2, cy = H / 2;
    const scale = Math.min(W, H) / 2 / toRad(STATE.fov / 2);

    if (STATE.projection === 'allsky') {
      // Full hemisphere: zenith at center, horizon at edge
      const r = (90 - alt) / 90 * Math.min(W, H) * 0.47;
      const theta = toRad(az - 180);
      return {
        x: cx + r * Math.sin(theta),
        y: cy - r * Math.cos(theta),
        visible: alt >= -5
      };
    }

    // For azimuthal & stereographic: center on STATE.centerAz/centerAlt
    // Convert both to Cartesian on unit sphere
    const a1 = toRad(az), e1 = toRad(alt);
    const a0 = toRad(STATE.centerAz), e0 = toRad(STATE.centerAlt);

    const x1 = Math.cos(e1) * Math.sin(a1);
    const y1 = Math.cos(e1) * Math.cos(a1);
    const z1 = Math.sin(e1);
    const x0 = Math.cos(e0) * Math.sin(a0);
    const y0 = Math.cos(e0) * Math.cos(a0);
    const z0 = Math.sin(e0);

    // Angular distance from center
    const dot = x1*x0 + y1*y0 + z1*z0;
    const angDist = Math.acos(Math.max(-1, Math.min(1, dot)));

    if (angDist > toRad(STATE.fov / 2 + 5)) return { x: -9999, y: -9999, visible: false };

    let r;
    if (STATE.projection === 'stereographic') {
      r = 2 * scale * Math.tan(angDist / 2);
    } else {
      r = scale * angDist;
    }

    // Direction perpendicular to center
    const cross_x = y0*z1 - z0*y1;
    const cross_y = z0*x1 - x0*z1;
    const cross_z = x0*y1 - y0*x1;
    const crossLen = Math.sqrt(cross_x*cross_x + cross_y*cross_y + cross_z*cross_z);
    if (crossLen < 1e-9) return { x: cx, y: cy, visible: true };

    // Project onto screen plane
    // "Up" in screen = zenith direction projected
    const zen_x = 0, zen_y = 0, zen_z = 1;
    const rightX = y0*zen_z - z0*zen_y;
    const rightY = z0*zen_x - x0*zen_z;
    const rightZ = x0*zen_y - y0*zen_x;
    const rightLen = Math.sqrt(rightX*rightX + rightY*rightY + rightZ*rightZ) || 1;
    const upX = y0*(rightZ/rightLen) - z0*(rightY/rightLen);
    const upY = z0*(rightX/rightLen) - x0*(rightZ/rightLen);
    const upZ = x0*(rightY/rightLen) - y0*(rightX/rightLen);

    const cx2 = (cross_x/crossLen) * (rightX/rightLen) + (cross_y/crossLen) * (rightY/rightLen) + (cross_z/crossLen) * (rightZ/rightLen);
    const cy2 = (cross_x/crossLen) * upX + (cross_y/crossLen) * upY + (cross_z/crossLen) * upZ;

    return {
      x: cx + r * cx2,
      y: cy - r * cy2,
      visible: alt >= -2
    };
  }

  // Inverse: screen x,y → az, alt
  function unproject(px, py) {
    const cx = W / 2, cy = H / 2;
    const scale = Math.min(W, H) / 2 / toRad(STATE.fov / 2);
    const dx = px - cx, dy = cy - py;

    if (STATE.projection === 'allsky') {
      const r = Math.sqrt(dx*dx + dy*dy);
      const maxR = Math.min(W, H) * 0.47;
      const alt = 90 - (r / maxR) * 90;
      const az = (toDeg(Math.atan2(dx, -dy)) + 360 + 180) % 360;
      return { az, alt };
    }

    const r = Math.sqrt(dx*dx + dy*dy);
    let angDist;
    if (STATE.projection === 'stereographic') {
      angDist = 2 * Math.atan(r / (2 * scale));
    } else {
      angDist = r / scale;
    }

    const a0 = toRad(STATE.centerAz), e0 = toRad(STATE.centerAlt);
    const x0 = Math.cos(e0) * Math.sin(a0);
    const y0 = Math.cos(e0) * Math.cos(a0);
    const z0 = Math.sin(e0);

    const rightX = -Math.cos(a0), rightY = Math.sin(a0), rightZ = 0;
    const rLen = Math.sqrt(rightX*rightX + rightY*rightY);
    const rxN = rightX/rLen, ryN = rightY/rLen;
    const upX = -Math.sin(e0)*Math.sin(a0);
    const upY = -Math.sin(e0)*Math.cos(a0);
    const upZ = Math.cos(e0);

    if (r < 1) return { az: STATE.centerAz, alt: STATE.centerAlt };
    const ux = dx/r, uy = -dy/r;
    const dirX = ux*rxN + uy*upX;
    const dirY = ux*ryN + uy*upY;
    const dirZ = uy*upZ;
    const dLen = Math.sqrt(dirX*dirX + dirY*dirY + dirZ*dirZ) || 1;

    const sinA = Math.sin(angDist);
    const px3 = x0*Math.cos(angDist) + (dirX/dLen)*sinA;
    const py3 = y0*Math.cos(angDist) + (dirY/dLen)*sinA;
    const pz3 = z0*Math.cos(angDist) + (dirZ/dLen)*sinA;

    const alt = toDeg(Math.asin(Math.max(-1, Math.min(1, pz3))));
    const az = (toDeg(Math.atan2(px3, py3)) + 360) % 360;
    return { az, alt };
  }

  // ── Drawing ─────────────────────────────────────────────
  function draw() {
    STATE.animFrame = null;
    if (!canvas || !ctx) return;
    W = canvas.width = canvas.clientWidth;
    H = canvas.height = canvas.clientHeight;
    if (W === 0 || H === 0) {
      queueDraw();
      return;
    }

    const jd = Astronomy.julianDate();
    const lst = Astronomy.localSiderealTime(jd, STATE.lon);
    const tf = Astronomy.twilightFactor ? Astronomy.twilightFactor(jd, STATE.lat, STATE.lon) : 0;
    const now = performance.now() / 1000;

    // ── Sky background ──────────────────────────────────────
    drawBackground(tf);

    // ── Milky Way ──────────────────────────────────────────
    if (STATE.layers.milkyway) drawMilkyWay(jd, lst);

    // ── Grid ──────────────────────────────────────────────
    if (STATE.layers.grid) drawHorizonGrid();
    if (STATE.layers.eqgrid) drawEquatorialGrid(lst);

    // ── Constellation lines ────────────────────────────────
    if (STATE.layers.constellations) drawConstellationLines(jd, lst);

    // ── Stars ──────────────────────────────────────────────
    drawStars(jd, lst, tf, now);

    // ── Deep Sky Objects ──────────────────────────────────
    if (STATE.layers.dso) drawDSO(jd, lst);

    // ── Planets ───────────────────────────────────────────
    if (STATE.layers.planets) drawPlanets(jd, lst);

    // ── Satellites ────────────────────────────────────────
    if (STATE.layers.satellites) drawSatellites(jd, lst, now);

    // ── Compass / Horizon labels ───────────────────────────
    drawHorizonLabels();

    // ── Hover highlight ───────────────────────────────────
    if (STATE.hoveredObj) drawHoverRing(STATE.hoveredObj);
    if (STATE.selectedObj) drawSelectionRing(STATE.selectedObj);

    // Update status bar
    updateStatusBar(jd, lst, tf);

    queueDraw();
  }

  function drawBackground(tf) {
    // Night sky gradient
    let topColor = '#020308', bottomColor = '#020308';
    if (tf > 0.1) {
      const t = Math.min(1, tf);
      topColor = `rgba(${Math.round(t*20)},${Math.round(t*40)},${Math.round(t*80+10)},1)`;
      bottomColor = `rgba(${Math.round(t*60)},${Math.round(t*50)},${Math.round(t*30)},1)`;
    }
    if (STATE.projection === 'allsky') {
      ctx.fillStyle = '#010204';
      ctx.fillRect(0, 0, W, H);
      const R = Math.min(W, H) * 0.47;
      const grad = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, R);
      grad.addColorStop(0, topColor);
      grad.addColorStop(1, bottomColor);
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(W/2, H/2, R, 0, Math.PI*2); ctx.fill();
    } else {
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, topColor);
      grad.addColorStop(1, bottomColor);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawMilkyWay(jd, lst) {
    if (!Astronomy.milkyWayPoints) return;
    const pts = Astronomy.milkyWayPoints();
    ctx.save();
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      // milky way points are in RA/Dec; convert to alt/az
      const h = Astronomy.equatorialToHorizontal(p.ra, p.dec, STATE.lat, lst);
      const pt = project(h.az, h.alt);
      if (!pt.visible) continue;
      const r = (p.brightness || 0.3) * 30;
      const alpha = (p.brightness || 0.3) * 0.06;
      const grd = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, r);
      grd.addColorStop(0, `rgba(180,200,255,${alpha})`);
      grd.addColorStop(1, 'rgba(180,200,255,0)');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, r, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }

  function drawHorizonGrid() {
    ctx.save();
    ctx.strokeStyle = 'rgba(64,184,216,0.12)';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([3, 6]);
    // Altitude circles
    for (let alt = 0; alt <= 80; alt += 10) {
      ctx.beginPath();
      let first = true;
      for (let az = 0; az <= 360; az += 2) {
        const pt = project(az, alt);
        if (!pt.visible) { first = true; continue; }
        if (first) { ctx.moveTo(pt.x, pt.y); first = false; }
        else ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();
    }
    // Azimuth lines
    for (let az = 0; az < 360; az += 15) {
      ctx.beginPath();
      let first = true;
      for (let alt = 0; alt <= 90; alt += 2) {
        const pt = project(az, alt);
        if (!pt.visible) { first = true; continue; }
        if (first) { ctx.moveTo(pt.x, pt.y); first = false; }
        else ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();
    }
    // Horizon line (more prominent)
    ctx.strokeStyle = 'rgba(64,184,216,0.35)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    ctx.beginPath();
    let first = true;
    for (let az = 0; az <= 360; az += 1) {
      const pt = project(az, 0);
      if (!pt.visible) { first = true; continue; }
      if (first) { ctx.moveTo(pt.x, pt.y); first = false; }
      else ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawEquatorialGrid(lst) {
    ctx.save();
    ctx.strokeStyle = 'rgba(212,168,67,0.1)';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([2, 8]);
    // Declination circles
    for (let dec = -80; dec <= 80; dec += 10) {
      ctx.beginPath();
      let first = true;
      for (let ra = 0; ra <= 360; ra += 2) {
        const h = Astronomy.equatorialToHorizontal(ra, dec, STATE.lat, lst);
        const pt = project(h.az, h.alt);
        if (!pt.visible) { first = true; continue; }
        if (first) { ctx.moveTo(pt.x, pt.y); first = false; }
        else ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();
    }
    // RA lines
    for (let ra = 0; ra < 360; ra += 15) {
      ctx.beginPath();
      let first = true;
      for (let dec = -90; dec <= 90; dec += 2) {
        const h = Astronomy.equatorialToHorizontal(ra, dec, STATE.lat, lst);
        const pt = project(h.az, h.alt);
        if (!pt.visible) { first = true; continue; }
        if (first) { ctx.moveTo(pt.x, pt.y); first = false; }
        else ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawConstellationLines(jd, lst) {
    if (!Astronomy.CONSTELLATION_LINES || !Astronomy.STARS) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(212,168,67,0.25)';
    ctx.lineWidth = 0.8;
    Astronomy.CONSTELLATION_LINES.forEach(([s1, s2]) => {
      const st1 = Astronomy.STARS.find(s => s[0] === s1);
      const st2 = Astronomy.STARS.find(s => s[0] === s2);
      if (!st1 || !st2) return;
      const h1 = Astronomy.equatorialToHorizontal(st1[1], st1[2], STATE.lat, lst);
      const h2 = Astronomy.equatorialToHorizontal(st2[1], st2[2], STATE.lat, lst);
      const pt1 = project(h1.az, h1.alt);
      const pt2 = project(h2.az, h2.alt);
      if (!pt1.visible && !pt2.visible) return;
      ctx.beginPath();
      ctx.moveTo(pt1.x, pt1.y);
      ctx.lineTo(pt2.x, pt2.y);
      ctx.stroke();
    });
    ctx.restore();
  }

  // Persistent list of drawn objects for hover/click detection
  const drawnObjects = [];

  function drawStars(jd, lst, tf, now) {
    if (!Astronomy.STARS) return;
    drawnObjects.length = 0;
    const limitMag = 6.5 + (1 - Math.min(1, tf)) * 0.5;

    ctx.save();
    Astronomy.STARS.forEach(s => {
      const mag = s[3];
      if (mag > limitMag) return;
      const h = Astronomy.equatorialToHorizontal(s[1], s[2], STATE.lat, lst);
      if (h.alt < -2) return;
      const pt = project(h.az, h.alt);
      if (!pt.visible) return;

      // Star color by spectral type
      let color = '#f0f4ff';
      if (s[4]) {
        if (s[4][0] === 'M') color = '#ffb070';
        else if (s[4][0] === 'K') color = '#ffd4a0';
        else if (s[4][0] === 'O') color = '#99bbff';
        else if (s[4][0] === 'B') color = '#aaccff';
        else if (s[4][0] === 'A') color = '#ddeeff';
        else if (s[4][0] === 'F') color = '#fffff0';
        else if (s[4][0] === 'G') color = '#fff5cc';
      }

      const fovScale = Math.pow(90 / Math.max(STATE.fov, 5), 0.3);
      const sz = Math.max(0.4, (6.5 - mag) / 2.5 * fovScale);
      const twinkle = mag > 2 ? (Math.sin(now * 3 + s[1]) * 0.15 + 0.85) : 1;
      const alpha = Math.max(0.2, (7 - mag) / 7) * twinkle;

      // Glow for bright stars
      if (mag < 2.5) {
        const glowR = sz * 4;
        const grd = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, glowR);
        grd.addColorStop(0, color.replace(')', `,${alpha * 0.4})`).replace('rgb', 'rgba') || `rgba(255,255,255,${alpha*0.4})`);
        grd.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, glowR, 0, Math.PI*2); ctx.fill();
      }

      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, sz, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;

      // Labels
      if (STATE.layers.labels && mag < 2.0 && STATE.fov < 120) {
        ctx.fillStyle = 'rgba(200,220,255,0.75)';
        ctx.font = `${Math.max(10, 13 - STATE.fov/20)}px "Cormorant Garamond"`;
        ctx.fillText(s[0], pt.x + sz + 3, pt.y + 3);
      }

      drawnObjects.push({ name: s[0], type: 'Star', mag, ra: s[1], dec: s[2], az: h.az, alt: h.alt, x: pt.x, y: pt.y, sz, spectral: s[4] || '—' });
    });
    ctx.restore();
  }

  function drawDSO(jd, lst) {
    if (!Astronomy.DSO) return;
    ctx.save();
    Astronomy.DSO.forEach(d => {
      const h = Astronomy.equatorialToHorizontal(d.ra, d.dec, STATE.lat, lst);
      if (h.alt < -2) return;
      const pt = project(h.az, h.alt);
      if (!pt.visible) return;

      const fovScale = Math.pow(90 / Math.max(STATE.fov, 5), 0.3);
      const sz = Math.max(2, (9 - Math.min(d.mag, 8)) / 1.5 * fovScale);

      ctx.strokeStyle = 'rgba(64,184,216,0.6)';
      ctx.fillStyle = 'rgba(64,184,216,0.12)';
      ctx.lineWidth = 1;

      if (d.type === 'galaxy') {
        ctx.save();
        ctx.translate(pt.x, pt.y);
        ctx.scale(1.8, 0.7);
        ctx.beginPath(); ctx.arc(0, 0, sz, 0, Math.PI*2);
        ctx.fill(); ctx.restore();
        ctx.beginPath();
        ctx.save(); ctx.translate(pt.x, pt.y); ctx.scale(1.8, 0.7);
        ctx.arc(0, 0, sz, 0, Math.PI*2); ctx.restore();
        ctx.stroke();
      } else if (d.type === 'nebula') {
        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y - sz);
        ctx.lineTo(pt.x + sz, pt.y + sz * 0.7);
        ctx.lineTo(pt.x - sz, pt.y + sz * 0.7);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.arc(pt.x, pt.y, sz, 0, Math.PI*2);
        ctx.fill(); ctx.stroke();
        if (d.type === 'cluster') {
          ctx.beginPath(); ctx.arc(pt.x, pt.y, sz * 1.5, 0, Math.PI*2); ctx.stroke();
        }
      }

      if (STATE.layers.labels && d.mag < 7 && STATE.fov < 100) {
        ctx.fillStyle = 'rgba(64,184,216,0.8)';
        ctx.font = `9px "JetBrains Mono"`;
        ctx.fillText(d.id, pt.x + sz + 3, pt.y + 3);
      }

      drawnObjects.push({ name: d.name, type: d.type, mag: d.mag, ra: d.ra, dec: d.dec, az: h.az, alt: h.alt, x: pt.x, y: pt.y, sz: sz + 4, id: d.id });
    });
    ctx.restore();
  }

  function drawPlanets(jd, lst) {
    if (!Astronomy.PLANETS || !Astronomy.planetPosition) return;
    ctx.save();
    const planetColors = {
      mercury: '#c0c0c0', venus: '#fff8d0', mars: '#ff6040',
      jupiter: '#ffc890', saturn: '#e8d080', uranus: '#80e8f8',
      neptune: '#6080f0', sun: '#ffffc0', moon: '#d0d8e0'
    };
    Object.entries(Astronomy.PLANETS).forEach(([key, p]) => {
      const pos = Astronomy.planetPosition(key, jd);
      if (!pos) return;
      const h = Astronomy.equatorialToHorizontal(pos.ra, pos.dec, STATE.lat, lst);
      if (h.alt < -2) return;
      const pt = project(h.az, h.alt);
      if (!pt.visible) return;

      const fovScale = Math.pow(90 / Math.max(STATE.fov, 5), 0.3);
      const mag = pos.magnitude !== undefined ? pos.magnitude : 1;
      const sz = key === 'sun' ? 18 * fovScale : key === 'moon' ? 14 * fovScale : Math.max(3, (6 - mag) * fovScale);
      const color = planetColors[key] || '#ffffff';

      // Glow
      const glowR = sz * 3;
      const grd = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, glowR);
      grd.addColorStop(0, color + 'aa');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, glowR, 0, Math.PI*2); ctx.fill();

      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, sz, 0, Math.PI*2); ctx.fill();

      // Saturn rings
      if (key === 'saturn') {
        ctx.strokeStyle = 'rgba(232,208,128,0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.save(); ctx.translate(pt.x, pt.y); ctx.scale(2.2, 0.5);
        ctx.arc(0, 0, sz, 0, Math.PI*2);
        ctx.restore(); ctx.stroke();
      }

      if (STATE.layers.labels) {
        ctx.fillStyle = color;
        ctx.font = `bold ${Math.max(10, 12 - STATE.fov/20)}px "Cinzel"`;
        ctx.fillText(p.name || p.symbol, pt.x + sz + 4, pt.y + 4);
      }

      drawnObjects.push({ name: p.name || key, type: 'planet', mag, ra: pos.ra, dec: pos.dec, az: h.az, alt: h.alt, x: pt.x, y: pt.y, sz: sz + 6 });
    });
    ctx.restore();
  }

  function drawSatellites(jd, lst, now) {
    ctx.save();
    STATE.satellites.forEach(sat => {
      // Simulate orbital motion
      const t = now * 0.05; // orbital period factor
      const ra = (sat.ra0 + sat.spdRa * t * 60) % 360;
      const dec = sat.dec0 + Math.sin(t * sat.spdDec) * 10;
      const clampedDec = Math.max(-90, Math.min(90, dec));

      const h = Astronomy.equatorialToHorizontal(ra, clampedDec, STATE.lat, lst);
      if (h.alt < 0) return;
      const pt = project(h.az, h.alt);
      if (!pt.visible) return;

      // Trail
      sat.trail.push({ x: pt.x, y: pt.y });
      if (sat.trail.length > 25) sat.trail.shift();

      if (sat.trail.length > 2) {
        ctx.beginPath();
        ctx.moveTo(sat.trail[0].x, sat.trail[0].y);
        for (let i = 1; i < sat.trail.length; i++) {
          ctx.lineTo(sat.trail[i].x, sat.trail[i].y);
        }
        ctx.strokeStyle = sat.color + '55';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Satellite dot
      const flash = 0.6 + 0.4 * Math.sin(now * 2 + sat.ra0);
      ctx.globalAlpha = flash;
      ctx.fillStyle = sat.color;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 3, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;

      // Crosshair
      ctx.strokeStyle = sat.color + 'aa';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(pt.x - 6, pt.y); ctx.lineTo(pt.x + 6, pt.y);
      ctx.moveTo(pt.x, pt.y - 6); ctx.lineTo(pt.x, pt.y + 6);
      ctx.stroke();

      if (STATE.layers.labels && STATE.fov < 120) {
        ctx.fillStyle = sat.color;
        ctx.font = '9px "JetBrains Mono"';
        ctx.fillText(sat.name, pt.x + 8, pt.y - 5);
      }

      drawnObjects.push({ name: sat.name, type: 'Satellite', mag: sat.mag, az: h.az, alt: h.alt, x: pt.x, y: pt.y, sz: 10, ra, dec: clampedDec });
    });
    ctx.restore();
  }

  function drawHorizonLabels() {
    const cardinals = [
      { az:0, label:'N', color:'#d4a843', bold:true },
      { az:45, label:'NE', color:'#7a96b8' },
      { az:90, label:'E', color:'#7a96b8' },
      { az:135, label:'SE', color:'#7a96b8' },
      { az:180, label:'S', color:'#7a96b8' },
      { az:225, label:'SW', color:'#7a96b8' },
      { az:270, label:'W', color:'#7a96b8' },
      { az:315, label:'NW', color:'#7a96b8' }
    ];
    ctx.save();
    cardinals.forEach(({ az, label, color, bold }) => {
      const pt = project(az, 0);
      if (!pt.visible) return;
      ctx.fillStyle = color;
      ctx.font = `${bold ? 'bold ' : ''}${Math.max(11, 14 - STATE.fov/20)}px "Cinzel"`;
      ctx.textAlign = 'center';
      ctx.fillText(label, pt.x, pt.y + 18);
    });
    ctx.textAlign = 'left';
    ctx.restore();
  }

  function drawHoverRing(obj) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,100,0.8)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(obj.x, obj.y, Math.max(10, obj.sz + 4), 0, Math.PI*2);
    ctx.stroke();
    ctx.restore();
  }

  function drawSelectionRing(obj) {
    ctx.save();
    ctx.strokeStyle = '#40b8d8';
    ctx.lineWidth = 2;
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#40b8d8';
    ctx.beginPath();
    ctx.arc(obj.x, obj.y, Math.max(12, obj.sz + 6), 0, Math.PI*2);
    ctx.stroke();
    // Tick marks
    for (let a = 0; a < 360; a += 90) {
      const rad = toRad(a);
      const r1 = Math.max(12, obj.sz + 6);
      const r2 = r1 + 6;
      ctx.beginPath();
      ctx.moveTo(obj.x + r1*Math.cos(rad), obj.y + r1*Math.sin(rad));
      ctx.lineTo(obj.x + r2*Math.cos(rad), obj.y + r2*Math.sin(rad));
      ctx.stroke();
    }
    ctx.restore();
  }

  function updateStatusBar(jd, lst) {
    const now = new Date();
    const utc = now.toUTCString().slice(17, 25);
    const h = Math.floor(lst / 15);
    const m = Math.floor((lst / 15 - h) * 60);
    document.getElementById('sms-utc').textContent = 'UTC: ' + utc;
    document.getElementById('sms-lst').textContent = `LST: ${h.toString().padStart(2,'0')}h${m.toString().padStart(2,'0')}m`;
    document.getElementById('sms-location').textContent = `📍 ${STATE.locName}, ${STATE.locCountry}`;
    document.getElementById('sms-stars-count').textContent = `Stars: ${drawnObjects.filter(o=>o.type==='Star').length}`;
    document.getElementById('smt-datetime').textContent = now.toUTCString().slice(5,22) + ' UTC';
  }

  // ── Interaction ─────────────────────────────────────────
  function initInteraction() {
    if (STATE.interactionInitialized) return;
    STATE.interactionInitialized = true;
    // Mouse drag to pan
    canvas.addEventListener('mousedown', e => {
      STATE.dragging = true;
      STATE.dragStart = { x: e.clientX, y: e.clientY, az: STATE.centerAz, alt: STATE.centerAlt };
      canvas.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', e => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      if (STATE.dragging) {
        const dx = e.clientX - STATE.dragStart.x;
        const dy = e.clientY - STATE.dragStart.y;
        const degPerPx = STATE.fov / Math.min(W, H);
        STATE.centerAz = (STATE.dragStart.az - dx * degPerPx + 360) % 360;
        STATE.centerAlt = Math.max(-5, Math.min(90, STATE.dragStart.alt + dy * degPerPx));
      } else {
        // Hover detection
        const coord = unproject(mx, my);
        document.getElementById('sms-cursor').textContent = `Az: ${coord.az.toFixed(1)}° Alt: ${coord.alt.toFixed(1)}°`;
        detectHover(mx, my);
      }
    });

    window.addEventListener('mouseup', e => {
      if (!STATE.dragging) return;
      const dx = Math.abs(e.clientX - STATE.dragStart.x);
      const dy = Math.abs(e.clientY - STATE.dragStart.y);
      STATE.dragging = false;
      canvas.style.cursor = 'grab';
      if (dx < 4 && dy < 4) {
        const rect = canvas.getBoundingClientRect();
        handleClick(e.clientX - rect.left, e.clientY - rect.top);
      }
    });

    // Scroll to zoom
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 0.85 : 1.18;
      STATE.fov = Math.max(5, Math.min(180, STATE.fov * factor));
      document.getElementById('smt-fov-slider').value = STATE.fov;
      document.getElementById('smt-fov-label').textContent = STATE.fov.toFixed(0) + '°';
    }, { passive: false });

    // Pinch zoom (touch)
    canvas.addEventListener('touchstart', e => {
      if (e.touches.length === 2) {
        STATE.pinching = true;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        STATE.pinchDist0 = Math.sqrt(dx*dx + dy*dy);
        STATE.fov0 = STATE.fov;
      } else if (e.touches.length === 1) {
        STATE.dragging = true;
        STATE.dragStart = { x: e.touches[0].clientX, y: e.touches[0].clientY, az: STATE.centerAz, alt: STATE.centerAlt };
      }
    }, { passive: true });

    canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      if (STATE.pinching && e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx*dx + dy*dy);
        STATE.fov = Math.max(5, Math.min(180, STATE.fov0 * (STATE.pinchDist0 / dist)));
        document.getElementById('smt-fov-slider').value = STATE.fov;
        document.getElementById('smt-fov-label').textContent = STATE.fov.toFixed(0) + '°';
      } else if (STATE.dragging && e.touches.length === 1) {
        const ddx = e.touches[0].clientX - STATE.dragStart.x;
        const ddy = e.touches[0].clientY - STATE.dragStart.y;
        const degPerPx = STATE.fov / Math.min(W, H);
        STATE.centerAz = (STATE.dragStart.az - ddx * degPerPx + 360) % 360;
        STATE.centerAlt = Math.max(-5, Math.min(90, STATE.dragStart.alt + ddy * degPerPx));
      }
    }, { passive: false });

    canvas.addEventListener('touchend', () => {
      STATE.dragging = false; STATE.pinching = false;
    });

    // Keyboard navigation
    window.addEventListener('keydown', e => {
      if (!document.getElementById('section-skymap').classList.contains('active')) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      const step = e.shiftKey ? 15 : 5;
      switch (e.key) {
        case 'ArrowLeft':  STATE.centerAz = (STATE.centerAz - step + 360) % 360; break;
        case 'ArrowRight': STATE.centerAz = (STATE.centerAz + step) % 360; break;
        case 'ArrowUp':    STATE.centerAlt = Math.min(90, STATE.centerAlt + step); break;
        case 'ArrowDown':  STATE.centerAlt = Math.max(-5, STATE.centerAlt - step); break;
        case '+': case '=': STATE.fov = Math.max(5, STATE.fov * 0.85); break;
        case '-': case '_': STATE.fov = Math.min(180, STATE.fov * 1.18); break;
        case 'Home': resetView(); break;
      }
    });

    // Double-click to center on object
    canvas.addEventListener('dblclick', e => {
      const rect = canvas.getBoundingClientRect();
      const coord = unproject(e.clientX - rect.left, e.clientY - rect.top);
      STATE.centerAz = coord.az;
      STATE.centerAlt = Math.max(0, coord.alt);
    });
  }

  function detectHover(mx, my) {
    let closest = null, minDist = 20;
    drawnObjects.forEach(obj => {
      const dx = mx - obj.x, dy = my - obj.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < Math.max(8, obj.sz + 3) && dist < minDist) {
        minDist = dist; closest = obj;
      }
    });
    STATE.hoveredObj = closest;
    const tip = document.getElementById('skymap-tooltip');
    if (closest) {
      document.getElementById('stt-name').textContent = closest.name;
      document.getElementById('stt-type').textContent = closest.type + (closest.spectral && closest.spectral !== '—' ? ` · ${closest.spectral}` : '');
      document.getElementById('stt-mag').textContent = closest.mag != null ? closest.mag.toFixed(1) : '—';
      document.getElementById('stt-alt').textContent = closest.alt.toFixed(1) + '°';
      document.getElementById('stt-az').textContent = closest.az.toFixed(1) + '°';
      document.getElementById('stt-radec').textContent = closest.ra != null ? `${closest.ra.toFixed(1)}° / ${closest.dec != null ? closest.dec.toFixed(1) : '—'}°` : '—';
      tip.style.left = (mx + 16) + 'px';
      tip.style.top = (my - 10) + 'px';
      tip.classList.remove('hidden');
      canvas.style.cursor = 'pointer';
    } else {
      tip.classList.add('hidden');
      canvas.style.cursor = STATE.dragging ? 'grabbing' : 'grab';
    }
  }

  function handleClick(mx, my) {
    let closest = null, minDist = 24;
    drawnObjects.forEach(obj => {
      const dx = mx - obj.x, dy = my - obj.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < Math.max(10, obj.sz + 4) && dist < minDist) {
        minDist = dist; closest = obj;
      }
    });
    STATE.selectedObj = closest;
    const panel = document.getElementById('skymap-selected');
    if (closest) {
      document.getElementById('sms-obj-name').textContent = closest.name;
      document.getElementById('sms-obj-details').innerHTML = `
        <div class="sms-row"><span>Type</span><span>${closest.type}</span></div>
        <div class="sms-row"><span>Magnitude</span><span>${closest.mag != null ? closest.mag.toFixed(1) : '—'}</span></div>
        <div class="sms-row"><span>Altitude</span><span>${closest.alt.toFixed(1)}°</span></div>
        <div class="sms-row"><span>Azimuth</span><span>${closest.az.toFixed(1)}°</span></div>
        ${closest.ra != null ? `<div class="sms-row"><span>RA / Dec</span><span>${closest.ra.toFixed(2)}° / ${(closest.dec||0).toFixed(2)}°</span></div>` : ''}
        ${closest.spectral && closest.spectral !== '—' ? `<div class="sms-row"><span>Spectral</span><span>${closest.spectral}</span></div>` : ''}
      `;
      panel.classList.remove('hidden');
    } else {
      panel.classList.add('hidden');
    }
  }

  function resetView() {
    STATE.centerAz = 180;
    STATE.centerAlt = 45;
    STATE.fov = 90;
    document.getElementById('smt-fov-slider').value = 90;
    document.getElementById('smt-fov-label').textContent = '90°';
  }

  // ── Toolbar controls ────────────────────────────────────
  function initToolbar() {
    if (STATE.toolbarInitialized) return;
    STATE.toolbarInitialized = true;
    // Location
    document.getElementById('skymap-location-select').addEventListener('change', e => {
      const parts = e.target.value.split(',');
      STATE.lat = parseFloat(parts[0]);
      STATE.lon = parseFloat(parts[1]);
      STATE.locName = parts[2];
      STATE.locCountry = parts[3];
      // Clear satellite trails
      STATE.satellites.forEach(s => s.trail = []);
    });

    // Layers
    document.querySelectorAll('.smt-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const layer = btn.dataset.layer;
        STATE.layers[layer] = !STATE.layers[layer];
        btn.classList.toggle('active', STATE.layers[layer]);
      });
    });

    // FOV slider
    document.getElementById('smt-fov-slider').addEventListener('input', e => {
      STATE.fov = parseFloat(e.target.value);
      document.getElementById('smt-fov-label').textContent = STATE.fov.toFixed(0) + '°';
    });

    // Projection
    document.getElementById('smt-projection').addEventListener('change', e => {
      STATE.projection = e.target.value;
      if (STATE.projection === 'allsky') {
        STATE.centerAz = 180;
        STATE.centerAlt = 45;
        STATE.fov = 180;
        document.getElementById('smt-fov-slider').value = 180;
        document.getElementById('smt-fov-label').textContent = '180°';
      }
    });

    // Zoom buttons
    document.getElementById('smt-zoom-in').addEventListener('click', () => {
      STATE.fov = Math.max(5, STATE.fov * 0.7);
      document.getElementById('smt-fov-slider').value = STATE.fov;
      document.getElementById('smt-fov-label').textContent = STATE.fov.toFixed(0) + '°';
    });
    document.getElementById('smt-zoom-out').addEventListener('click', () => {
      STATE.fov = Math.min(180, STATE.fov * 1.43);
      document.getElementById('smt-fov-slider').value = STATE.fov;
      document.getElementById('smt-fov-label').textContent = STATE.fov.toFixed(0) + '°';
    });
    document.getElementById('smt-zoom-reset').addEventListener('click', resetView);
    document.getElementById('smt-now-btn').addEventListener('click', resetView);

    // Selected panel close
    document.getElementById('sms-close').addEventListener('click', () => {
      STATE.selectedObj = null;
      document.getElementById('skymap-selected').classList.add('hidden');
    });

    // Go to observatory button
    document.getElementById('sms-goto-obs').addEventListener('click', () => {
      if (!STATE.selectedObj) return;
      // Switch to observatory tab and navigate to this object
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelector('[data-section="observatory"]').classList.add('active');
      document.querySelectorAll('.app-section').forEach(s => s.classList.remove('active'));
      document.getElementById('section-observatory').classList.add('active');
      // Trigger navigation if app.js exposes it
      if (window.StellarisApp && window.StellarisApp.pointTo) {
        window.StellarisApp.pointTo(STATE.selectedObj.az, STATE.selectedObj.alt);
      }
    });
  }

  // ── Public init ─────────────────────────────────────────
  function init() {
    canvas = document.getElementById('stellarium-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.style.cursor = 'grab';

    initToolbar();
    initInteraction();

    if (STATE.initialized) {
      queueDraw();
      return;
    }

    // Start render loop
    queueDraw();

    // Window resize
    window.addEventListener('resize', () => {
      if (STATE.animFrame) { cancelAnimationFrame(STATE.animFrame); STATE.animFrame = null; }
      queueDraw();
    });

    STATE.initialized = true;
  }

  // Expose method to navigate from outside
  function pointTo(az, alt) {
    STATE.centerAz = az;
    STATE.centerAlt = alt;
    STATE.fov = 30;
    document.getElementById('smt-fov-slider').value = 30;
    document.getElementById('smt-fov-label').textContent = '30°';
  }

  return { init, pointTo, getState: () => STATE };
})();
