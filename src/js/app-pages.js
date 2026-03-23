/**
 * STELLARIS — Pages Module (Telescope Lab, Constellations, Live Sky)
 */
const StellarisPages = (() => {
  // ── Telescope Lab ──
  function initTelescopeLab() {
    const ap = document.getElementById('lab-aperture');
    const fl = document.getElementById('lab-fl');
    const ep = document.getElementById('lab-ep');
    const barlow = document.getElementById('lab-barlow');
    if (!ap) return;
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
      const dawes = 4.56 / a * 206265 / 3600;
      const r = document.getElementById('lab-results');
      r.innerHTML = [
        ['MAGNIFICATION', Math.round(mag) + '×'],
        ['TRUE FOV', fov.toFixed(2) + '°'],
        ['EXIT PUPIL', exitPupil.toFixed(1) + 'mm'],
        ['LIMITING MAG', limMag.toFixed(1)],
        ['RESOLVING', res.toFixed(2) + '″'],
        ['LIGHT GATHER', Math.round(lightG) + '×'],
        ['F-RATIO', 'f/' + fRatio.toFixed(1)],
        ['MAX USEFUL MAG', (a * 2) + '×'],
      ].map(([l, v]) => `<div class="lab-result-card"><div class="lab-result-label">${l}</div><div class="lab-result-value">${v}</div></div>`).join('');
      // Comparison views
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
          <div class="lab-view-label">${obj.name} (${obj.fov}° field needed)</div>
        </div>`;
      }).join('');
      // Info cards
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
    update();
  }

  // ── Constellations ──
  function initConstellations(navigateToConstellation) {
    const grid = document.getElementById('const-grid');
    if (!grid || !Astronomy.CONSTELLATIONS || grid.innerHTML.length > 50) return;

    function renderConstellationSVG(c) {
      if (!Astronomy.STARS || !Astronomy.CONSTELLATION_LINES) return '';
      const cStars = Astronomy.STARS.filter(s => s[5] === c.abbr);
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

  // ── Live Sky (Aladin Lite) ──
  let aladinInstance = null;
  function initAladinLite() {
    const container = document.getElementById('aladin-container');
    if (!container || aladinInstance) return;
    if (!window.AladinLiteReady) {
      setTimeout(initAladinLite, 1000);
      return;
    }
    try {
      window.AladinLiteReady.then(A => {
        aladinInstance = A.aladin('#aladin-container', {
          survey: 'P/DSS2/color', fov: 10, target: 'M42',
          showReticle: true, showZoomControl: true, showFullscreenControl: true,
          showLayersControl: true, showGotoControl: false,
        });
        document.getElementById('aladin-go').addEventListener('click', () => {
          const target = document.getElementById('aladin-search').value.trim();
          if (target && aladinInstance) aladinInstance.gotoObject(target);
        });
        document.getElementById('aladin-search').addEventListener('keydown', e => {
          if (e.key === 'Enter') document.getElementById('aladin-go').click();
        });
        document.getElementById('aladin-survey').addEventListener('change', e => {
          if (aladinInstance) aladinInstance.setImageSurvey(e.target.value);
        });
      });
    } catch(e) { console.warn('Aladin Lite not available:', e); }
  }

  return { initTelescopeLab, initConstellations, initAladinLite };
})();
