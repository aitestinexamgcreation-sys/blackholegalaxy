# Black Hole Galaxy

A real-time 3D gravitational simulator that models how galaxies form and interact around a supermassive black hole.

## Overview

This interactive web-based simulator uses Three.js and GLSL shaders to run complex gravitational physics directly on your GPU. Watch thousands (or millions) of particles collapse into accretion disks or spiral into the black hole in real-time.

## Features

- **GPU-Accelerated Physics**: Complex gravitational calculations performed using custom GLSL shaders
- **Real-time 3D Rendering**: Smooth, interactive visualization powered by Three.js
- **Two Simulation Modes**:
  - **Normal Mode**: 10,000 particles - suitable for most devices
  - **Experimental Mode**: 100,000 particles - for high-end PCs and enthusiasts
- **Interactive Controls**:
  - Adjustable black hole gravity strength
  - Variable simulation speed
  - Real-time particle respawning
- **Beautiful Visuals**: 
  - Particle color gradients based on distance from black hole
  - Glowing accretion disk
  - Smooth particle animations with additive blending

## Technology Stack

- **Three.js** (r128): 3D graphics library
- **WebGL**: Hardware-accelerated 3D rendering
- **GLSL Shaders**: Custom vertex and fragment shaders for particle effects
- **Vanilla JavaScript**: No framework dependencies

## How to Run

Simply open `index.html` in a modern web browser. No build process or dependencies required!

The simulator works best in:
- Chrome/Edge (recommended)
- Firefox
- Safari (may have reduced performance)

## Controls

- **Simulation Mode**: Switch between Normal and Experimental modes
- **Black Hole Gravity**: Control the strength of gravitational attraction
- **Simulation Speed**: Adjust time scale for faster/slower simulations
- **Reset**: Return all particles to initial positions with default settings

## Physics Model

The simulator implements a simplified N-body gravitational model:

- Each particle experiences gravitational attraction toward the black hole
- Force follows inverse-square law: F = G*M/r²
- Particles that fall below the event horizon (15 units) are respawned at the edge
- Initial orbital velocities create disk-like structures
- Slight drag prevents infinite acceleration

## Performance

- Normal Mode (10,000 particles): 60 FPS on most modern devices
- Experimental Mode (100,000 particles): Requires dedicated GPU, may run at 30-60 FPS

The FPS counter in the control panel shows real-time performance.

## Created By

**N0rvel**

A technical showcase of web-based rendering and open-source physics simulation.

## License

See LICENSE file for details. 
