# Cloudwell

Cloudwell is a small, original vertical platforming game built with HTML5 Canvas, CSS, and vanilla JavaScript. Climb through a procedurally extended sky, collect water droplets, and reach a glowing storage station before a fall costs your unbanked water. The game features charity: water-inspired clean-water branding and themes.

As the climb gets higher, ledges introduce more variety: moving ledges shift horizontally, small ledges require tighter landings, and crumbling ledges warn with cracks and shaking before breaking apart. Crumbling ledges use stable, cracking, breaking, and destroyed states so their warning animation does not change collision geometry until the ledge is gone. Before each run, choose Easy, Normal, or Hard; each mode changes platform scale and spacing, hazards, droplets, crumbling timers, and the score goal.

The playfield is responsive: phones and tablets lock the game world to the visible viewport, and platform widths and horizontal spacing scale down to keep the route visible and reachable. Desktop layouts retain a wider playfield.

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
- `↻`: reset the game and start a new run
- `♫`: mute or unmute Web Audio effects

Stored water is permanent. Platforms and their off-screen droplets disappear after they scroll below the viewport, so falling past the visible ledges ends the run. Avoid garbage on platforms: touching pollution removes one unbanked drop, while stored water remains safe. Reaching 750 points displays a win screen with the option to continue climbing. Unbanked water is also lost when the player falls, while the last storage station becomes the next respawn point.

The game uses one synthesized Web Audio system in `game.js`; it does not require downloaded audio files. It provides feedback for collection, missed water/pollution, buttons, falling, winning, and score milestones, and only initializes after a user interaction. Score milestones are defined in the `MILESTONE_MESSAGES` array, displayed once when their thresholds are reached, and shown in a prominent animated notification with a brief score pulse.

## Project layout

- `index.html`: game shell, HUD, menus, and touch controls
- `style.css`: responsive visual system and overlays
- `game.js`: input, physics, procedural generation, camera, collisions, audio, particles, and rendering

The `TUNE` object at the top of `game.js` is the main manual adjustment surface for movement feel, jump arc, generation distance, and crumbling-platform falling. The `DIFFICULTIES` object immediately below the platform types is the centralized adjustment surface for Easy, Normal, and Hard.

Gameplay is rendered on Canvas, while interaction feedback uses the DOM: collecting or banking water creates a temporary notification in `#messageStack`, and the HUD values are updated through DOM text nodes. The start and win screens also include compact links to [charity: water](https://www.charitywater.org/) and its [donation page](https://www.charitywater.org/donate).

Falling now gives a brief run-over summary before the single `resetGame()` path clears the run and returns to the start screen. The selected difficulty is preserved for the next run, while platforms, hazards, droplets, particles, timers, input, and progression are regenerated cleanly.