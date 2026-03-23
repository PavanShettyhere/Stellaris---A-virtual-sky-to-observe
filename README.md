# Stellaris — A Virtual Sky to Observe

![Stellaris Observatory](docs/observatory.png)

Stellaris is an interactive, browser-based virtual stargazing observatory built with vanilla HTML, CSS, and JavaScript. It provides an immersive astronomical experience, allowing users to explore the night sky from various locations worldwide, experiment with different telescopes, and learn about constellations and deep-sky objects.

## Features

### 🌌 Interactive Observatory
- View the sky with accurate celestial mechanics based on your chosen location's latitude and longitude.
- Adjust Azimuth, Altitude, and Zoom easily.
- Over 800 dynamically generated field stars with twinkling effects.
- Accurate geocentric calculations for all major planets (including Uranus and Neptune).
- Toggle constellations, coordinate grids, labels, and the Milky Way.
- A functional "Track" toggle that rotates the sky automatically.

### 🔭 Telescope Laboratory
![Telescope Lab](docs/lab.png)
- Experiment with different Aperture sizes, Focal Lengths, and Eyepieces.
- See real-time calculations for Magnification, Exit Pupil, True FOV, Resolving Power, and Limiting Magnitude.
- View simulated comparisons of what objects would look like through your specified optics.

### 📚 Constellations Encyclopedia
- A fully searchable catalog of constellations.
- Learn about the mythology, best viewing seasons, and feature stars.
- Interactive SVG plots connecting the brightest stars natively rendered via RA/Dec mapping.
- Quickly locate them in the main observatory simply by clicking "Locate in Sky".

### 📡 Live Sky Map
- An embedded viewer of real astronomical sky surveys (DSS2, 2MASS, AllWISE).
- Powered by AladinLite from the CDS in Strasbourg.

### 🌍 Realistic Time & Location Rendering
- Over 30 curated stargazing sites (from bright urban cities to pristine desert observatories) and their real Bortle classes.
- Dynamic day/night sky gradients synced with the Sun's real-time altitude.
- Twilight and night indicators.

## Running Locally

To run the application locally, you should use a local web server (otherwise cross-origin policies may block the Live Sky Map features).

```bash
# Using Python
python -m http.server 8080

# Using Node.js / npx
npx serve
```
Then navigate to `http://localhost:8080` (or whichever port is provided).

## Development
- `index.html`: Main layout and page structures.
- `src/css/main.css`: Core design system, UI themes, animations, and responsive layout.
- `src/js/astronomy.js`: Mathematics engine for orbital elements, Julian dates, Local Sidereal Time, and equatorial/horizontal calculations.
- `src/js/app.js`: Main rendering loop and user interface logic.
- `src/js/app-pages.js`: Auxiliary modules for the Laboratory, Constellations, and AladinLite integration.

*Created as a personal educational project for stargazers and astronomers.*
