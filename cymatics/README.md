# Resonant Sand Physics

A dependency-free WebGL2 cymatics / granular-physics experiment for GitHub Pages.

## Core simulation

- Pure-tone simulation from **0.1 Hz to 100 kHz**.
- MP3/WAV/OGG input with FFT peak extraction.
- Circular plate with radial/angular Bessel-like modal basis.
- Square plate with analytic sine modal basis.
- Forced modal response with configurable fundamental resonance and Q factor.
- Precise actuator coordinates with drag + numeric X/Y input.
- CPU particle state (`x`, `y`, `vx`, `vy`) rendered efficiently through WebGL2.
- Local grain-grain contacts through a spatial collision grid.
- Circular or square physical collision walls.
- PNG capture and real-time video capture.

## Automated sound-source motion

The sound source can be fixed manually or moved by deterministic parametric equations while the simulation runs:

- Circle / ellipse
- Line oscillation
- Sine-wave sweep
- Figure eight
- Lissajous curves

Motion controls include path center, X/Y size, cycle rate, phase, line angle, sine cycles, Lissajous ratios, and a **Restart path** control. Dragging the source or typing X/Y coordinates switches back to Manual mode. The source is always constrained to the selected physical plate boundary.

This is useful for video experiments because the actuator changes modal coupling continuously while the same sand state evolves.

## Configuration help

Every settings section has a **?** button. The modal reference explains what each parameter changes and whether it affects sound monitoring, modal physics, granular physics, appearance, sharing, or capture.

## Clear plate viewport

Telemetry is now placed in a dedicated strip **above** the simulation and runtime messages are placed **below** it. Nothing from the HUD/status UI overlaps the plate itself.

## Portable experiments

- **Export config** stores the experimental setup, including automated source-motion equations and parameters.
- **Export snapshot** also stores every grain's current position/velocity, simulation time, and source-motion path time.
- **Import** supports current files and older version-1 pattern files.

Audio files themselves are not embedded in exported JSON. File-mode configurations store identifying metadata and the playback timestamp so the recipient can select the same source audio.

## Run

Open `index.html` directly in a modern browser with WebGL2, or serve the folder from GitHub Pages / any static web server.
