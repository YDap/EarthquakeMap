# 🌍 Earthquake Live Map

A free, no-API-key React app that plots live natural hazards on a spinning 3D globe. Switch between three tabs:
- **🌍 Quakes**: USGS earthquakes. Circle size = magnitude, colour = depth, pulsing = under 1 h old.
- **🌀 Cyclones**: tropical cyclones worldwide (NASA EONET, from JTWC / NOAA NHC). Tracks coloured by Saffir–Simpson category; active storms pulse.
- **🌪️ Tornadoes**: US tornado reports (NOAA SPC), coloured by EF rating, plus live NWS tornado-warning areas.

## Run
```
npm install
npm run dev      # then open the URL it prints (http://localhost:5173)
npm run build    # production build into dist/
```

The original single-file version is kept in `legacy/index.html`.

## Structure
- `src/App.jsx` – wires everything together, owns settings + replay
- `src/modes/quakes.jsx`, `cyclones.jsx`, `tornadoes.jsx` – one file per tab: fetch data, turn it into globe points/lines/areas, sidebar panel, tooltip
- `src/components/Globe.jsx` – canvas globe (generic points / lines / areas), render loop, drag/zoom/hover
- `src/components/Sidebar.jsx`, `Tooltip.jsx`, `Starfield.jsx`
- `src/hooks/usePolling.js` – fetch + re-poll + countdown, used by every tab
- `src/hooks/useLand.js` – world outline (bundled from the `world-atlas` package)
- `src/hooks/usePlates.js`, `useReplay.js`, `useAlerts.js` – plate layer, time slider, new-quake alerts
- `src/lib/urlState.js` – settings ⇄ URL hash
- `src/lib/` – config and visual encoding (radius, depth colour)

## How it works
- **fetch**: `fetch()` the USGS GeoJSON, check `res.ok`, parse JSON; on failure keep old data and show a message.
- **polling**: `setInterval` ticks every second, drives the countdown and re-fetches every 60 s.
- **projection**: `d3.geoOrthographic()` maps `[lon, lat]` to screen `[x, y]`; `rotate()` picks the face toward us; `d3.geoDistance` hides quakes on the far side.
- **animation**: `requestAnimationFrame` loop rotates the globe; drag/scroll interrupt, auto-spin resumes after 2.5 s.
- **scale**: radius is exponential in magnitude because magnitude is logarithmic.

## Features
- **Filters**: minimum magnitude and depth range (sidebar).
- **Plate boundaries**: toggle the PB2002 tectonic plate lines (Bird, 2003).
- **Replay**: press ▶ on the bottom bar to replay the feed's period in 30 s, or drag the slider; ● LIVE returns to now.
- **Alerts**: tick *Alert on new quakes ≥ M5* for a sound, an on-page pop-up and (if allowed) a browser notification. Click one to fly there.
- **Shareable links**: settings live in the URL (`#feed=all_week&mag=4…`); *Copy link to this view* also saves the globe position and zoom.

## More ideas
- Search by region; switch to the USGS `query` API for custom areas/dates
- Cache with localStorage; other data sources (EMSC)

## Free hosting (Netlify)
In Netlify: Add new site → Import an existing project → pick this GitHub repo. The build settings come from netlify.toml (npm run build, publish dist/), so just click Deploy. Every push to main redeploys.

Data: USGS Earthquake Hazards Program. Map: d3, world-atlas (Natural Earth).
