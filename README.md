# Cloudwell

Cloudwell is a small, original vertical platforming game built with HTML5 Canvas, CSS, and vanilla JavaScript. Climb through a procedurally extended sky, collect water droplets, and reach a glowing storage station before a fall costs your unbanked water.

## Run

Open `index.html` directly in a browser, or serve the folder with any static web server:

```bash
python3 -m http.server 4173
```

Then visit `http://localhost:4173`.

## Controls

- `A` / `D` or arrow keys: move
- `Space` / `Up`: jump, with variable jump height
- `S` / `Down`: bank water at a glowing station
- `P`: pause
- `♫`: mute or unmute Web Audio effects

Stored water is permanent. Unbanked water is lost when the player falls, while the last storage station becomes the next respawn point. Reaching altitude milestones adds bonus score.

## Project layout

- `index.html`: game shell, HUD, menus, and touch controls
- `style.css`: responsive visual system and overlays
- `game.js`: input, physics, procedural generation, camera, collisions, audio, particles, and rendering

The `TUNE` object at the top of `game.js` is the main manual adjustment surface for movement feel, jump arc, platform spacing, and generation distance.