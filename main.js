// Black Hole Galaxy Simulator
// Created by N0rvel
// Real-time 3D gravitational physics simulation using Three.js and GLSL shaders

// Global variables
let scene, camera, renderer;
let particleSystem;
let blackHole;
let time = 0;
let particleCount = 10000;
let gravity = 1.0;
let timeScale = 1.0;
let clock;
let frameCount = 0;
let lastTime = Date.now();

// Particle data arrays for GPU computation
let positions;
let velocities;
let colors;

// Shader code for GPU-based particle rendering and physics
const vertexShader = `
    attribute vec3 velocity;
    attribute vec3 customColor;
    varying vec3 vColor;
    uniform float time;
    uniform float pointSize;
    
    void main() {
        vColor = customColor;
        
        // Position with slight oscillation based on velocity
        vec3 pos = position;
        
        // Calculate point size based on distance from camera
        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = pointSize * (300.0 / -mvPosition.z);
        
        gl_Position = projectionMatrix * mvPosition;
    }
`;

const fragmentShader = `
    varying vec3 vColor;
    
    void main() {
        // Create circular particles with glow effect
        vec2 center = gl_PointCoord - vec2(0.5);
        float dist = length(center);
        
        if (dist > 0.5) {
            discard;
        }
        
        // Glow effect
        float strength = 1.0 - (dist * 2.0);
        strength = pow(strength, 2.0);
        
        gl_FragColor = vec4(vColor * strength, strength * 0.8);
    }
`;

// Initialize the scene
function init() {
    // Setup scene
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.0003);
    
    // Setup camera
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        10000
    );
    camera.position.set(0, 200, 500);
    camera.lookAt(0, 0, 0);
    
    // Setup renderer
    const canvas = document.getElementById('canvas');
    renderer = new THREE.WebGLRenderer({ 
        canvas: canvas,
        antialias: true,
        alpha: true 
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x000000, 1);
    
    // Create clock for timing
    clock = new THREE.Clock();
    
    // Create black hole in center
    createBlackHole();
    
    // Create particle system
    createParticleSystem(particleCount);
    
    // Add lighting
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);
    
    const pointLight = new THREE.PointLight(0xffffff, 1, 1000);
    pointLight.position.set(0, 0, 0);
    scene.add(pointLight);
    
    // Setup UI controls
    setupControls();
    
    // Handle window resize
    window.addEventListener('resize', onWindowResize, false);
    
    // Start animation loop
    animate();
}

// Create the black hole at the center
function createBlackHole() {
    const geometry = new THREE.SphereGeometry(10, 32, 32);
    const material = new THREE.MeshBasicMaterial({ 
        color: 0x000000,
        transparent: true,
        opacity: 0.9
    });
    blackHole = new THREE.Mesh(geometry, material);
    scene.add(blackHole);
    
    // Add accretion disk glow
    const glowGeometry = new THREE.RingGeometry(15, 40, 64);
    const glowMaterial = new THREE.MeshBasicMaterial({
        color: 0x4da6ff,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide
    });
    const accretionDisk = new THREE.Mesh(glowGeometry, glowMaterial);
    accretionDisk.rotation.x = Math.PI / 2;
    scene.add(accretionDisk);
}

// Create particle system with GPU shaders
function createParticleSystem(count) {
    // Remove existing particle system if any
    if (particleSystem) {
        scene.remove(particleSystem);
        if (particleSystem.geometry) particleSystem.geometry.dispose();
        if (particleSystem.material) particleSystem.material.dispose();
    }
    
    particleCount = count;
    
    const geometry = new THREE.BufferGeometry();
    positions = new Float32Array(count * 3);
    velocities = new Float32Array(count * 3);
    colors = new Float32Array(count * 3);
    
    // Initialize particles in a spherical distribution
    for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        
        // Random spherical distribution
        const radius = 100 + Math.random() * 400;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        
        positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
        positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
        positions[i3 + 2] = radius * Math.cos(phi);
        
        // Initial orbital velocity (perpendicular to radius)
        const speed = 0.5 + Math.random() * 0.5;
        const vTheta = theta + Math.PI / 2;
        velocities[i3] = speed * Math.cos(vTheta);
        velocities[i3 + 1] = (Math.random() - 0.5) * 0.2;
        velocities[i3 + 2] = speed * Math.sin(vTheta);
        
        // Color based on distance (closer = bluer, farther = redder)
        const colorMix = Math.min(radius / 500, 1.0);
        colors[i3] = 0.3 + colorMix * 0.7;      // R
        colors[i3 + 1] = 0.5 + colorMix * 0.3;  // G
        colors[i3 + 2] = 1.0 - colorMix * 0.3;  // B
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
    geometry.setAttribute('customColor', new THREE.BufferAttribute(colors, 3));
    
    const material = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0.0 },
            pointSize: { value: 2.0 }
        },
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    
    particleSystem = new THREE.Points(geometry, material);
    scene.add(particleSystem);
    
    // Update UI
    document.getElementById('particleCount').textContent = count.toLocaleString();
}

// Update particle physics (gravitational attraction to black hole)
function updatePhysics(deltaTime) {
    const dt = deltaTime * timeScale;
    const blackHolePos = new THREE.Vector3(0, 0, 0);
    const minDistance = 15; // Event horizon
    
    for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        
        // Current position
        const px = positions[i3];
        const py = positions[i3 + 1];
        const pz = positions[i3 + 2];
        
        // Distance to black hole
        const dx = -px;
        const dy = -py;
        const dz = -pz;
        const distSq = dx * dx + dy * dy + dz * dz;
        const dist = Math.sqrt(distSq);
        
        // If particle is too close, respawn it at the edge
        if (dist < minDistance) {
            const radius = 400 + Math.random() * 100;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            
            positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[i3 + 2] = radius * Math.cos(phi);
            
            const speed = 0.5 + Math.random() * 0.5;
            const vTheta = theta + Math.PI / 2;
            velocities[i3] = speed * Math.cos(vTheta);
            velocities[i3 + 1] = (Math.random() - 0.5) * 0.2;
            velocities[i3 + 2] = speed * Math.sin(vTheta);
            
            continue;
        }
        
        // Gravitational force (F = G*M/r^2)
        const force = (gravity * 5000.0) / distSq;
        const ax = (dx / dist) * force;
        const ay = (dy / dist) * force;
        const az = (dz / dist) * force;
        
        // Update velocity
        velocities[i3] += ax * dt;
        velocities[i3 + 1] += ay * dt;
        velocities[i3 + 2] += az * dt;
        
        // Apply slight drag to prevent infinite acceleration
        const drag = 0.999;
        velocities[i3] *= drag;
        velocities[i3 + 1] *= drag;
        velocities[i3 + 2] *= drag;
        
        // Update position
        positions[i3] += velocities[i3] * dt;
        positions[i3 + 1] += velocities[i3 + 1] * dt;
        positions[i3 + 2] += velocities[i3 + 2] * dt;
    }
    
    // Update geometry
    particleSystem.geometry.attributes.position.needsUpdate = true;
    particleSystem.geometry.attributes.velocity.needsUpdate = true;
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    const deltaTime = clock.getDelta();
    time += deltaTime;
    
    // Update physics
    updatePhysics(deltaTime);
    
    // Rotate camera around the scene
    const radius = 500;
    const cameraSpeed = 0.05;
    camera.position.x = Math.cos(time * cameraSpeed) * radius;
    camera.position.z = Math.sin(time * cameraSpeed) * radius;
    camera.position.y = 200 + Math.sin(time * cameraSpeed * 0.5) * 100;
    camera.lookAt(0, 0, 0);
    
    // Update shader uniforms
    if (particleSystem && particleSystem.material) {
        particleSystem.material.uniforms.time.value = time;
    }
    
    // Rotate accretion disk
    if (scene.children[2]) {
        scene.children[2].rotation.z += 0.001 * timeScale;
    }
    
    // Render scene
    renderer.render(scene, camera);
    
    // Update FPS counter
    frameCount++;
    const now = Date.now();
    if (now - lastTime >= 1000) {
        document.getElementById('fps').textContent = frameCount;
        frameCount = 0;
        lastTime = now;
    }
}

// Setup UI controls
function setupControls() {
    // Mode selector
    const modeSelect = document.getElementById('mode');
    modeSelect.addEventListener('change', (e) => {
        if (e.target.value === 'normal') {
            createParticleSystem(10000);
        } else if (e.target.value === 'experimental') {
            createParticleSystem(100000);
        }
    });
    
    // Gravity control
    const gravitySlider = document.getElementById('gravity');
    const gravityValue = document.getElementById('gravityValue');
    gravitySlider.addEventListener('input', (e) => {
        gravity = parseFloat(e.target.value);
        gravityValue.textContent = gravity.toFixed(1);
    });
    
    // Speed control
    const speedSlider = document.getElementById('speed');
    const speedValue = document.getElementById('speedValue');
    speedSlider.addEventListener('input', (e) => {
        timeScale = parseFloat(e.target.value);
        speedValue.textContent = timeScale.toFixed(1);
    });
    
    // Reset button
    const resetButton = document.getElementById('reset');
    resetButton.addEventListener('click', () => {
        const currentMode = modeSelect.value;
        const count = currentMode === 'normal' ? 10000 : 100000;
        createParticleSystem(count);
        gravity = 1.0;
        timeScale = 1.0;
        gravitySlider.value = 1.0;
        speedSlider.value = 1.0;
        gravityValue.textContent = '1.0';
        speedValue.textContent = '1.0';
    });
}

// Handle window resize
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Start the application
window.addEventListener('DOMContentLoaded', init);
