/**
 * STELLARIS — Pages Module (Telescope Lab, Constellations, Live Sky Map)
 */
const StellarisPages = (() => {
  let telescopeLabInitialized = false;

  // ── Telescope Lab ──
  function initTelescopeLab() {
    const ap = document.getElementById('lab-aperture');
    const fl = document.getElementById('lab-fl');
    const ep = document.getElementById('lab-ep');
    const barlow = document.getElementById('lab-barlow');
    if (!ap) return;
    if (telescopeLabInitialized) return;
    telescopeLabInitialized = true;

    function inferScopeType(a, f) {
      const fRatio = f / Math.max(a, 1);
      if (a <= 60 && f <= 400) return 'binoculars';
      if (a >= 250 && fRatio >= 8) return 'cassegrain';
      if (a >= 150) return 'reflector';
      return 'refractor';
    }

    function drawLabLightPath(a, f) {
      const scopeType = inferScopeType(a, f);
      const pathDiv = document.getElementById('lab-light-path');
      if(!pathDiv) return;

      const beamLabel = scopeType === 'binoculars' ? 'Dual prism light path' :
        scopeType === 'cassegrain' ? 'Folded SCT optical train' :
        scopeType === 'reflector' ? 'Newtonian reflector geometry' :
        'Refractor lens train';

      let body = '';
      let rays = '';

      if (scopeType === 'binoculars') {
        body = `
          <g class="lab-optics-body">
            <path class="lab-optics-shell" d="M 52 18 L 146 18 L 176 44 L 176 98 L 146 122 L 52 122 Z"/>
            <path class="lab-optics-shell" d="M 224 18 L 318 18 L 348 44 L 348 98 L 318 122 L 224 122 Z"/>
            <rect class="lab-optics-prism" x="154" y="46" width="18" height="18" rx="3"/>
            <rect class="lab-optics-prism" x="228" y="72" width="18" height="18" rx="3"/>
            <ellipse class="lab-optics-lens" cx="52" cy="70" rx="8" ry="42"/>
            <ellipse class="lab-optics-lens" cx="224" cy="70" rx="8" ry="42"/>
          </g>`;
        rays = `
          <path class="lab-light-ray ray-slow" d="M 10 42 L 52 42 L 164 56 L 166 92 L 214 92"/>
          <path class="lab-light-ray ray-fast" d="M 10 98 L 52 98 L 164 82 L 238 54 L 362 54"/>
        `;
      } else if (scopeType === 'cassegrain') {
        body = `
          <g class="lab-optics-body">
            <rect class="lab-optics-shell" x="48" y="24" width="250" height="92" rx="18"/>
            <ellipse class="lab-optics-corrector" cx="58" cy="70" rx="10" ry="44"/>
            <path class="lab-optics-mirror" d="M 298 24 Q 274 70 298 116"/>
            <circle class="lab-optics-secondary" cx="128" cy="70" r="12"/>
            <rect class="lab-optics-focuser" x="298" y="58" width="48" height="24" rx="8"/>
          </g>`;
        rays = `
          <path class="lab-light-ray ray-fast" d="M 8 46 L 58 46 L 286 46 L 128 70 L 346 70"/>
          <path class="lab-light-ray ray-slow" d="M 8 94 L 58 94 L 286 94 L 128 70 L 346 70"/>
        `;
      } else if (scopeType === 'reflector') {
        body = `
          <g class="lab-optics-body">
            <rect class="lab-optics-shell" x="48" y="26" width="260" height="88" rx="10"/>
            <path class="lab-optics-mirror" d="M 308 26 Q 282 70 308 114"/>
            <circle class="lab-optics-secondary" cx="170" cy="70" r="8"/>
            <rect class="lab-optics-focuser" x="156" y="2" width="28" height="34" rx="8"/>
          </g>`;
        rays = `
          <path class="lab-light-ray ray-fast" d="M 8 40 L 300 40 L 170 70 L 170 10"/>
          <path class="lab-light-ray ray-slow" d="M 8 100 L 300 100 L 170 70 L 170 10"/>
        `;
      } else {
        body = `
          <g class="lab-optics-body">
            <path class="lab-optics-shell" d="M 60 28 L 294 48 L 294 92 L 60 112 Z"/>
            <ellipse class="lab-optics-lens" cx="60" cy="70" rx="10" ry="44"/>
            <ellipse class="lab-optics-lens-secondary" cx="104" cy="70" rx="5" ry="34"/>
            <rect class="lab-optics-focuser" x="294" y="56" width="46" height="28" rx="8"/>
          </g>`;
        rays = `
          <path class="lab-light-ray ray-fast" d="M 8 46 L 60 46 C 88 46 116 58 340 70"/>
          <path class="lab-light-ray ray-slow" d="M 8 94 L 60 94 C 88 94 116 82 340 70"/>
        `;
      }

      const svg = `
        <svg class="lab-optics-svg" viewBox="0 0 400 140" width="100%" height="100%" aria-label="${beamLabel}">
          <defs>
            <linearGradient id="lab-shell-grad" x1="0%" x2="100%">
              <stop offset="0%" stop-color="#081324"/>
              <stop offset="100%" stop-color="#15243f"/>
            </linearGradient>
            <linearGradient id="lab-ray-grad" x1="0%" x2="100%">
              <stop offset="0%" stop-color="rgba(212,168,67,0.05)"/>
              <stop offset="35%" stop-color="rgba(255,221,131,0.95)"/>
              <stop offset="100%" stop-color="rgba(119,209,255,0.2)"/>
            </linearGradient>
            <radialGradient id="lab-focus-bloom" cx="50%" cy="50%" r="60%">
              <stop offset="0%" stop-color="rgba(119,209,255,0.45)"/>
              <stop offset="100%" stop-color="rgba(119,209,255,0)"/>
            </radialGradient>
          </defs>
          <rect class="lab-optics-bg" x="1" y="1" width="398" height="138" rx="16"/>
          <circle class="lab-focus-bloom" cx="350" cy="70" r="34"/>
          ${body}
          <g class="lab-ray-layer">${rays}</g>
          <text class="lab-optics-caption" x="18" y="128">${beamLabel}</text>
          <text class="lab-optics-scale" x="312" y="128">${Math.round(a)}mm · f/${(f / Math.max(a, 1)).toFixed(1)}</text>
        </svg>`;
      pathDiv.innerHTML = svg;
    }

    const update = () => {
      const a = +ap.value, f = +fl.value, e = +ep.value;
      const b = barlow && barlow.checked ? 2 : 1;
      document.getElementById('lab-aperture-val').textContent = a + 'mm';
      document.getElementById('lab-fl-val').textContent = f + 'mm';
      document.getElementById('lab-ep-val').textContent = e + 'mm';
      
      const mag = (f * b) / e;
      const fov = 60 / mag;
      const exitPupil = a / mag;
      const limMag = 2.7 + 5 * Math.log10(a);
      const res = 116 / a;
      const lightG = Math.pow(a / 7, 2);
      const fRatio = f / a;
      
      drawLabLightPath(a, f);
      
      const r = document.getElementById('lab-results');
      r.innerHTML = [
        ['MAGNIFICATION', Math.round(mag) + '×'],
        ['TRUE FOV', fov.toFixed(2) + '°'],
        ['EXIT PUPIL', exitPupil.toFixed(1) + 'mm'],
        ['LIMITING MAG', limMag.toFixed(1)],
        ['RESOLVING', res.toFixed(2) + '″'],
        ['LIGHT GATHER', Math.round(lightG) + '×'],
        ['F-RATIO', 'f/' + fRatio.toFixed(1)],
        ['MAX USEFUL', (a * 2) + '×'],
      ].map(([l, v]) => `<div class="lab-result-card"><div class="lab-result-label">${l}</div><div class="lab-result-value" style="color:${l==='EXIT PUPIL' && exitPupil>7 ? 'var(--danger)' : 'var(--accent-cyan)'}">${v}</div></div>`).join('');
      
      const comp = document.getElementById('lab-comparison');
      const objects = [
        { name: 'Moon Crater', fov: 0.5 },
        { name: 'Jupiter', fov: 0.02 },
        { name: 'Orion Nebula', fov: 1.0 },
        { name: 'Star Cluster', fov: 0.3 },
      ];
      comp.innerHTML = objects.map(obj => {
        const visible = fov >= obj.fov * 0.3;
        const quality = Math.min(1, exitPupil / 2) * (visible ? 1 : 0.2);
        return `<div class="lab-view-card">
          <div class="lab-view-canvas" style="background:radial-gradient(circle,rgba(${visible ? '100,180,255' : '40,40,60'},${quality * 0.5}),#050810);display:flex;align-items:center;justify-content:center;color:${visible ? 'var(--accent-cyan)' : 'var(--text-muted)'};font-size:13px;font-family:var(--font-mono);">
            ${visible ? Math.round(mag) + '× · ' + fov.toFixed(1) + '°' : 'Too narrow'}
          </div>
          <div class="lab-view-label">${obj.name}</div>
        </div>`;
      }).join('');
      comp.innerHTML = [
        { name: 'Moon Crater', kind: 'Lunar detail', targetFov: 0.55, hue: '255,218,150' },
        { name: 'Jupiter', kind: 'Planetary disc', targetFov: 0.08, hue: '255,188,120' },
        { name: 'Orion Nebula', kind: 'Diffuse nebula', targetFov: 1.1, hue: '110,208,255' },
        { name: 'Star Cluster', kind: 'Rich field', targetFov: 0.42, hue: '164,214,255' }
      ].map(obj => {
        const coverage = Math.min(1.35, obj.targetFov / Math.max(fov, 0.05));
        const visible = fov >= obj.targetFov * 0.25;
        const ringScale = Math.max(18, Math.min(74, 70 / coverage));
        const objectSize = Math.max(12, Math.min(54, 42 * coverage));
        const detailLabel = visible ? `${Math.round(mag)}x | ${fov.toFixed(2)} deg` : 'Target outside field';
        return `<article class="lab-view-card ${visible ? 'is-visible' : 'is-tight'}">
          <div class="lab-view-canvas">
            <div class="lab-view-stars"></div>
            <div class="lab-view-aperture"></div>
            <div class="lab-view-reticle" style="width:${ringScale}%;height:${ringScale}%"></div>
            <div class="lab-view-object" style="--lab-object-color:${obj.hue};--lab-object-size:${objectSize}%"></div>
            <div class="lab-view-sheen" style="opacity:${visible ? 0.82 : 0.24}"></div>
            <div class="lab-view-metric">${detailLabel}</div>
          </div>
          <div class="lab-view-body">
            <div class="lab-view-label">${obj.name}</div>
            <div class="lab-view-meta">${obj.kind}</div>
          </div>
        </article>`;
      }).join('');
      
      const info = document.getElementById('lab-info-cards');
      info.innerHTML = `
        <div class="lab-info-card">
          <div class="lab-info-title">Exit Pupil Guide</div>
          <div class="lab-info-text">${exitPupil > 7 ? '⚠ Exit pupil exceeds eye\'s max (~7mm). Light is wasted.' : exitPupil > 4 ? '✓ Good for wide-field deep-sky viewing.' : exitPupil > 2 ? '✓ Ideal for most observing. Good contrast.' : exitPupil > 1 ? '◐ High power. Best on planets and doubles.' : '⚠ Very high power. Dim image, needs steady air.'}</div>
        </div>
        <div class="lab-info-card">
          <div class="lab-info-title">Magnification Rating</div>
          <div class="lab-info-text">${mag > a * 2 ? '⚠ Beyond useful limit! Image will be blurry.' : mag > a * 1.5 ? '◐ Near max. Needs excellent seeing conditions.' : mag > 100 ? '✓ High power — good for planets and lunar detail.' : '✓ Moderate power — versatile for many targets.'}</div>
        </div>`;
    };
    ap.addEventListener('input', update);
    fl.addEventListener('input', update);
    ep.addEventListener('input', update);
    if (barlow) barlow.addEventListener('change', update);
    
    document.querySelectorAll('#lab-presets .ep-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        ap.value = btn.dataset.ap;
        fl.value = btn.dataset.fl;
        ep.value = btn.dataset.ep;
        update();
      });
    });
    
    update();
  }

  // ── Constellations ──
  function initConstellations(navigateToConstellation) {
    const grid = document.getElementById('const-grid');
    if (!grid || !Astronomy.CONSTELLATIONS || grid.innerHTML.length > 50) return;

    function renderConstellationSVG(c) {
      if (!Astronomy.STARS || !Astronomy.CONSTELLATION_LINES) return '';
      const cStars = Astronomy.STARS.filter(s => s[5] === c.name);
      if (cStars.length === 0) return '<div style="height:120px;display:flex;align-items:center;justify-content:center;background:#050810;color:#304050;font-size:11px;">Star data unavailable</div>';
      
      let minRa = 360, maxRa = 0, minDec = 90, maxDec = -90;
      cStars.forEach(s => {
        if (s[1] < minRa) minRa = s[1]; if (s[1] > maxRa) maxRa = s[1];
        if (s[2] < minDec) minDec = s[2]; if (s[2] > maxDec) maxDec = s[2];
      });
      const padRa = Math.max(1, (maxRa - minRa)) * 0.15;
      const padDec = Math.max(1, (maxDec - minDec)) * 0.15;
      minRa -= padRa; maxRa += padRa; minDec -= padDec; maxDec += padDec;
      
      const width = 200, height = 140;
      const proj = (ra, dec) => ({
        x: width - ((ra - minRa) / (maxRa - minRa)) * width,
        y: height - ((dec - minDec) / (maxDec - minDec)) * height
      });

      let linesHtml = '';
      Astronomy.CONSTELLATION_LINES.forEach(([s1, s2]) => {
        const p1 = cStars.find(s => s[0] === s1);
        const p2 = cStars.find(s => s[0] === s2);
        if (p1 && p2) {
          const pt1 = proj(p1[1], p1[2]);
          const pt2 = proj(p2[1], p2[2]);
          linesHtml += `<line x1="${pt1.x}" y1="${pt1.y}" x2="${pt2.x}" y2="${pt2.y}" stroke="currentColor" stroke-width="1.5" opacity="0.4"/>`;
        }
      });
      
      let starsHtml = '';
      cStars.forEach(s => {
        const pt = proj(s[1], s[2]);
        const r = Math.max(1.5, 4 - s[3]/1.5);
        starsHtml += `<circle cx="${pt.x}" cy="${pt.y}" r="${r}" fill="#f0c855" stroke="#050810" stroke-width="1"/>`;
        if (s[3] <= 2.5) {
          starsHtml += `<text x="${pt.x + r + 4}" y="${pt.y + 3}" fill="#a0c0e0" font-family="monospace" font-size="8">${s[0]}</text>`;
        }
      });
      
      return `
      <div style="background:#020308; border-bottom:1px solid rgba(100,140,220,0.12); display:flex; justify-content:center; align-items:center; color:var(--accent-cyan); overflow:hidden;">
        <svg viewBox="0 0 ${width} ${height}" width="100%" height="200" style="max-height: 200px;">
          <defs>
            <radialGradient id="glow-${c.abbr}" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="rgba(64,184,216,0.1)"/>
              <stop offset="100%" stop-color="transparent"/>
            </radialGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#glow-${c.abbr})"/>
          ${linesHtml}
          ${starsHtml}
        </svg>
      </div>`;
    }

    grid.innerHTML = Astronomy.CONSTELLATIONS.map(c => `
      <div class="const-card">
        ${renderConstellationSVG(c)}
        <div class="const-card-header">
          <div>
            <div class="const-card-name">${c.name}</div>
            <div class="const-card-latin">${c.latin} (${c.genitive})</div>
          </div>
          <div class="const-card-meta">
            <div class="const-card-abbr">${c.abbr}</div>
            <div class="const-card-season">Best: ${c.bestMonth} · ${c.hemisphere}</div>
          </div>
        </div>
        <div class="const-card-body">
          <div class="const-card-myth">"${c.mythology}"</div>
          <div class="const-card-features">${c.features}</div>
          <div class="const-card-stars">
            ${c.stars.map(s => `<span class="const-star-tag">★ ${s}</span>`).join('')}
          </div>
          <div class="const-card-actions">
            <button class="const-locate-btn" data-constellation="${c.name}">🔭 Locate in Sky</button>
          </div>
        </div>
      </div>
    `).join('');
    grid.querySelectorAll('.const-locate-btn').forEach(btn => {
      btn.addEventListener('click', () => navigateToConstellation(btn.dataset.constellation));
    });
  }

  // ── Native Celestial Star Chart (Live Sky) ──
  let liveSkyInitialized = false;
  let chartHemi = 'N'; 
  let chartDrag = false, chartStart = {};
  let chartOffset = {x: 0, y: 0};
  let chartZoom = 1;

  function initLiveSky() {
    const canvas = document.getElementById('live-sky-canvas');
    if (!canvas || liveSkyInitialized) return;
    liveSkyInitialized = true;
    const ctx = canvas.getContext('2d');
    
    document.getElementById('chart-n').onclick = e => { chartHemi = 'N'; updateActive(); draw(); };
    document.getElementById('chart-s').onclick = e => { chartHemi = 'S'; updateActive(); draw(); };
    function updateActive() {
      document.getElementById('chart-n').classList.toggle('active', chartHemi === 'N');
      document.getElementById('chart-s').classList.toggle('active', chartHemi === 'S');
      chartOffset = {x:0, y:0}; chartZoom = 1;
    }

    canvas.addEventListener('mousedown', e => { chartDrag = true; chartStart = {x: e.clientX - chartOffset.x, y: e.clientY - chartOffset.y}; });
    window.addEventListener('mousemove', e => { if(chartDrag) { chartOffset.x = e.clientX - chartStart.x; chartOffset.y = e.clientY - chartStart.y; draw(); }});
    window.addEventListener('mouseup', () => chartDrag = false);
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const z = e.deltaY < 0 ? 1.1 : 0.9;
      chartZoom = Math.max(0.5, Math.min(10, chartZoom * z));
      draw();
    });

    function draw() {
      const parent = canvas.parentElement;
      if(!parent) return;
      const W = canvas.width = parent.clientWidth;
      const H = canvas.height = parent.clientHeight;
      if(W===0||H===0) return;
      
      ctx.fillStyle = '#020308'; ctx.fillRect(0, 0, W, H);
      
      const cx = W / 2 + chartOffset.x;
      const cy = H / 2 + chartOffset.y;
      const R = Math.min(W, H) * 0.45 * chartZoom;
      
      function proj(ra, dec) {
        let r, theta;
        if (chartHemi === 'N') {
           r = (90 - dec) / 90 * R; // North Pole at center (r=0)
           theta = -ra * Math.PI/180;
        } else {
           r = (dec + 90) / 90 * R; // South Pole at center (r=0)
           theta = ra * Math.PI/180;
        }
        return { x: cx + r * Math.sin(theta), y: cy - r * Math.cos(theta), visible: r <= R };
      }

      ctx.lineWidth = 0.5; ctx.strokeStyle = 'rgba(64,184,216,0.15)';
      for(let r=1; r<=4; r++) { ctx.beginPath(); ctx.arc(cx, cy, R * (r/4), 0, Math.PI*2); ctx.stroke(); }
      for(let a=0; a<360; a+=15) { 
        const t = a * Math.PI/180;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + R*Math.sin(t), cy - R*Math.cos(t)); ctx.stroke();
      }

      ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(212,168,67,0.3)';
      Astronomy.CONSTELLATION_LINES.forEach(([s1, s2]) => {
        const p1 = Astronomy.STARS.find(s => s[0] === s1);
        const p2 = Astronomy.STARS.find(s => s[0] === s2);
        if(p1 && p2) {
           const pt1 = proj(p1[1], p1[2]), pt2 = proj(p2[1], p2[2]);
           if(pt1.visible || pt2.visible) {
             ctx.beginPath(); ctx.moveTo(pt1.x, pt1.y); ctx.lineTo(pt2.x, pt2.y); ctx.stroke();
           }
        }
      });
      
      Astronomy.STARS.forEach(s => {
        const pt = proj(s[1], s[2]);
        if(!pt.visible) return;
        const mag = s[3];
        const sz = Math.max(0.5, (6 - mag) / 2 * (chartZoom > 1.5 ? 1.5 : 1));
        let color = '#fff';
        if(s[4]) {
          if(s[4][0] === 'M') color = '#ffb070';
          if(s[4][0] === 'K') color = '#ffd4a0';
          if(s[4][0] === 'O' || s[4][0] === 'B') color = '#a0c0ff';
        }
        ctx.fillStyle = color;
        ctx.globalAlpha = Math.max(0.3, (7-mag)/7);
        ctx.beginPath(); ctx.arc(pt.x, pt.y, sz, 0, Math.PI*2); ctx.fill();
        ctx.globalAlpha = 1;
        
        if (mag < 2.5 && chartZoom > 0.8) {
           ctx.fillStyle = 'rgba(200,220,255,0.7)'; ctx.font = '10px "Cormorant Garamond"';
           ctx.fillText(s[0], pt.x + sz + 3, pt.y + 3);
        }
      });
      
      ctx.fillStyle = 'rgba(64,184,216,0.5)';
      Astronomy.DSO.forEach(d => {
        const pt = proj(d.ra, d.dec);
        if(!pt.visible) return;
        const sz = Math.max(2, (10 - d.mag)/2 * chartZoom);
        ctx.beginPath(); ctx.arc(pt.x, pt.y, sz, 0, Math.PI*2); ctx.fill();
        if(chartZoom > 1.2 && d.mag < 6) {
           ctx.font = '9px "JetBrains Mono"'; ctx.fillText(d.id, pt.x + sz + 2, pt.y + 2);
        }
      });

      // Mask out bounds
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI*2);
      ctx.rect(W, 0, -W, H); ctx.fillStyle = '#020308'; ctx.fill();
      ctx.strokeStyle = 'rgba(212,168,67,0.8)'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI*2); ctx.stroke();
      
      // Ring labels
      ctx.fillStyle = 'rgba(212,168,67,0.8)'; ctx.font = '12px "Cinzel"';
      ctx.textAlign = 'center'; ctx.fillText(chartHemi === 'N' ? 'NORTHERN HEMISPHERE' : 'SOUTHERN HEMISPHERE', cx, cy - R - 10);
      ctx.textAlign = 'left';
    }
    
    draw();
    window.addEventListener('resize', draw);
    setInterval(draw, 1000); // just in case parent resizes smoothly
  }

  return { initTelescopeLab, initConstellations, initLiveSky: () => {} }; // initLiveSky replaced by SkyMap module
})();
