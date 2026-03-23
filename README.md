# Stellaris---A-virtual-sky-to-observe
# 🌌 Stellaris — Virtual Stargazing Observatory

A technically accurate, fully interactive virtual stargazing experience. Explore the real night sky from any location on Earth using instruments ranging from 7×50 binoculars to a 4-metre research observatory.

---

## ✨ Features

### 🔭 Six Authentic Telescopes
| Instrument | Aperture | Best For |
|---|---|---|
| 7×50 Binoculars | 50mm | Wide fields, clusters, naked-eye objects |
| 80mm Refractor | 80mm | Beginner lunar & planetary |
| 200mm Newtonian | 200mm | Deep-sky, nebulae, globulars |
| 12″ Dobsonian | 305mm | Galaxy detail, faint nebulae |
| 16″ SCT | 406mm | Professional DSO hunting |
| 4m Observatory | 4000mm | Research-grade, 22nd magnitude |

### 🌍 14 Observation Sites
From inner-city light pollution (Bortle 9) to the world's finest dark sky sites:
- Mauna Kea, Hawaiʻi (Bortle 1)
- Atacama Desert, Chile (Bortle 1)
- ALMA Observatory, 5100m altitude
- NamibRand Reserve, Namibia
- Roque de los Muchachos, La Palma
- ...and more

### 🌠 Accurate Sky Rendering
- **Real-time star positions** calculated from RA/Dec using Julian Date + sidereal time
- **Sun & Moon** positions via VSOP87-derived orbital mechanics (Meeus algorithms)
- **Planetary positions** via Keplerian orbital elements
- **50+ named stars** with spectral classification (O–M type coloring)
- **20+ deep-sky objects** (Messier + NGC catalogue)
- **Constellation lines**, coordinate grid, twilight glow
- **Moon phase** accurately rendered
- **Sky darkness** scales with Bortle class of selected location
- **Milky Way band** toggle

### 🎛 Telescope Controls
- **Azimuth & Altitude** sliders + arrow buttons
- **Zoom**: 1× to 20× digital magnification
- **Eyepiece selection**: 40mm → 5mm + 2× Barlow
- **Live magnification** and true FOV calculation
- **Focus rack** with visual blur simulation
- **Telescope vignette** ring overlay per instrument type

### 🖱 Interaction
- **Click + drag** to pan the sky
- **Scroll wheel** to zoom
- **Hover** over stars/objects for info tooltip
- **Keyboard shortcuts**: Arrow keys (pan), +/- (zoom), G/C/L/M/P (toggles)
- **Object click** in "Objects in View" panel to slew to target

### 📚 Educational Content
- Telescope Guide section with physics of each instrument
- Deep Sky Catalogue with 22 objects
- "Did You Know" rotating astronomy facts
- Aperture → limiting magnitude calculations
- Bortle scale explanation per location

---

## 🚀 Getting Started

### Local (No Server Required)
```bash
git clone https://github.com/yourname/stellaris
cd stellaris
open index.html    # macOS
# or
xdg-open index.html  # Linux
# or just double-click index.html in Windows Explorer
```
> No build step, no npm, no server required. Pure HTML + CSS + JS.

### With Local Server (Recommended for Best Results)
```bash
# Python
python3 -m http.server 8000

# Node.js
npx serve .

# Then visit: http://localhost:8000
```

---

## 🎹 Keyboard Shortcuts

| Key | Action |
|---|---|
| `←` `→` | Pan azimuth |
| `↑` `↓` | Pan altitude |
| `+` / `-` | Zoom in / out |
| `Shift + arrows` | Fast pan (10°) |
| `G` | Toggle coordinate grid |
| `C` | Toggle constellation lines |
| `L` | Toggle star labels |
| `M` | Toggle Milky Way |
| `P` | Toggle planets |

---

## 🔬 Technical Architecture

```
stellaris/
├── index.html       # App shell, layout, UI structure
├── style.css        # Design system, Cinzel + Cormorant + JetBrains Mono
├── astronomy.js     # Celestial mechanics engine
│   ├── Julian Date & sidereal time
│   ├── Equatorial → Horizontal coordinate transform
│   ├── Sun position (simplified VSOP87)
│   ├── Moon position + phase
│   ├── Planet positions (Keplerian elements)
│   ├── Star catalogue (60+ named stars)
│   └── DSO catalogue (22 objects)
└── app.js           # Main application
    ├── Canvas sky renderer
    ├── Telescope physics engine
    ├── Interactive controls
    └── UI state management
```

### Celestial Mechanics
- **Julian Date** → standard astronomical time reference
- **Greenwich & Local Sidereal Time** → rotates sky to current time/location  
- **Equatorial (RA/Dec) → Horizontal (Alt/Az)** → places stars on screen
- **Hour Angle** = LST − Right Ascension
- **Altitude/Azimuth** calculated per observer latitude
- **Moon phase** from ecliptic longitude difference (Sun−Moon)

### Telescope Physics
- **Magnification** = Focal Length ÷ Eyepiece Focal Length
- **True FOV** ≈ Apparent FOV (60°) ÷ Magnification
- **Exit Pupil** = Aperture ÷ Magnification (ideal: 4–7mm for dark-adapted eye)
- **Limiting Magnitude** = 2.1 + 5 × log₁₀(aperture_mm)
- **Resolving Power** = 116 ÷ aperture_mm (Dawes limit, arcseconds)
- **Light Gathering** = (aperture/7)² relative to naked eye

---

## 🌐 No External API Dependencies

All sky calculations run **client-side** using:
- Jean Meeus "Astronomical Algorithms" (2nd ed.) formulae
- Simplified VSOP87 for Sun/Moon
- Keplerian mean orbital elements for planets
- 60-star bright star catalogue (hardcoded for offline use)

No API keys required. No network calls. Works fully offline.

---

## 🎨 Design System

- **Aesthetic**: Deep-space observatory noir
- **Fonts**: Cinzel (display), Cormorant Garamond (body), JetBrains Mono (data)
- **Palette**: Space black (#050810), Gold (#D4A843), Silver (#9AB0CC), Accent cyan (#40B8D8)
- **Effects**: Radial gradients, canvas compositing, CSS vignette, blur simulation

---

## 📖 Astronomy Learning Path

1. **Start with Binoculars** → sweep the Milky Way, find the Pleiades (M45)
2. **80mm Refractor** → find the Moon, try Saturn's rings at 88× magnification
3. **200mm Newtonian** → hunt the Orion Nebula (M42), Andromeda Galaxy (M31)
4. **12″ Dobsonian** → resolve the Hercules Cluster (M13), find faint galaxies
5. **16″ SCT** → challenge yourself with 14th-magnitude objects
6. **Observatory** → explore the academic universe of 22nd-magnitude quasars

---

## 🙏 Credits & References

- **Jean Meeus** — *Astronomical Algorithms* (Willmann-Bell, 1991)
- **VSOP87** — P. Bretagnon & G. Francou, Bureau des Longitudes
- **Bright Star Catalogue** — Yale, 5th Ed.
- **Messier Catalogue** — Charles Messier, 1771–1781
- **Dawes Limit** — William R. Dawes, 1867
- **Bortle Dark-Sky Scale** — John E. Bortle, Sky & Telescope, Feb 2001

---

## 📄 License

MIT License. See `LICENSE` for details.

---

*"The universe is under no obligation to make sense to you."* — Neil deGrasse Tyson

