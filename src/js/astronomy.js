/**
 * ═══════════════════════════════════════════════════════
 * STELLARIS — Astronomy Engine
 * Accurate celestial mechanics for real-time sky rendering
 * Based on Jean Meeus "Astronomical Algorithms"
 * ═══════════════════════════════════════════════════════
 */

const Astronomy = (() => {

  // ── Constants ──────────────────────────────────────────
  const RAD = Math.PI / 180;
  const DEG = 180 / Math.PI;
  const J2000 = 2451545.0;  // J2000.0 Julian Date

  // ── Julian Date ────────────────────────────────────────
  function julianDate(date = new Date()) {
    return date.getTime() / 86400000 + 2440587.5;
  }

  function julianCenturies(jd) {
    return (jd - J2000) / 36525;
  }

  // ── Normalize angle to [0,360) ─────────────────────────
  function norm360(a) {
    return ((a % 360) + 360) % 360;
  }

  function norm180(a) {
    a = norm360(a);
    return a > 180 ? a - 360 : a;
  }

  // ── Sidereal Time ──────────────────────────────────────
  function greenwichSiderealTime(jd) {
    const T = julianCenturies(jd);
    let GST = 280.46061837 + 360.98564736629 * (jd - J2000)
            + 0.000387933 * T * T - T * T * T / 38710000;
    return norm360(GST);
  }

  function localSiderealTime(jd, longitude) {
    return norm360(greenwichSiderealTime(jd) + longitude);
  }

  // ── RA/Dec → Altitude/Azimuth ──────────────────────────
  function equatorialToHorizontal(ra, dec, lat, lst) {
    const H = norm360(lst - ra);
    const Hrad = H * RAD;
    const decRad = dec * RAD;
    const latRad = lat * RAD;
    const sinAlt = Math.sin(decRad) * Math.sin(latRad)
                 + Math.cos(decRad) * Math.cos(latRad) * Math.cos(Hrad);
    const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt))) * DEG;
    const cosA = (Math.sin(decRad) - Math.sin(alt * RAD) * Math.sin(latRad))
               / (Math.cos(alt * RAD) * Math.cos(latRad));
    let az = Math.acos(Math.max(-1, Math.min(1, cosA))) * DEG;
    if (Math.sin(Hrad) > 0) az = 360 - az;
    return { alt, az: norm360(az) };
  }

  // ── Sun position (simplified VSOP87) ──────────────────
  function sunPosition(jd) {
    const T = julianCenturies(jd);
    const L0 = norm360(280.46646 + 36000.76983 * T);
    const M = norm360(357.52911 + 35999.05029 * T - 0.0001537 * T * T);
    const Mrad = M * RAD;
    const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mrad)
            + (0.019993 - 0.000101 * T) * Math.sin(2 * Mrad)
            + 0.000289 * Math.sin(3 * Mrad);
    const sunLon = L0 + C;
    const e = 0.016708634 - 0.000042037 * T;
    const R = 1.000001018 * (1 - e * e) / (1 + e * Math.cos((M + C) * RAD));
    // Obliquity
    const eps = 23.439291111 - 0.013004167 * T;
    const lambdaRad = sunLon * RAD;
    const epsRad = eps * RAD;
    const ra = Math.atan2(Math.cos(epsRad) * Math.sin(lambdaRad), Math.cos(lambdaRad)) * DEG;
    const dec = Math.asin(Math.sin(epsRad) * Math.sin(lambdaRad)) * DEG;
    return { ra: norm360(ra), dec, distance: R, magnitude: -26.74 };
  }

  // ── Moon position (simplified) ─────────────────────────
  function moonPosition(jd) {
    const T = julianCenturies(jd);
    const L = norm360(218.3164477 + 481267.88123421 * T);
    const D = norm360(297.8501921 + 445267.1114034 * T);
    const M = norm360(357.5291092 + 35999.0502909 * T);
    const Mprime = norm360(134.9633964 + 477198.8675055 * T);
    const F = norm360(93.2720950 + 483202.0175233 * T);
    const Drad = D * RAD, Mrad = M * RAD, Mprad = Mprime * RAD, Frad = F * RAD;
    let SL = 6288774 * Math.sin(Mprad)
           + 1274027 * Math.sin(2 * Drad - Mprad)
           + 658314 * Math.sin(2 * Drad)
           + 213618 * Math.sin(2 * Mprad)
           - 185116 * Math.sin(Mrad);
    SL /= 1000000;
    let SB = 5128122 * Math.sin(Frad)
           + 280602 * Math.sin(Mprad + Frad)
           + 277693 * Math.sin(Mprad - Frad);
    SB /= 1000000;
    const moonLon = norm360(L + SL);
    const moonLat = SB;
    const eps = 23.439291111 - 0.013004167 * T;
    const epsRad = eps * RAD;
    const lonRad = moonLon * RAD;
    const latRad = moonLat * RAD;
    const ra = Math.atan2(
      Math.cos(epsRad) * Math.sin(lonRad) - Math.tan(latRad) * Math.sin(epsRad),
      Math.cos(lonRad)
    ) * DEG;
    const dec = Math.asin(
      Math.sin(latRad) * Math.cos(epsRad) + Math.cos(latRad) * Math.sin(epsRad) * Math.sin(lonRad)
    ) * DEG;
    // Phase (0=new, 0.5=full, 1=new)
    const phase = ((norm360(moonLon - sunPosition(jd).ra) / 360));
    return { ra: norm360(ra), dec, phase, magnitude: -12.7 };
  }

  // ── Planet positions (mean orbital elements) ──────────
  const PLANETS = {
    mercury: {
      name: 'Mercury', symbol: '☿', color: '#c0a080',
      a: 0.387098, e: 0.205630, i: 7.005,
      L0: 252.250906, Ldot: 149474.0722491,
      w0: 77.456119, wdot: 0.1588643,
      Om0: 48.330893, Omdot: -0.1254229,
      size: 4.9
    },
    venus: {
      name: 'Venus', symbol: '♀', color: '#ffe0a0',
      a: 0.723332, e: 0.006773, i: 3.395,
      L0: 181.979801, Ldot: 58519.2130302,
      w0: 131.563495, wdot: 0.0048121,
      Om0: 76.679920, Omdot: -0.2780080,
      size: 12.1
    },
    mars: {
      name: 'Mars', symbol: '♂', color: '#ff7050',
      a: 1.523688, e: 0.093412, i: 1.850,
      L0: 355.433275, Ldot: 19141.6964746,
      w0: 336.060234, wdot: 0.4439016,
      Om0: 49.558093, Omdot: -0.2949846,
      size: 6.8
    },
    jupiter: {
      name: 'Jupiter', symbol: '♃', color: '#d0b090',
      a: 5.202887, e: 0.048775, i: 1.303,
      L0: 34.351519, Ldot: 3034.9056606,
      w0: 14.331289, wdot: 0.2155525,
      Om0: 100.464441, Omdot: 0.1767232,
      size: 71.4
    },
    saturn: {
      name: 'Saturn', symbol: '♄', color: '#e0d0a0',
      a: 9.536676, e: 0.055723, i: 2.489,
      L0: 50.077444, Ldot: 1222.1137943,
      w0: 93.056787, wdot: 0.5665496,
      Om0: 113.665524, Omdot: -0.2357,
      size: 60.3
    }
  };
  // Fix typo
  PLANETS.saturn.Omdot = -0.2357;

  function planetPosition(planetKey, jd) {
    const p = PLANETS[planetKey];
    if (!p) return null;
    const T = julianCenturies(jd);
    const L = norm360(p.L0 + p.Ldot * T / 36525);
    const w = p.w0 + p.wdot * T;
    const Om = p.Om0 + p.Omdot * T;
    const M = norm360(L - w);
    const Mrad = M * RAD;
    // Solve Kepler's equation (simplified)
    let E = Mrad;
    for (let i = 0; i < 5; i++) E = Mrad + p.e * Math.sin(E);
    const v = 2 * Math.atan2(Math.sqrt(1 + p.e) * Math.sin(E / 2), Math.sqrt(1 - p.e) * Math.cos(E / 2)) * DEG;
    const r = p.a * (1 - p.e * Math.cos(E));
    const lon = norm360(v + w);
    const latSin = Math.sin((lon - Om) * RAD) * Math.sin(p.i * RAD);
    const lat = Math.asin(latSin) * DEG;
    // Heliocentric → approximate RA/Dec (simplified)
    const eps = 23.439 - 0.013 * T;
    const epsRad = eps * RAD;
    const lonRad = lon * RAD;
    const ra = Math.atan2(Math.cos(epsRad) * Math.sin(lonRad), Math.cos(lonRad)) * DEG;
    const dec = Math.asin(Math.sin(epsRad) * Math.sin(lonRad)) * DEG;
    return { ra: norm360(ra), dec, distance: r };
  }

  // ── Star Catalogue (Bright Stars subset) ──────────────
  // [name, RA(deg), Dec(deg), magnitude, spectralType, constellation]
  const STARS = [
    // Orion
    ['Betelgeuse', 88.7929, 7.4071, 0.42, 'M2Ib', 'Orion', 'red giant, ~700 solar radii'],
    ['Rigel', 78.6345, -8.2016, 0.13, 'B8Ia', 'Orion', 'blue supergiant, 78 ly'],
    ['Bellatrix', 81.2828, 6.3497, 1.64, 'B2III', 'Orion', 'blue giant'],
    ['Mintaka', 83.0016, -0.2991, 2.23, 'O9.5II', 'Orion', 'Orion belt star'],
    ['Alnilam', 84.0534, -1.2019, 1.70, 'B0Ia', 'Orion', 'Orion belt, 2000 ly'],
    ['Alnitak', 85.1897, -1.9426, 1.77, 'O9.7Ib', 'Orion', 'Orion belt star'],
    ['Saiph', 86.9391, -9.6697, 2.07, 'B0.5Ia', 'Orion', 'Orion foot star'],
    // Ursa Major
    ['Dubhe', 165.9320, 61.7510, 1.81, 'K0III', 'Ursa Major', 'Big Dipper pointer'],
    ['Merak', 165.4603, 56.3824, 2.34, 'A1V', 'Ursa Major', 'Big Dipper pointer'],
    ['Phecda', 178.4577, 53.6948, 2.44, 'A0Ve', 'Ursa Major', 'Big Dipper'],
    ['Megrez', 183.8565, 57.0326, 3.31, 'A3V', 'Ursa Major', 'Big Dipper'],
    ['Alioth', 193.5073, 55.9598, 1.76, 'A0pCr', 'Ursa Major', 'Big Dipper handle'],
    ['Mizar', 200.9814, 54.9254, 2.04, 'A1V', 'Ursa Major', 'famous double star'],
    ['Alkaid', 206.8852, 49.3133, 1.85, 'B3V', 'Ursa Major', 'end of Big Dipper handle'],
    // Cassiopeia
    ['Schedar', 10.1268, 56.5373, 2.24, 'K0IIIa', 'Cassiopeia', 'orange giant'],
    ['Caph', 2.2945, 59.1498, 2.28, 'F2III', 'Cassiopeia', 'W star'],
    ['Gamma Cas', 14.1773, 60.7167, 2.15, 'B0IVe', 'Cassiopeia', 'variable blue star'],
    // Leo
    ['Regulus', 152.0929, 11.9672, 1.36, 'B7V', 'Leo', 'heart of the lion'],
    ['Denebola', 177.2649, 14.5720, 2.14, 'A3V', 'Leo', 'tail of lion'],
    ['Algieba', 154.1727, 19.8415, 1.98, 'K0III', 'Leo', 'beautiful double star'],
    // Scorpius
    ['Antares', 247.3519, -26.4320, 0.96, 'M1.5Iab', 'Scorpius', 'red supergiant, rival of Mars'],
    ['Shaula', 263.4022, -37.1038, 1.62, 'B1.5IV', 'Scorpius', 'scorpion sting'],
    ['Sargas', 264.3298, -42.9980, 1.86, 'F0Ib', 'Scorpius', 'scorpion tail'],
    // Other bright stars
    ['Sirius', 101.2872, -16.7161, -1.46, 'A1V', 'Canis Major', 'brightest star in sky, 8.6 ly'],
    ['Canopus', 95.9880, -52.6957, -0.72, 'A9II', 'Carina', 'navigation star'],
    ['Arcturus', 213.9153, 19.1824, -0.04, 'K1.5III', 'Boötes', 'red giant, 37 ly'],
    ['Vega', 279.2347, 38.7837, 0.03, 'A0Va', 'Lyra', 'former pole star, 25 ly'],
    ['Capella', 79.1723, 45.9980, 0.08, 'G5III', 'Auriga', 'goat star, 43 ly'],
    ['Procyon', 114.8255, 5.2250, 0.40, 'F5IV', 'Canis Minor', 'little dog star, 11 ly'],
    ['Achernar', 24.4285, -57.2367, 0.45, 'B6Vep', 'Eridanus', 'end of river'],
    ['Hadar', 210.9559, -60.3730, 0.60, 'B1III', 'Centaurus', 'neighbor of Rigil Kent'],
    ['Altair', 297.6958, 8.8683, 0.77, 'A7V', 'Aquila', 'eagle star, 17 ly'],
    ['Aldebaran', 68.9802, 16.5093, 0.85, 'K5III', 'Taurus', 'eye of the bull'],
    ['Spica', 201.2983, -11.1613, 0.97, 'B1V', 'Virgo', 'brightest in Virgo'],
    ['Pollux', 116.3289, 28.0262, 1.15, 'K0III', 'Gemini', 'twin star, has exoplanet'],
    ['Fomalhaut', 344.4127, -29.6223, 1.16, 'A3V', 'Piscis Austrinus', 'autumn solitary star'],
    ['Deneb', 310.3580, 45.2803, 1.25, 'A2Ia', 'Cygnus', 'tail of swan, very luminous'],
    ['Mimosa', 191.9303, -59.6888, 1.25, 'B0.5III', 'Crux', 'Southern Cross'],
    ['Acrux', 186.6495, -63.0990, 0.77, 'B0.5IV', 'Crux', 'Southern Cross pointer'],
    ['Castor', 113.6495, 31.8883, 1.58, 'A1V', 'Gemini', 'famous sextuple system'],
    ['Shaula', 263.4022, -37.1038, 1.62, 'B2IV', 'Scorpius', 'scorpion sting'],
    ['Polaris', 37.9529, 89.2641, 2.02, 'F7Ib', 'Ursa Minor', 'North Star, ~433 ly'],
    ['Alpheratz', 2.0969, 29.0904, 2.06, 'B8IVp', 'Andromeda', 'corner of Pegasus Square'],
    ['Mirach', 17.4330, 35.6205, 2.06, 'M0III', 'Andromeda', 'guide to M31'],
    ['Almach', 30.9753, 42.3298, 2.10, 'K3IIb', 'Andromeda', 'beautiful triple star'],
    ['Hamal', 31.7933, 23.4624, 2.01, 'K2III', 'Aries', 'head of ram'],
    ['Menkar', 45.5698, 4.0897, 2.54, 'M2III', 'Cetus', 'jaw of whale'],
    ['Alnair', 332.0583, -46.9606, 1.73, 'B7IV', 'Grus', 'tail of crane'],
    ['Elnath', 81.5729, 28.6075, 1.65, 'B7III', 'Taurus', 'tip of bull horn'],
    ['Mirfak', 51.0807, 49.8612, 1.80, 'F5Ib', 'Perseus', 'hand of Perseus'],
    ['Sadalsuud', 322.1500, -5.5712, 2.91, 'G0Ib', 'Aquarius', 'luckiest of the lucky'],
    ['Fomalhaut', 344.4127, -29.6223, 1.16, 'A3V', 'Piscis Austrinus', 'autumn solitary'],
    // Extra faint stars for field density
    ['Iota Ori', 83.8583, -5.9097, 2.77, 'O9III', 'Orion', ''],
    ['Kappa Ori', 86.9391, -9.6697, 2.07, 'B0.5Ia', 'Orion', ''],
    ['Theta1 Ori', 83.8218, -5.3911, 5.13, 'O6', 'Orion', 'Trapezium cluster core'],
    ['Pi3 Ori', 72.4601, 6.9612, 3.19, 'F6V', 'Orion', ''],
    ['Eta UMa', 206.8852, 49.3133, 1.86, 'B3V', 'Ursa Major', ''],
    ['Phad', 178.4577, 53.6948, 2.44, 'A0Ve', 'Ursa Major', ''],
    ['Beta Leo', 177.2649, 14.5720, 2.14, 'A3V', 'Leo', ''],
    ['Sigma Sgr', 283.8164, -26.2967, 2.02, 'B2.5V', 'Sagittarius', 'kaus australis companion'],
    ['Lambda Sgr', 276.0428, -25.4217, 2.81, 'K0IV', 'Sagittarius', ''],
    ['Kaus Australis', 276.0428, -34.3843, 1.79, 'B9.5III', 'Sagittarius', 'brightest in Sagittarius'],
    ['Nunki', 283.8164, -26.2967, 2.02, 'B2.5V', 'Sagittarius', ''],
    ['Theta Sco', 264.3298, -42.9980, 1.86, 'F0Ib', 'Scorpius', ''],
    ['Eta Sco', 253.0844, -43.2397, 3.33, 'F2V', 'Scorpius', ''],
    ['Mu Sco', 253.0844, -38.0472, 2.70, 'B2IV', 'Scorpius', ''],
  ];

  // ── Deep Sky Objects ──────────────────────────────────
  const DSO = [
    { id:'M1',  name:'Crab Nebula',     ra:83.8221,  dec:22.0145, mag:8.4,  type:'nebula',   size:'7\'×5\'',  dist:'6,500 ly', desc:'Remnant of 1054 AD supernova, pulsar wind nebula', emoji:'💥' },
    { id:'M13', name:'Hercules Cluster',ra:250.4232, dec:36.4613, mag:5.8,  type:'cluster',  size:'20\'',     dist:'25,000 ly',desc:'Finest globular cluster in northern sky, ~300,000 stars', emoji:'✨' },
    { id:'M31', name:'Andromeda Galaxy',ra:10.6847,  dec:41.2691, mag:3.4,  type:'galaxy',   size:'3°×1°',   dist:'2.5M ly',  desc:'Nearest large galaxy, visible to naked eye in dark skies', emoji:'🌌' },
    { id:'M42', name:'Orion Nebula',    ra:83.8221,  dec:-5.3911, mag:4.0,  type:'nebula',   size:'65\'×60\'',dist:'1,344 ly', desc:'Stellar nursery with over 3,000 young stars forming', emoji:'🌫' },
    { id:'M45', name:'Pleiades',        ra:56.8500,  dec:24.1167, mag:1.6,  type:'cluster',  size:'110\'',    dist:'444 ly',   desc:'Seven Sisters — famous open cluster, 500 stars', emoji:'⭐' },
    { id:'M51', name:'Whirlpool Galaxy',ra:202.4696, dec:47.1952, mag:8.4,  type:'galaxy',   size:'11\'×7\'', dist:'23M ly',   desc:'Classic face-on spiral interacting with NGC 5195', emoji:'🌀' },
    { id:'M57', name:'Ring Nebula',     ra:283.3965, dec:33.0297, mag:8.8,  type:'nebula',   size:'1\'',      dist:'2,300 ly', desc:'Planetary nebula — death shroud of a sun-like star', emoji:'⭕' },
    { id:'M81', name:'Bode\'s Galaxy',  ra:148.8882, dec:69.0653, mag:6.9,  type:'galaxy',   size:'26\'×14\'',dist:'12M ly',   desc:'Grand spiral galaxy in Ursa Major, companion to M82', emoji:'🌌' },
    { id:'M82', name:'Cigar Galaxy',    ra:148.9677, dec:69.6797, mag:8.4,  type:'galaxy',   size:'11\'×5\'', dist:'12M ly',   desc:'Starburst galaxy with spectacular hydrogen jets', emoji:'💫' },
    { id:'M97', name:'Owl Nebula',      ra:168.6993, dec:55.0191, mag:9.9,  type:'nebula',   size:'3\'',      dist:'2,030 ly', desc:'Planetary nebula with two dark "eye" cavities', emoji:'🦉' },
    { id:'M101',name:'Pinwheel Galaxy', ra:210.8024, dec:54.3490, mag:7.9,  type:'galaxy',   size:'28\'',     dist:'21M ly',   desc:'Face-on grand spiral galaxy in Ursa Major', emoji:'🌀' },
    { id:'NGC869',name:'Double Cluster',ra:34.7500,  dec:57.1333, mag:4.3,  type:'cluster',  size:'30\'',     dist:'7,500 ly', desc:'Spectacular pair of young open clusters in Perseus', emoji:'✨' },
    { id:'M104',name:'Sombrero Galaxy', ra:189.9978, dec:-11.6231,mag:8.0,  type:'galaxy',   size:'9\'×4\'',  dist:'29M ly',   desc:'Galaxy with prominent dust lane, like a Mexican hat', emoji:'🌌' },
    { id:'M3',  name:'Globular M3',     ra:205.5484, dec:28.3769, mag:6.2,  type:'cluster',  size:'18\'',     dist:'33,900 ly',desc:'One of the largest and finest globular clusters known', emoji:'✨' },
    { id:'NGC5139',name:'Omega Centauri',ra:201.6967,dec:-47.4794,mag:3.9, type:'cluster',  size:'36\'',     dist:'17,000 ly',desc:'Largest globular cluster in Milky Way, ~10M stars', emoji:'✨' },
    { id:'M8',  name:'Lagoon Nebula',   ra:270.9236, dec:-24.3800,mag:6.0,  type:'nebula',   size:'90\'×40\'',dist:'4,100 ly', desc:'Bright emission nebula with dark Hourglass Nebula inside', emoji:'🌫' },
    { id:'M20', name:'Trifid Nebula',   ra:270.6153, dec:-23.0333,mag:6.3,  type:'nebula',   size:'28\'',     dist:'5,200 ly', desc:'Divided by dark dust lanes into three lobes', emoji:'🔱' },
    { id:'NGC7293',name:'Helix Nebula', ra:337.4108, dec:-20.8372,mag:7.6,  type:'nebula',   size:'16\'',     dist:'650 ly',   desc:'Closest planetary nebula to Earth, "Eye of God"', emoji:'👁' },
    { id:'M11', name:'Wild Duck Cluster',ra:282.7667,dec:-6.2667, mag:5.8,  type:'cluster',  size:'14\'',     dist:'6,200 ly', desc:'Extremely rich open cluster, 2,900 stars', emoji:'🦆' },
    { id:'Albireo',name:'Albireo',      ra:292.6805, dec:27.9597, mag:3.1,  type:'double',   size:'34″',      dist:'380 ly',   desc:'Most beautiful double star: gold & blue-green pair', emoji:'💛' },
    { id:'EtaCar',name:'Eta Carinae',   ra:161.2647, dec:-59.6850,mag:4.3,  type:'nebula',   size:'8\'',      dist:'7,500 ly', desc:'Hypergiant on verge of supernova, in Carina Nebula', emoji:'💫' },
    { id:'Mizar',name:'Mizar & Alcor',  ra:200.9814, dec:54.9254, mag:2.0,  type:'double',   size:'14\'',     dist:'82 ly',    desc:'First double star described, visible to naked eye', emoji:'👥' },
  ];

  // ── Constellation Lines (pairs of star indices) ───────
  // Simplified subset: [star1_name, star2_name]
  const CONSTELLATION_LINES = [
    // Orion
    ['Betelgeuse','Bellatrix'], ['Betelgeuse','Mintaka'],
    ['Rigel','Saiph'], ['Rigel','Alnitak'],
    ['Mintaka','Alnilam'], ['Alnilam','Alnitak'],
    ['Bellatrix','Mintaka'], ['Saiph','Alnitak'],
    // Big Dipper
    ['Dubhe','Merak'], ['Merak','Phecda'], ['Phecda','Megrez'],
    ['Megrez','Alioth'], ['Alioth','Mizar'], ['Mizar','Alkaid'],
    ['Megrez','Dubhe'],
    // Cassiopeia W
    ['Caph','Schedar'], ['Schedar','Gamma Cas'], ['Gamma Cas','Ruchbah'], ['Ruchbah','Segin'],
    // Leo
    ['Regulus','Algieba'], ['Algieba','Zosma'],
    // Scorpius
    ['Antares','Shaula'], ['Antares','Sargas'],
  ];

  // ── Milky Way band (approximate galactic equator) ─────
  // Galactic center: RA=266.4, Dec=-28.9
  function milkyWayPoints() {
    const pts = [];
    for (let l = 0; l < 360; l += 5) {
      const lRad = l * RAD;
      const bSpread = (20 + 10 * Math.cos(lRad * 3)) * RAD;
      // Galactic to equatorial (simplified)
      const ra = norm360(192.85948 + l);
      const dec = -5.6 + 28.9 * Math.sin(lRad);
      pts.push({ ra: norm360(ra), dec });
    }
    return pts;
  }

  // ── Export ─────────────────────────────────────────────
  return {
    julianDate,
    julianCenturies,
    greenwichSiderealTime,
    localSiderealTime,
    equatorialToHorizontal,
    sunPosition,
    moonPosition,
    planetPosition,
    PLANETS,
    STARS,
    DSO,
    CONSTELLATION_LINES,
    milkyWayPoints,
    norm360,
    norm180,
    RAD,
    DEG
  };
})();
