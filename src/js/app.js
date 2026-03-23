/**
 * ═══════════════════════════════════════════════════════
 * STELLARIS — Main Application
 * Virtual Stargazing Observatory
 * ═══════════════════════════════════════════════════════
 */

(function () {
  'use strict';

  // ════════════════════════════════════════════
  // STATE
  // ════════════════════════════════════════════
  const state = {
    lat: 51.5074,
    lon: -0.1278,
    locationName: 'London, UK',
    bortle: 5,
    az: 180,
    alt: 45,
    zoom: 1.0,
    scope: 'refractor80',
    eyepiece: 40,
    barlowActive: false,
    focusPos: 50,

    showConstellations: true,
    showLabels: true,
    showGrid: true,
    showMilkyWay: false,
    showPlanets: false,
    tracking: false,

    dragStart: null,
    azAtDrag: 180,
    altAtDrag: 45,
    animFrame: null,
    trackingInterval: null,

    tooltip: { visible: false, x: 0, y: 0, object: null },
  };

  // ════════════════════════════════════════════
  // TELESCOPE DEFINITIONS
  // ════════════════════════════════════════════
  const SCOPES = {
    binoculars: {
      name: '7×50 Binoculars',
      type: 'Porro Prism Binoculars',
      aperture: 50,
      focalLength: 175,
      maxMag: 30,
      limitingMag: 10.5,
      resolvingPower: 2.3,
      lightGather: 51,
      fov: 6.5,
      vignette: 0.0,
      ringStyle: 'binocular',
      description: 'The perfect first instrument — stable at 7× with a wide 6.5° field of view. Shows star clusters, the Milky Way band, and bright nebulae beautifully.',
      eyepieceLock: true,
      fixedMag: 7,
      tips: ['Hold steady or use a tripod for extended viewing', 'Best for sweeping the Milky Way and large clusters', 'Let eyes dark-adapt for 20 minutes before use']
    },
    refractor80: {
      name: '80mm Refractor',
      type: 'Achromatic Refractor',
      aperture: 80,
      focalLength: 880,
      maxMag: 160,
      limitingMag: 11.4,
      resolvingPower: 1.45,
      lightGather: 131,
      fov: 2.3,
      vignette: 0.15,
      ringStyle: 'refractor',
      description: 'The classic starter telescope. Sharp views of the Moon, planets, and bright deep-sky objects. Excellent for beginners to learn the sky.',
      eyepieceLock: false,
      tips: ['Aim at the Moon first — stunning at any magnification', 'Saturn\'s rings visible at 40×', 'Avoid observing over warm tarmac or buildings (thermal turbulence)']
    },
    newtonian200: {
      name: '200mm Newtonian',
      type: 'Newtonian Reflector',
      aperture: 200,
      focalLength: 1200,
      maxMag: 400,
      limitingMag: 13.2,
      resolvingPower: 0.58,
      lightGather: 816,
      fov: 1.5,
      vignette: 0.25,
      ringStyle: 'reflector',
      description: 'A workhorse reflector for serious amateurs. Reveals globular cluster stars, galaxy detail, and fine planetary features when seeing is steady.',
      eyepieceLock: false,
      tips: ['Collimate the mirrors before each session', 'Great for Messier marathon on spring evenings', 'Jupiter\'s cloud bands and Great Red Spot visible at high power']
    },
    dobsonian12: {
      name: '12″ Dobsonian',
      type: 'Dobsonian Reflector',
      aperture: 305,
      focalLength: 1525,
      maxMag: 610,
      limitingMag: 14.5,
      resolvingPower: 0.38,
      lightGather: 1900,
      fov: 1.2,
      vignette: 0.30,
      ringStyle: 'reflector',
      description: 'A large aperture light bucket on a simple alt-az mount. Shows faint galaxies, intricate nebula structure, and resolves globular clusters to their cores.',
      eyepieceLock: false,
      tips: ['The "Dob" is the most aperture-per-dollar telescope', 'Use a star atlas and star-hop to find faint objects', 'Dark adaptation is crucial — use only red light']
    },
    schmidt16: {
      name: '16″ SCT',
      type: 'Schmidt-Cassegrain',
      aperture: 406,
      focalLength: 4064,
      maxMag: 812,
      limitingMag: 15.0,
      resolvingPower: 0.28,
      lightGather: 3360,
      fov: 0.7,
      vignette: 0.20,
      ringStyle: 'sct',
      description: 'A professional-grade Cassegrain: compact yet powerful. Used by advanced amateurs and small observatories. Reveals Pluto, faint galaxies at 15th magnitude.',
      eyepieceLock: false,
      tips: ['Allow 30 min for thermal stabilisation', 'Use an equatorial wedge for astrophotography', 'GOTO mount helps find faint targets instantly']
    },
    observatory: {
      name: 'Giant Observatory',
      type: '4-metre Research Reflector',
      aperture: 4000,
      focalLength: 60000,
      maxMag: 8000,
      limitingMag: 22.0,
      resolvingPower: 0.03,
      lightGather: 3265306,
      fov: 0.12,
      vignette: 0.35,
      ringStyle: 'observatory',
      description: 'A world-class research observatory like those at La Palma or Mauna Kea. Reveals 22nd magnitude objects, active galactic nuclei, and distant galaxy clusters.',
      eyepieceLock: false,
      tips: ['Real telescopes of this size use CCD cameras, not eyepieces', 'Temperature must be controlled to 0.1°C for optimal seeing', 'Adaptive optics correct for atmospheric turbulence in real time']
    }
  };

  const EYEPIECES = { '40': 40, '25': 25, '15': 15, '9': 9, '5': 5, 'barlow': 'barlow' };

  // ════════════════════════════════════════════
  // LOCATION DATA
  // ════════════════════════════════════════════
  const LOCATION_DATA = {
    '51.5074,-0.1278,London,UK': { bortle: 8, alt: 25, seeing: 'average', timezone: 0 },
    '48.8566,2.3522,Paris,France': { bortle: 8, alt: 35, seeing: 'average', timezone: 1 },
    '41.9028,12.4964,Rome,Italy': { bortle: 7, alt: 20, seeing: 'good', timezone: 1 },
    '27.7172,85.3240,Roque de los Muchachos,La Palma': { bortle: 2, alt: 2396, seeing: 'excellent', timezone: 0 },
    '19.8968,-155.5828,Mauna Kea,Hawaii': { bortle: 1, alt: 4205, seeing: 'excellent', timezone: -10 },
    '30.6716,-104.0225,McDonald Observatory,Texas': { bortle: 2, alt: 2070, seeing: 'excellent', timezone: -6 },
    '-30.2441,-70.7462,Atacama Desert,Chile': { bortle: 1, alt: 2400, seeing: 'exceptional', timezone: -4 },
    '40.7128,-74.0060,New York City,USA': { bortle: 9, alt: 10, seeing: 'poor', timezone: -5 },
    '35.6762,139.6503,Tokyo,Japan': { bortle: 9, alt: 40, seeing: 'average', timezone: 9 },
    '-31.2744,149.0610,Siding Spring,Australia': { bortle: 2, alt: 1165, seeing: 'excellent', timezone: 10 },
    '22.3193,114.1694,Hong Kong,China': { bortle: 9, alt: 5, seeing: 'poor', timezone: 8 },
    '-23.0100,-67.7552,ALMA Observatory,Chile': { bortle: 1, alt: 5100, seeing: 'exceptional', timezone: -4 },
    '28.7567,-17.8922,Teide Observatory,Tenerife': { bortle: 2, alt: 2390, seeing: 'excellent', timezone: 0 },
    '-29.0546,70.8875,NamibRand Reserve,Namibia': { bortle: 1, alt: 1290, seeing: 'excellent', timezone: 2 },
  };

  const BORTLE_DESC = ['', 'Pristine Dark', 'Truly Dark', 'Rural Sky', 'Rural/Suburban', 'Suburban',
    'Bright Suburban', 'Suburban/Urban', 'City Sky', 'Inner City'];

  const FACTS = [
    'The light from distant stars you see tonight left before humans existed.',
    'There are more stars in the observable universe than grains of sand on all Earth\'s beaches.',
    'Betelgeuse is so large that if it replaced our Sun, it would engulf all inner planets up to Jupiter.',
    'The Andromeda Galaxy (M31) is on a collision course with the Milky Way — in 4.5 billion years.',
    'A teaspoon of neutron star material would weigh about a billion tonnes.',
    'Light from the Sun takes 8 minutes to reach Earth; from Proxima Centauri, 4.2 years.',
    'Saturn would float in water — it\'s less dense than any liquid on Earth.',
    'The observable universe is about 93 billion light-years in diameter.',
    'Dark matter makes up about 27% of the universe but has never been directly detected.',
    'The Hercules Cluster (M13) contains ~300,000 stars packed into a sphere 150 light-years across.',
    'In 1974, a message was transmitted toward M13 — it won\'t arrive for 25,000 years.',
    'Eta Carinae is 5 million times more luminous than our Sun and could go supernova any day.',
    'The Ring Nebula (M57) is the expanding shell of a dying star like our own Sun.',
    'Jupiter\'s Great Red Spot is a storm that has been raging for at least 350 years.',
    'The Milky Way is on a collision course with several dwarf galaxies already.',
  ];

  // ════════════════════════════════════════════
  // CANVAS & RENDERING
  // ════════════════════════════════════════════
  let canvas, ctx, W, H;

  function initCanvas() {
    canvas = document.getElementById('sky-canvas');
    ctx = canvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
  }

  function resizeCanvas() {
    const container = document.getElementById('sky-container');
    W = canvas.width = container.clientWidth || 800;
    H = canvas.height = container.clientHeight || 600;
    render();
  }

  // Convert alt/az to canvas x/y with current zoom
  function skyToCanvas(alt, az) {
    const scope = SCOPES[state.scope];
    // Field of view in degrees (half-angle)
    const fovHalf = (scope.fov / (state.scope === 'binoculars' ? 1 : 1)) / state.zoom;
    const cx = W / 2, cy = H / 2;
    const scale = (W / 2) / fovHalf;
    // dAz, dAlt from center of view
    let dAz = az - state.az;
    while (dAz > 180) dAz -= 360;
    while (dAz < -180) dAz += 360;
    const dAlt = alt - state.alt;
    const x = cx + dAz * scale * Math.cos(state.alt * Astronomy.RAD);
    const y = cy - dAlt * scale;
    return { x, y, inView: Math.abs(dAz) < fovHalf * 1.2 && Math.abs(dAlt) < fovHalf * 1.2 };
  }

  function canvasToSky(px, py) {
    const scope = SCOPES[state.scope];
    const fovHalf = scope.fov / state.zoom;
    const cx = W / 2, cy = H / 2;
    const scale = (W / 2) / fovHalf;
    const dAz = (px - cx) / (scale * Math.cos(state.alt * Astronomy.RAD));
    const dAlt = -(py - cy) / scale;
    return { az: Astronomy.norm360(state.az + dAz), alt: state.alt + dAlt };
  }

  function render() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);

    // Sky background gradient
    const gradient = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, Math.max(W,H)/2);
    const bortle = state.bortle;
    const skyBrightness = Math.min(0.35, bortle * 0.04);
    gradient.addColorStop(0, `rgb(${Math.round(2+skyBrightness*30)},${Math.round(3+skyBrightness*25)},${Math.round(15+skyBrightness*40)})`);
    gradient.addColorStop(1, `rgb(${Math.round(1+skyBrightness*20)},${Math.round(2+skyBrightness*18)},${Math.round(8+skyBrightness*30)})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    // Coordinate grid
    if (state.showGrid) drawGrid();

    // Milky Way band
    if (state.showMilkyWay) drawMilkyWay();

    // Constellation lines
    if (state.showConstellations) drawConstellationLines();

    // Stars
    drawStars();

    // DSO markers
    drawDSOs();

    // Planets
    if (state.showPlanets) drawPlanets();

    // Sun / Moon
    drawSolarSystem();

    // Telescope overlay
    updateScopeOverlay();
  }

  function drawGrid() {
    ctx.save();
    ctx.strokeStyle = 'rgba(60,100,160,0.2)';
    ctx.lineWidth = 0.5;
    ctx.font = '9px JetBrains Mono, monospace';
    ctx.fillStyle = 'rgba(60,120,200,0.4)';
    // Altitude circles every 15°
    for (let a = 0; a <= 90; a += 15) {
      const scope = SCOPES[state.scope];
      const fovHalf = scope.fov / state.zoom;
      const scale = (W / 2) / fovHalf;
      const dAlt = a - state.alt;
      const y = H/2 - dAlt * scale;
      if (y > 0 && y < H) {
        ctx.beginPath();
        ctx.moveTo(0, y); ctx.lineTo(W, y);
        ctx.stroke();
        ctx.fillText(a + '°', 4, y - 3);
      }
    }
    // Azimuth lines every 10°
    for (let az = 0; az < 360; az += 10) {
      const pt = skyToCanvas(state.alt, az);
      if (pt.x > 0 && pt.x < W) {
        ctx.beginPath();
        ctx.moveTo(pt.x, 0); ctx.lineTo(pt.x, H);
        ctx.stroke();
        const labels = { 0:'N', 45:'NE', 90:'E', 135:'SE', 180:'S', 225:'SW', 270:'W', 315:'NW' };
        if (labels[az]) {
          ctx.fillStyle = 'rgba(100,180,255,0.5)';
          ctx.fillText(labels[az], pt.x + 3, H - 8);
          ctx.fillStyle = 'rgba(60,120,200,0.4)';
        }
      }
    }
    ctx.restore();
  }

  function drawMilkyWay() {
    const jd = Astronomy.julianDate();
    const lst = Astronomy.localSiderealTime(jd, state.lon);
    ctx.save();
    // Draw a rough glowing band through galactic equator
    const galPts = [];
    for (let l = 0; l < 360; l += 2) {
      // Approximate galactic → equatorial
      const lRad = l * Astronomy.RAD;
      const ra = Astronomy.norm360(266.4 + l * 0.91 + 20 * Math.sin(lRad));
      const dec = -28.9 * Math.cos(lRad) + 5.6 * Math.sin(2 * lRad);
      const horiz = Astronomy.equatorialToHorizontal(ra, dec, state.lat, lst);
      if (horiz.alt > -5) {
        const p = skyToCanvas(horiz.alt, horiz.az);
        if (p.inView) galPts.push(p);
      }
    }
    if (galPts.length > 2) {
      const bw = 15 + (8 - state.bortle) * 2;
      for (let w = bw; w > 0; w -= 3) {
        ctx.beginPath();
        ctx.moveTo(galPts[0].x, galPts[0].y);
        galPts.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.lineWidth = w;
        const alpha = (0.04 - state.bortle * 0.003) * (w / bw);
        ctx.strokeStyle = `rgba(160,170,220,${Math.max(0,alpha)})`;
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawConstellationLines() {
    const jd = Astronomy.julianDate();
    const lst = Astronomy.localSiderealTime(jd, state.lon);
    // Build star position lookup
    const starPos = {};
    Astronomy.STARS.forEach(s => {
      const horiz = Astronomy.equatorialToHorizontal(s[1], s[2], state.lat, lst);
      starPos[s[0]] = { horiz, canvas: skyToCanvas(horiz.alt, horiz.az) };
    });
    ctx.save();
    ctx.strokeStyle = 'rgba(80,140,220,0.25)';
    ctx.lineWidth = 0.8;
    Astronomy.CONSTELLATION_LINES.forEach(([a, b]) => {
      if (starPos[a] && starPos[b]) {
        const pa = starPos[a];
        const pb = starPos[b];
        if (pa.horiz.alt > 0 && pb.horiz.alt > 0 && pa.canvas.inView && pb.canvas.inView) {
          ctx.beginPath();
          ctx.moveTo(pa.canvas.x, pa.canvas.y);
          ctx.lineTo(pb.canvas.x, pb.canvas.y);
          ctx.stroke();
        }
      }
    });
    ctx.restore();
  }

  function drawStars() {
    const jd = Astronomy.julianDate();
    const lst = Astronomy.localSiderealTime(jd, state.lon);
    const scope = SCOPES[state.scope];
    const limitMag = scope.limitingMag + (9 - state.bortle) * 0.5;
    const fovHalf = scope.fov / state.zoom;

    ctx.save();
    Astronomy.STARS.forEach(star => {
      const [name, ra, dec, mag, specType, constel, fact] = star;
      if (mag > limitMag) return;
      const horiz = Astronomy.equatorialToHorizontal(ra, dec, state.lat, lst);
      if (horiz.alt < -2) return;
      const p = skyToCanvas(horiz.alt, horiz.az);
      if (!p.inView) return;

      // Star size based on magnitude
      const brightness = Math.pow(2.512, -mag + 6);
      const r = Math.min(5, Math.max(0.3, brightness * 0.4 * state.zoom));

      // Star color from spectral type
      const color = spectralColor(specType);
      const alpha = Math.min(1, (limitMag - mag) / 5 + 0.5);

      // Draw star glow
      if (r > 1) {
        const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 3);
        grd.addColorStop(0, color.replace(')', `,${alpha})`).replace('rgb', 'rgba'));
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grd;
        ctx.fillRect(p.x - r*3, p.y - r*3, r*6, r*6);
      }

      // Draw star disc
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha;
      ctx.fill();
      ctx.globalAlpha = 1;

      // Label bright stars
      if (state.showLabels && mag < 2.5 && r > 0.8) {
        ctx.font = `${Math.max(10, 9 + state.zoom)}px Cormorant Garamond, serif`;
        ctx.fillStyle = `rgba(180,210,255,0.7)`;
        ctx.fillText(name, p.x + r + 3, p.y - 3);
      }
    });

    // Add random faint field stars for atmosphere
    drawFieldStars(jd, lst, limitMag);

    ctx.restore();
  }

  let fieldStarCache = null;
  let fieldStarCacheScope = null;

  function drawFieldStars(jd, lst, limitMag) {
    // Generate random faint stars seeded by view direction
    if (fieldStarCacheScope !== state.scope) {
      fieldStarCache = null;
      fieldStarCacheScope = state.scope;
    }
    if (!fieldStarCache) {
      const count = Math.floor(50 + limitMag * 30);
      fieldStarCache = [];
      const rng = seededRandom(42);
      for (let i = 0; i < count; i++) {
        fieldStarCache.push({
          az: rng() * 360,
          alt: rng() * 90,
          mag: limitMag - rng() * 3,
          twinklePhase: rng() * Math.PI * 2,
          color: ['rgb(200,210,255)', 'rgb(255,240,220)', 'rgb(220,240,255)'][Math.floor(rng()*3)]
        });
      }
    }
    const t = Date.now() * 0.001;
    ctx.save();
    fieldStarCache.forEach(s => {
      const p = skyToCanvas(s.alt, s.az);
      if (!p.inView || s.alt < 0) return;
      const r = Math.max(0.3, 0.4 * (limitMag - s.mag));
      const twinkle = 0.6 + 0.4 * Math.sin(t * 2 + s.twinklePhase);
      ctx.globalAlpha = twinkle * 0.7;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = s.color;
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function seededRandom(seed) {
    let s = seed;
    return function() {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
  }

  function spectralColor(type) {
    if (!type) return 'rgb(255,255,255)';
    const t = type[0];
    const colors = { O:'rgb(155,185,255)', B:'rgb(185,215,255)', A:'rgb(230,240,255)',
                     F:'rgb(255,250,230)', G:'rgb(255,240,190)', K:'rgb(255,210,140)', M:'rgb(255,160,100)' };
    return colors[t] || 'rgb(255,255,255)';
  }

  function drawDSOs() {
    const jd = Astronomy.julianDate();
    const lst = Astronomy.localSiderealTime(jd, state.lon);
    const scope = SCOPES[state.scope];
    ctx.save();
    Astronomy.DSO.forEach(obj => {
      if (obj.mag > scope.limitingMag + 3) return;
      const horiz = Astronomy.equatorialToHorizontal(obj.ra, obj.dec, state.lat, lst);
      if (horiz.alt < 0) return;
      const p = skyToCanvas(horiz.alt, horiz.az);
      if (!p.inView) return;

      const alpha = Math.min(1, (scope.limitingMag + 3 - obj.mag) / 6);
      ctx.globalAlpha = alpha * 0.8;

      const r = 8 * state.zoom;

      if (obj.type === 'galaxy') {
        // Ellipse
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, r, r*0.5, 0.5, 0, Math.PI*2);
        ctx.strokeStyle = 'rgba(180,160,120,0.6)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
        ctx.fillStyle = 'rgba(100,80,60,0.3)';
        ctx.fill();
      } else if (obj.type === 'nebula') {
        // Fuzzy circle
        const g = ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,r);
        g.addColorStop(0,'rgba(100,180,200,0.4)');
        g.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(p.x-r,p.y-r,r*2,r*2);
      } else if (obj.type === 'cluster') {
        // Dotted circle
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI*2);
        ctx.setLineDash([2,2]);
        ctx.strokeStyle = 'rgba(220,200,100,0.6)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (obj.type === 'double') {
        // Two dots
        ctx.beginPath();
        ctx.arc(p.x - 3, p.y, 2, 0, Math.PI*2);
        ctx.arc(p.x + 3, p.y, 2, 0, Math.PI*2);
        ctx.fillStyle = 'rgba(255,200,100,0.8)';
        ctx.fill();
      }

      if (state.showLabels) {
        ctx.font = '9px JetBrains Mono, monospace';
        ctx.fillStyle = 'rgba(180,160,100,0.7)';
        ctx.globalAlpha = alpha * 0.7;
        ctx.fillText(obj.id, p.x + r + 3, p.y + 3);
      }
    });
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawPlanets() {
    const jd = Astronomy.julianDate();
    const lst = Astronomy.localSiderealTime(jd, state.lon);
    ctx.save();
    Object.keys(Astronomy.PLANETS).forEach(key => {
      const pos = Astronomy.planetPosition(key, jd);
      if (!pos) return;
      const horiz = Astronomy.equatorialToHorizontal(pos.ra, pos.dec, state.lat, lst);
      if (horiz.alt < 0) return;
      const p = skyToCanvas(horiz.alt, horiz.az);
      if (!p.inView) return;
      const planet = Astronomy.PLANETS[key];
      const r = Math.max(2, 4 * state.zoom);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI*2);
      ctx.fillStyle = planet.color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
      if (state.showLabels) {
        ctx.font = '10px Cormorant Garamond, serif';
        ctx.fillStyle = planet.color;
        ctx.fillText(planet.symbol + ' ' + planet.name, p.x + r + 4, p.y + 3);
      }
    });
    ctx.restore();
  }

  function drawSolarSystem() {
    const jd = Astronomy.julianDate();
    const lst = Astronomy.localSiderealTime(jd, state.lon);
    // Sun
    const sun = Astronomy.sunPosition(jd);
    const sunH = Astronomy.equatorialToHorizontal(sun.ra, sun.dec, state.lat, lst);
    if (sunH.alt > 0) {
      const ps = skyToCanvas(sunH.alt, sunH.az);
      if (ps.inView) {
        ctx.save();
        const sg = ctx.createRadialGradient(ps.x,ps.y,0,ps.x,ps.y,20);
        sg.addColorStop(0,'rgba(255,255,200,1)');
        sg.addColorStop(0.3,'rgba(255,220,100,0.8)');
        sg.addColorStop(1,'rgba(255,150,0,0)');
        ctx.fillStyle = sg;
        ctx.fillRect(ps.x-20,ps.y-20,40,40);
        if (state.showLabels) {
          ctx.font = '11px Cormorant Garamond';
          ctx.fillStyle = 'rgba(255,240,150,0.8)';
          ctx.fillText('☀ Sun', ps.x+14, ps.y-8);
        }
        ctx.restore();
      }
    } else {
      // Draw twilight glow if sun is just below horizon
      if (sunH.alt > -18) {
        const ps = skyToCanvas(0, sunH.az);
        if (ps.x > -50 && ps.x < W+50) {
          ctx.save();
          const g = ctx.createRadialGradient(ps.x, H, 0, ps.x, H, H*0.7);
          const tw = Math.max(0, (sunH.alt+18)/18);
          g.addColorStop(0, `rgba(180,100,30,${tw*0.15})`);
          g.addColorStop(0.4, `rgba(80,40,80,${tw*0.1})`);
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g;
          ctx.fillRect(0,0,W,H);
          ctx.restore();
        }
      }
    }

    // Moon
    const moon = Astronomy.moonPosition(jd);
    const moonH = Astronomy.equatorialToHorizontal(moon.ra, moon.dec, state.lat, lst);
    if (moonH.alt > -1) {
      const pm = skyToCanvas(moonH.alt, moonH.az);
      if (pm.inView) {
        ctx.save();
        const moonR = 10 * Math.max(1, state.zoom);
        const mg = ctx.createRadialGradient(pm.x,pm.y,0,pm.x,pm.y,moonR*2);
        mg.addColorStop(0,'rgba(240,235,210,1)');
        mg.addColorStop(0.5,'rgba(220,215,190,0.6)');
        mg.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle = mg;
        ctx.fillRect(pm.x-moonR*2,pm.y-moonR*2,moonR*4,moonR*4);
        ctx.beginPath();
        ctx.arc(pm.x,pm.y,moonR,0,Math.PI*2);
        ctx.fillStyle = 'rgb(230,225,200)';
        ctx.fill();
        // Moon phase shadow
        const phase = moon.phase;
        ctx.beginPath();
        ctx.arc(pm.x,pm.y,moonR,Math.PI/2,3*Math.PI/2);
        const x2 = pm.x + moonR * Math.cos(phase * Math.PI * 2) * Math.sign(0.5-phase);
        ctx.ellipse(pm.x, pm.y, Math.abs(pm.x-x2) || 1, moonR, 0, Math.PI/2, 3*Math.PI/2, phase < 0.5);
        ctx.fillStyle = 'rgba(5,10,25,0.85)';
        ctx.fill();
        if (state.showLabels) {
          ctx.font = '11px Cormorant Garamond';
          ctx.fillStyle = 'rgba(230,225,200,0.7)';
          ctx.fillText('☽ Moon', pm.x+moonR+4, pm.y);
        }
        ctx.restore();
      }
    }
  }

  function updateScopeOverlay() {
    const scope = SCOPES[state.scope];
    const minDim = Math.min(W, H);
    const outer = document.getElementById('scope-ring-outer');
    const inner = document.getElementById('scope-ring-inner');
    const vignette = document.getElementById('scope-vignette');

    if (scope.ringStyle === 'binocular') {
      outer.style.width = outer.style.height = '0';
      inner.style.width = inner.style.height = '0';
    } else {
      const outerR = minDim * 0.48;
      const innerR = minDim * 0.38;
      outer.style.width = outer.style.height = outerR * 2 + 'px';
      outer.style.marginLeft = outer.style.marginTop = -outerR + 'px';
      inner.style.width = inner.style.height = innerR * 2 + 'px';
      inner.style.marginLeft = inner.style.marginTop = -innerR + 'px';
    }

    const vig = scope.vignette;
    if (vig > 0) {
      vignette.style.background = `radial-gradient(circle at center, transparent ${Math.round((1-vig)*50)}%, rgba(0,0,0,${vig * 0.9}) 100%)`;
      vignette.style.opacity = '1';
    } else {
      vignette.style.opacity = '0';
    }
  }

  // ════════════════════════════════════════════
  // MAGNIFICATION CALC
  // ════════════════════════════════════════════
  function calcMag() {
    const scope = SCOPES[state.scope];
    if (scope.eyepieceLock) return { mag: scope.fixedMag, fov: scope.fov, exitPupil: scope.aperture / scope.fixedMag };
    let ep = state.eyepiece;
    if (state.barlowActive) ep = ep / 2;
    const mag = scope.focalLength / ep;
    const fov = 60 / mag;  // approximate apparent fov 60°
    const exitPupil = scope.aperture / mag;
    return { mag: Math.round(mag), fov: fov.toFixed(2), exitPupil: exitPupil.toFixed(1) };
  }

  function updateMagDisplay() {
    const { mag, fov, exitPupil } = calcMag();
    document.getElementById('mag-val').textContent = mag + '×';
    document.getElementById('fov-val').textContent = fov + '°';
    document.getElementById('exit-pupil').textContent = exitPupil + 'mm';
    document.getElementById('zoom-val-display').textContent = state.zoom.toFixed(1) + '×';
    document.getElementById('zoom-readout').textContent = state.zoom.toFixed(1) + '×';
  }

  // ════════════════════════════════════════════
  // SCOPE INFO PANEL
  // ════════════════════════════════════════════
  function updateScopeInfo() {
    const scope = SCOPES[state.scope];
    document.getElementById('spec-type').textContent = scope.type;
    document.getElementById('spec-aperture').textContent = scope.aperture + 'mm';
    document.getElementById('spec-fl').textContent = scope.focalLength + 'mm';
    document.getElementById('spec-maxmag').textContent = scope.maxMag + '×';
    document.getElementById('spec-limmag').textContent = scope.limitingMag.toFixed(1);
    document.getElementById('spec-res').textContent = scope.resolvingPower.toFixed(2) + '″';
    document.getElementById('spec-light').textContent = Math.round(scope.lightGather) + '×';
    drawScopeDiagram();
    updateDYK();
  }

  function drawScopeDiagram() {
    const dc = document.getElementById('scope-diagram');
    const dctx = dc.getContext('2d');
    const dw = dc.width, dh = dc.height;
    dctx.clearRect(0,0,dw,dh);
    dctx.fillStyle = '#050a15';
    dctx.fillRect(0,0,dw,dh);

    const scope = SCOPES[state.scope];
    dctx.strokeStyle = '#3a6090';
    dctx.lineWidth = 1.5;
    dctx.fillStyle = '#1a3060';

    if (scope.ringStyle === 'binocular') {
      // Draw binoculars shape
      dctx.strokeStyle = '#5090c0';
      // Left barrel
      dctx.beginPath(); dctx.roundRect(30,20,50,80,8); dctx.stroke(); dctx.fill();
      // Right barrel
      dctx.beginPath(); dctx.roundRect(110,20,50,80,8); dctx.stroke(); dctx.fill();
      // Bridge
      dctx.beginPath(); dctx.rect(78,45,34,20); dctx.stroke(); dctx.fill();
      // Lenses
      dctx.strokeStyle = '#80c8ff';
      dctx.fillStyle = 'rgba(40,100,180,0.4)';
      dctx.beginPath(); dctx.arc(55,88,18,0,Math.PI*2); dctx.stroke(); dctx.fill();
      dctx.beginPath(); dctx.arc(135,88,18,0,Math.PI*2); dctx.stroke(); dctx.fill();
    } else if (scope.ringStyle === 'refractor') {
      // Refractor tube
      dctx.beginPath(); dctx.roundRect(20,45,140,30,4); dctx.stroke(); dctx.fill();
      dctx.strokeStyle = '#80c8ff'; dctx.fillStyle = 'rgba(40,100,180,0.5)';
      dctx.beginPath(); dctx.arc(22,60,18,0,Math.PI*2); dctx.stroke(); dctx.fill();
      dctx.fillStyle = '#2a4070';
      dctx.fillRect(155,48,30,24);
      dctx.strokeStyle = '#a0c8e0';
      dctx.beginPath(); dctx.rect(160,50,20,20); dctx.stroke();
    } else if (scope.ringStyle === 'reflector' || scope.ringStyle === 'sct') {
      // Reflector tube
      dctx.beginPath(); dctx.roundRect(20,45,130,30,4); dctx.stroke(); dctx.fill();
      dctx.strokeStyle = '#80c8ff'; dctx.fillStyle = 'rgba(30,60,120,0.4)';
      dctx.beginPath(); dctx.arc(148,60,18,0,Math.PI*2); dctx.stroke(); dctx.fill();
      // Mirror
      dctx.strokeStyle = '#c0d8e0';
      dctx.beginPath(); dctx.arc(28,60,12,0,Math.PI*2); dctx.stroke();
      // Focuser on side
      dctx.fillStyle = '#2a4070'; dctx.strokeStyle = '#5080a0';
      dctx.beginPath(); dctx.roundRect(85,30,24,16,3); dctx.stroke(); dctx.fill();
    } else if (scope.ringStyle === 'observatory') {
      // Dome shape
      dctx.strokeStyle = '#a080c0';
      dctx.beginPath();
      dctx.arc(110,80,60,Math.PI,0);
      dctx.lineTo(170,80); dctx.lineTo(50,80); dctx.closePath();
      dctx.stroke(); dctx.fill();
      // Slit
      dctx.strokeStyle = '#e0c080';
      dctx.beginPath(); dctx.rect(100,25,20,55); dctx.stroke();
      // Telescope inside
      dctx.strokeStyle = '#8080c0';
      dctx.beginPath(); dctx.roundRect(105,30,10,50,3); dctx.stroke();
    }

    // Label
    dctx.font = '9px JetBrains Mono, monospace';
    dctx.fillStyle = '#5080a0';
    dctx.textAlign = 'center';
    dctx.fillText(scope.aperture + 'mm · ' + scope.type.split(' ').slice(0,2).join(' '), dw/2, dh-6);
    dctx.textAlign = 'left';
  }

  function updateDYK() {
    const scope = SCOPES[state.scope];
    const tip = scope.tips[Math.floor(Math.random() * scope.tips.length)];
    document.getElementById('dyk-text').textContent = tip;
  }

  // ════════════════════════════════════════════
  // VISIBLE OBJECTS LIST
  // ════════════════════════════════════════════
  function updateVisibleObjects() {
    const jd = Astronomy.julianDate();
    const lst = Astronomy.localSiderealTime(jd, state.lon);
    const scope = SCOPES[state.scope];
    const fovHalf = scope.fov / state.zoom;

    const visible = [];
    Astronomy.DSO.forEach(obj => {
      if (obj.mag > scope.limitingMag + 3) return;
      const horiz = Astronomy.equatorialToHorizontal(obj.ra, obj.dec, state.lat, lst);
      if (horiz.alt < 5) return;
      const dAz = Math.abs(((horiz.az - state.az + 540) % 360) - 180);
      const dAlt = Math.abs(horiz.alt - state.alt);
      const inView = dAz < fovHalf && dAlt < fovHalf;
      visible.push({ ...obj, alt: horiz.alt, az: horiz.az, inView });
    });

    visible.sort((a,b) => a.inView ? -1 : 1);
    const list = document.getElementById('obj-list');
    list.innerHTML = '';
    visible.slice(0,8).forEach(obj => {
      const div = document.createElement('div');
      div.className = 'obj-item';
      if (obj.inView) div.style.borderColor = 'rgba(212,168,67,0.4)';
      div.innerHTML = `
        <div>
          <span class="obj-name">${obj.emoji || '○'} ${obj.name}</span>
          <span class="obj-type">${obj.type.toUpperCase()}</span>
        </div>
        <span class="obj-alt">${obj.alt.toFixed(0)}°</span>
      `;
      div.addEventListener('click', () => {
        state.az = obj.az;
        state.alt = Math.max(5, obj.alt);
        updateSliders();
        render();
      });
      list.appendChild(div);
    });

    if (visible.length === 0) {
      list.innerHTML = '<div style="color:var(--text-muted);font-size:12px;padding:8px;">No objects above horizon</div>';
    }
  }

  // ════════════════════════════════════════════
  // TOOLTIP / HOVER
  // ════════════════════════════════════════════
  function findObjectAtCanvas(x, y) {
    const jd = Astronomy.julianDate();
    const lst = Astronomy.localSiderealTime(jd, state.lon);
    let best = null, bestDist = 20;

    // Check bright stars
    Astronomy.STARS.forEach(star => {
      const horiz = Astronomy.equatorialToHorizontal(star[1], star[2], state.lat, lst);
      const p = skyToCanvas(horiz.alt, horiz.az);
      const dist = Math.hypot(p.x - x, p.y - y);
      if (dist < bestDist && horiz.alt > 0) {
        bestDist = dist;
        best = { name: star[0], type: `${star[4]} Star · ${star[5]}`, mag: `Mag ${star[3].toFixed(2)}`, coords: `Alt ${horiz.alt.toFixed(1)}° Az ${horiz.az.toFixed(1)}°`, fact: star[6] };
      }
    });

    // Check DSOs
    Astronomy.DSO.forEach(obj => {
      const horiz = Astronomy.equatorialToHorizontal(obj.ra, obj.dec, state.lat, lst);
      const p = skyToCanvas(horiz.alt, horiz.az);
      const dist = Math.hypot(p.x - x, p.y - y);
      if (dist < bestDist + 5 && horiz.alt > 0) {
        bestDist = dist;
        best = { name: `${obj.id}: ${obj.name}`, type: `${obj.type.toUpperCase()} · ${obj.dist}`, mag: `Mag ${obj.mag}`, coords: obj.desc };
      }
    });

    return best;
  }

  // ════════════════════════════════════════════
  // CLOCK
  // ════════════════════════════════════════════
  function updateClock() {
    const now = new Date();
    const utc = now.toUTCString().match(/(\d+:\d+:\d+)/)?.[1] || '--:--:--';
    document.getElementById('live-time').textContent = utc + ' UTC';
    // Local time for selected location
    const loc = document.getElementById('location-select').value;
    const locData = LOCATION_DATA[loc];
    if (locData) {
      const tz = locData.timezone;
      const localMs = now.getTime() + (tz * 3600 + now.getTimezoneOffset() * 60) * 1000;
      const local = new Date(localMs);
      const h = local.getHours().toString().padStart(2,'0');
      const m = local.getMinutes().toString().padStart(2,'0');
      document.getElementById('local-time-display').textContent = h + ':' + m;
    }
  }

  // ════════════════════════════════════════════
  // LOCATION CHANGE
  // ════════════════════════════════════════════
  function handleLocationChange() {
    const val = document.getElementById('location-select').value;
    const parts = val.split(',');
    state.lat = parseFloat(parts[0]);
    state.lon = parseFloat(parts[1]);
    state.locationName = parts.slice(2).join(',');

    const locData = LOCATION_DATA[val] || { bortle: 5, alt: 50, seeing: 'average' };
    state.bortle = locData.bortle;

    // Update coord display
    const latStr = Math.abs(state.lat).toFixed(2) + '° ' + (state.lat >= 0 ? 'N' : 'S');
    const lonStr = Math.abs(state.lon).toFixed(2) + '° ' + (state.lon >= 0 ? 'E' : 'W');
    document.getElementById('coord-lat').textContent = latStr;
    document.getElementById('coord-lon').textContent = lonStr;
    document.getElementById('coord-alt').textContent = locData.alt + 'm asl';

    // Bortle
    document.getElementById('bortle-val').textContent = state.bortle;
    document.getElementById('bortle-desc').textContent = BORTLE_DESC[state.bortle] || 'Unknown';
    updateBortleDots();

    // Seeing
    const seeingMap = {
      exceptional: { stars: '★★★★★', label: 'Exceptional', cls: 'good' },
      excellent:   { stars: '★★★★★', label: 'Excellent',   cls: 'good' },
      good:        { stars: '★★★★☆', label: 'Good Seeing', cls: 'good' },
      average:     { stars: '★★★☆☆', label: 'Average',     cls: 'average' },
      poor:        { stars: '★★☆☆☆', label: 'Poor Seeing', cls: 'poor' },
    };
    const s = seeingMap[locData.seeing] || seeingMap.average;
    const sd = document.getElementById('seeing-display');
    sd.innerHTML = `<span>${s.stars}</span><span id="seeing-label">${s.label}</span>`;
    sd.className = 'seeing-badge ' + s.cls;

    fieldStarCache = null;
    render();
    updateVisibleObjects();
  }

  function updateBortleDots() {
    const container = document.getElementById('bortle-dots');
    container.innerHTML = '';
    for (let i = 1; i <= 9; i++) {
      const d = document.createElement('div');
      d.className = 'bortle-dot' + (i <= state.bortle ? ' active' : '');
      container.appendChild(d);
    }
  }

  // ════════════════════════════════════════════
  // FOCUS
  // ════════════════════════════════════════════
  function updateFocus(val) {
    state.focusPos = val;
    const ep = document.getElementById('focus-ep');
    const pos = (val / 100) * 60;
    ep.style.left = pos + 'px';
    const dist = Math.abs(val - 50);
    const quality = 100 - dist * 2;
    const bar = document.getElementById('fq-bar');
    const lbl = document.getElementById('fq-label');
    const pct = 50 - dist;
    bar.style.background = `linear-gradient(to right, transparent ${50-pct}%, ${quality>70?'#3ac870':quality>40?'#e8a030':'#d04050'} ${50-pct}% ${50+pct}%, transparent ${50+pct}%)`;
    if (dist < 5) { lbl.textContent = '⬤ In Focus'; lbl.style.color = 'var(--success)'; }
    else if (dist < 15) { lbl.textContent = '◐ Near Focus'; lbl.style.color = 'var(--warning)'; }
    else { lbl.textContent = '○ Out of Focus'; lbl.style.color = 'var(--danger)'; }
    document.getElementById('focus-readout').textContent = dist < 5 ? 'Optimal Focus' : dist < 15 ? 'Nearly there…' : val < 50 ? 'Too near (rack out)' : 'Too far (rack in)';
    // Blur canvas based on focus quality
    const blur = Math.max(0, dist * 0.05);
    document.getElementById('sky-canvas').style.filter = blur > 0 ? `blur(${blur}px)` : '';
  }

  // ════════════════════════════════════════════
  // SLIDERS
  // ════════════════════════════════════════════
  function updateSliders() {
    document.getElementById('az-slider').value = state.az;
    document.getElementById('alt-slider').value = state.alt;
    document.getElementById('zoom-slider').value = state.zoom;
    document.getElementById('az-readout').textContent = Math.round(state.az) + '°';
    document.getElementById('alt-readout').textContent = Math.round(state.alt) + '°';
    document.getElementById('zoom-readout').textContent = state.zoom.toFixed(1) + '×';
    document.getElementById('zoom-val-display').textContent = state.zoom.toFixed(1) + '×';
  }

  // ════════════════════════════════════════════
  // GUIDE SECTION
  // ════════════════════════════════════════════
  function buildGuideSection() {
    const grid = document.getElementById('guide-grid');
    Object.keys(SCOPES).forEach(key => {
      const scope = SCOPES[key];
      const card = document.createElement('div');
      card.className = 'guide-card';
      card.innerHTML = `
        <div class="guide-card-header">
          <span class="guide-card-icon">${key === 'binoculars' ? '🔭' : key === 'observatory' ? '🏛' : '🔭'}</span>
          <div>
            <div class="guide-card-title">${scope.name}</div>
            <div class="guide-card-level">${scope.type}</div>
          </div>
        </div>
        <div class="guide-card-body">
          <p>${scope.description}</p>
          <div class="guide-features">
            ${scope.tips.map(t => `<div class="guide-feature">${t}</div>`).join('')}
          </div>
          <table class="guide-specs-table">
            <tr><td>Aperture</td><td>${scope.aperture}mm</td></tr>
            <tr><td>Focal Length</td><td>${scope.focalLength}mm</td></tr>
            <tr><td>Limiting Magnitude</td><td>${scope.limitingMag}</td></tr>
            <tr><td>Resolving Power</td><td>${scope.resolvingPower}"</td></tr>
            <tr><td>Light Gathering</td><td>${scope.lightGather}× naked eye</td></tr>
            <tr><td>Max Magnification</td><td>${scope.maxMag}×</td></tr>
          </table>
        </div>
      `;
      card.addEventListener('click', () => {
        document.querySelector('.nav-btn[data-section="observatory"]').click();
        selectScope(key);
      });
      grid.appendChild(card);
    });
  }

  // ════════════════════════════════════════════
  // CATALOGUE SECTION
  // ════════════════════════════════════════════
  function buildCatalogue() {
    renderCatalogue('all', '');
  }

  function renderCatalogue(filter, search) {
    const grid = document.getElementById('catalogue-grid');
    grid.innerHTML = '';
    let items = Astronomy.DSO;
    if (filter !== 'all') items = items.filter(o => o.type === filter);
    if (search) {
      const s = search.toLowerCase();
      items = items.filter(o => o.name.toLowerCase().includes(s) || o.id.toLowerCase().includes(s));
    }
    items.forEach(obj => {
      const card = document.createElement('div');
      card.className = 'cat-card';
      const typeColors = { galaxy: '#a080c0', nebula: '#60c0d0', cluster: '#d0a040', double: '#ffc060', planet: '#c08050' };
      card.innerHTML = `
        <div class="cat-card-img" style="background:linear-gradient(135deg,${typeColors[obj.type]||'#4060a0'}18,#080d20)">
          <span style="font-size:50px;filter:drop-shadow(0 0 12px ${typeColors[obj.type]||'#4060a0'})">${obj.emoji||'○'}</span>
        </div>
        <div class="cat-card-body">
          <div class="cat-card-name">${obj.id}: ${obj.name}</div>
          <div class="cat-card-altname">${obj.type.charAt(0).toUpperCase()+obj.type.slice(1)} · ${obj.dist}</div>
          <div class="cat-card-meta">
            <div class="cat-meta-item"><span>Mag </span><span>${obj.mag}</span></div>
            <div class="cat-meta-item"><span>Size </span><span>${obj.size}</span></div>
          </div>
          <div style="margin-top:8px;font-size:11px;color:var(--text-secondary);line-height:1.5">${obj.desc}</div>
        </div>
      `;
      card.addEventListener('click', () => {
        document.querySelector('.nav-btn[data-section="observatory"]').click();
        const jd = Astronomy.julianDate();
        const lst = Astronomy.localSiderealTime(jd, state.lon);
        const horiz = Astronomy.equatorialToHorizontal(obj.ra, obj.dec, state.lat, lst);
        if (horiz.alt > 0) {
          state.az = horiz.az;
          state.alt = horiz.alt;
          updateSliders();
          render();
          updateVisibleObjects();
        } else {
          alert(`${obj.name} is currently below the horizon from ${state.locationName}.\nTry a different location or wait for it to rise.`);
        }
      });
      grid.appendChild(card);
    });
    if (items.length === 0) {
      grid.innerHTML = '<p style="color:var(--text-muted);grid-column:1/-1;text-align:center;padding:40px">No objects found.</p>';
    }
  }

  // ════════════════════════════════════════════
  // SELECT SCOPE
  // ════════════════════════════════════════════
  function selectScope(key) {
    state.scope = key;
    document.querySelectorAll('.scope-card').forEach(c => {
      c.classList.toggle('active', c.dataset.scope === key);
    });
    const scope = SCOPES[key];
    document.querySelectorAll('.ep-btn').forEach(b => b.style.opacity = scope.eyepieceLock ? '0.3' : '1');
    updateScopeInfo();
    updateMagDisplay();
    updateVisibleObjects();
    render();
  }

  // ════════════════════════════════════════════
  // RANDOM FACTS ROTATOR
  // ════════════════════════════════════════════
  let factIndex = 0;
  function rotateFact() {
    factIndex = (factIndex + 1) % FACTS.length;
    const el = document.getElementById('dyk-text');
    el.style.opacity = '0';
    setTimeout(() => {
      el.textContent = FACTS[factIndex];
      el.style.opacity = '1';
    }, 400);
  }

  // ════════════════════════════════════════════
  // INIT & EVENT WIRING
  // ════════════════════════════════════════════
  function init() {
    initCanvas();

    // === Loading screen ===
    setTimeout(() => {
      document.getElementById('loading-screen').classList.add('fade-out');
      setTimeout(() => document.getElementById('loading-screen').remove(), 800);
    }, 2600);

    // === Nav ===
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const sec = btn.dataset.section;
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b === btn));
        document.querySelectorAll('.app-section').forEach(s => s.classList.toggle('active', s.id === 'section-' + sec));
        if (sec === 'observatory') { resizeCanvas(); updateVisibleObjects(); }
      });
    });

    // === Telescope selection ===
    document.querySelectorAll('.scope-card').forEach(card => {
      card.addEventListener('click', () => selectScope(card.dataset.scope));
    });

    // === Eyepiece selection ===
    document.querySelectorAll('.ep-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.ep === 'barlow') {
          btn.classList.toggle('active');
          state.barlowActive = btn.classList.contains('active');
        } else {
          document.querySelectorAll('.ep-btn').forEach(b => { if (b.dataset.ep !== 'barlow') b.classList.remove('active'); });
          btn.classList.add('active');
          state.eyepiece = parseInt(btn.dataset.ep);
        }
        updateMagDisplay();
        render();
      });
    });

    // === Sliders ===
    document.getElementById('az-slider').addEventListener('input', e => {
      state.az = parseFloat(e.target.value);
      document.getElementById('az-readout').textContent = Math.round(state.az) + '°';
      render();
    });
    document.getElementById('alt-slider').addEventListener('input', e => {
      state.alt = parseFloat(e.target.value);
      document.getElementById('alt-readout').textContent = Math.round(state.alt) + '°';
      render();
    });
    document.getElementById('zoom-slider').addEventListener('input', e => {
      state.zoom = parseFloat(e.target.value);
      updateMagDisplay();
      render();
    });
    document.getElementById('focus-slider').addEventListener('input', e => {
      updateFocus(parseInt(e.target.value));
    });

    // === Arrow buttons ===
    document.getElementById('az-left').addEventListener('click', () => { state.az = Astronomy.norm360(state.az - 5); updateSliders(); render(); });
    document.getElementById('az-right').addEventListener('click', () => { state.az = Astronomy.norm360(state.az + 5); updateSliders(); render(); });
    document.getElementById('alt-up').addEventListener('click', () => { state.alt = Math.min(90, state.alt + 5); updateSliders(); render(); });
    document.getElementById('alt-down').addEventListener('click', () => { state.alt = Math.max(0, state.alt - 5); updateSliders(); render(); });
    document.getElementById('zoom-in').addEventListener('click', () => { state.zoom = Math.min(20, state.zoom + 0.5); updateSliders(); render(); });
    document.getElementById('zoom-out').addEventListener('click', () => { state.zoom = Math.max(1, state.zoom - 0.5); updateSliders(); render(); });

    // === Toggles ===
    const toggleMap = {
      'tog-constellations': 'showConstellations',
      'tog-labels': 'showLabels',
      'tog-grid': 'showGrid',
      'tog-milkyway': 'showMilkyWay',
      'tog-planets': 'showPlanets',
      'tog-tracking': 'tracking'
    };
    Object.keys(toggleMap).forEach(id => {
      document.getElementById(id).addEventListener('click', function() {
        this.classList.toggle('active');
        state[toggleMap[id]] = this.classList.contains('active');
        if (id === 'tog-tracking') {
          if (state.tracking) {
            state.trackingInterval = setInterval(() => { state.az = (state.az + 0.002) % 360; updateSliders(); render(); }, 100);
          } else {
            clearInterval(state.trackingInterval);
          }
        }
        render();
      });
    });

    // === Canvas mouse drag ===
    canvas.addEventListener('mousedown', e => {
      state.dragStart = { x: e.clientX, y: e.clientY };
      state.azAtDrag = state.az;
      state.altAtDrag = state.alt;
    });
    canvas.addEventListener('mousemove', e => {
      if (state.dragStart) {
        const dx = e.clientX - state.dragStart.x;
        const dy = e.clientY - state.dragStart.y;
        const scope = SCOPES[state.scope];
        const fovHalf = scope.fov / state.zoom;
        const scale = (W / 2) / fovHalf;
        const dAz = -dx / (scale * Math.cos(state.alt * Astronomy.RAD));
        const dAlt = dy / scale;
        state.az = Astronomy.norm360(state.azAtDrag + dAz);
        state.alt = Math.max(0, Math.min(90, state.altAtDrag + dAlt));
        updateSliders();
        render();
      }
      // Tooltip
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const obj = findObjectAtCanvas(x, y);
      const tooltip = document.getElementById('sky-tooltip');
      if (obj) {
        tooltip.classList.remove('hidden');
        tooltip.style.left = (x + 16) + 'px';
        tooltip.style.top = (y - 20) + 'px';
        document.getElementById('tip-name').textContent = obj.name;
        document.getElementById('tip-type').textContent = obj.type;
        document.getElementById('tip-mag').textContent = obj.mag;
        document.getElementById('tip-coords').textContent = obj.coords;
      } else {
        tooltip.classList.add('hidden');
      }
    });
    canvas.addEventListener('mouseup', () => { state.dragStart = null; });
    canvas.addEventListener('mouseleave', () => {
      state.dragStart = null;
      document.getElementById('sky-tooltip').classList.add('hidden');
    });

    // Touch drag
    canvas.addEventListener('touchstart', e => {
      const t = e.touches[0];
      state.dragStart = { x: t.clientX, y: t.clientY };
      state.azAtDrag = state.az; state.altAtDrag = state.alt;
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchmove', e => {
      if (!state.dragStart) return;
      const t = e.touches[0];
      const dx = t.clientX - state.dragStart.x;
      const dy = t.clientY - state.dragStart.y;
      const scope = SCOPES[state.scope];
      const fovHalf = scope.fov / state.zoom;
      const scale = (W / 2) / fovHalf;
      state.az = Astronomy.norm360(state.azAtDrag - dx / (scale * Math.cos(state.alt * Astronomy.RAD)));
      state.alt = Math.max(0, Math.min(90, state.altAtDrag + dy / scale));
      updateSliders();
      render();
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchend', () => { state.dragStart = null; });

    // Scroll to zoom
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.5 : -0.5;
      state.zoom = Math.max(1, Math.min(20, state.zoom + delta));
      updateSliders();
      updateMagDisplay();
      render();
    }, { passive: false });

    // === Location ===
    document.getElementById('location-select').addEventListener('change', handleLocationChange);

    // === Catalogue ===
    document.getElementById('cat-search').addEventListener('input', e => {
      const filter = document.querySelector('.cat-filter.active').dataset.type;
      renderCatalogue(filter, e.target.value);
    });
    document.querySelectorAll('.cat-filter').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.cat-filter').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderCatalogue(btn.dataset.type, document.getElementById('cat-search').value);
      });
    });

    // === Keyboard shortcuts ===
    document.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      const step = e.shiftKey ? 10 : 2;
      switch(e.key) {
        case 'ArrowLeft':  state.az = Astronomy.norm360(state.az - step); break;
        case 'ArrowRight': state.az = Astronomy.norm360(state.az + step); break;
        case 'ArrowUp':    state.alt = Math.min(90, state.alt + step); break;
        case 'ArrowDown':  state.alt = Math.max(0, state.alt - step); break;
        case '+': case '=': state.zoom = Math.min(20, state.zoom + 0.5); break;
        case '-': state.zoom = Math.max(1, state.zoom - 0.5); break;
        case 'g': document.getElementById('tog-grid').click(); break;
        case 'c': document.getElementById('tog-constellations').click(); break;
        case 'l': document.getElementById('tog-labels').click(); break;
        case 'm': document.getElementById('tog-milkyway').click(); break;
        case 'p': document.getElementById('tog-planets').click(); break;
        default: return;
      }
      e.preventDefault();
      updateSliders();
      updateMagDisplay();
      render();
    });

    // === Build static sections ===
    buildGuideSection();
    buildCatalogue();

    // === Initial state ===
    handleLocationChange();
    selectScope('refractor80');
    updateFocus(50);

    // === Live tick ===
    updateClock();
    setInterval(updateClock, 1000);
    setInterval(() => { render(); updateVisibleObjects(); }, 30000);
    setInterval(rotateFact, 15000);

    // First render
    render();
    updateMagDisplay();
    updateVisibleObjects();
  }

  // Run
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
