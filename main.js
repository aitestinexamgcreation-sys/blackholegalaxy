// Black Hole Galaxy Simulator
// Created by N0rvel
// Real-time 3D gravitational physics simulation using WebGL and GLSL shaders

// Global variables
let canvas, gl;
let particleCount = 10000;
let gravity = 1.0;
let timeScale = 1.0;
let frameCount = 0;
let lastTime = Date.now();
let time = 0;

// Particle data
let particles = [];

// Camera settings
let camera = {
    x: 0,
    y: 200,
    z: 500,
    rotationSpeed: 0.05
};

// WebGL shader program
let shaderProgram;
let positionBuffer;
let colorBuffer;

// Vertex shader with GPU-based transformations
const vertexShaderSource = `
    attribute vec3 aPosition;
    attribute vec4 aColor;
    
    uniform mat4 uProjectionMatrix;
    uniform mat4 uModelViewMatrix;
    uniform float uPointSize;
    
    varying vec4 vColor;
    
    void main() {
        vColor = aColor;
        vec4 position = uModelViewMatrix * vec4(aPosition, 1.0);
        gl_Position = uProjectionMatrix * position;
        
        // Make points larger when they're closer
        float distance = length(position.xyz);
        gl_PointSize = uPointSize * (300.0 / distance);
    }
`;

// Fragment shader with glow effect
const fragmentShaderSource = `
    precision mediump float;
    varying vec4 vColor;
    
    void main() {
        // Create circular particles with glow
        vec2 center = gl_PointCoord - vec2(0.5);
        float dist = length(center);
        
        if (dist > 0.5) {
            discard;
        }
        
        // Glow effect
        float strength = 1.0 - (dist * 2.0);
        strength = pow(strength, 2.0);
        
        gl_FragColor = vec4(vColor.rgb * strength, vColor.a * strength * 0.8);
    }
`;

// Particle class
class Particle {
    constructor() {
        // Random spherical distribution
        const radius = 100 + Math.random() * 400;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        
        this.x = radius * Math.sin(phi) * Math.cos(theta);
        this.y = radius * Math.sin(phi) * Math.sin(theta);
        this.z = radius * Math.cos(phi);
        
        // Initial orbital velocity
        const speed = 0.5 + Math.random() * 0.5;
        const vTheta = theta + Math.PI / 2;
        this.vx = speed * Math.cos(vTheta);
        this.vy = (Math.random() - 0.5) * 0.2;
        this.vz = speed * Math.sin(vTheta);
        
        // Color based on distance
        const colorMix = Math.min(radius / 500, 1.0);
        this.r = 0.3 + colorMix * 0.7;
        this.g = 0.5 + colorMix * 0.3;
        this.b = 1.0 - colorMix * 0.3;
    }
    
    update(dt) {
        // Distance to black hole at origin
        const dx = -this.x;
        const dy = -this.y;
        const dz = -this.z;
        const distSq = dx * dx + dy * dy + dz * dz;
        const dist = Math.sqrt(distSq);
        
        // Event horizon - respawn if too close
        if (dist < 15) {
            const radius = 400 + Math.random() * 100;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            
            this.x = radius * Math.sin(phi) * Math.cos(theta);
            this.y = radius * Math.sin(phi) * Math.sin(theta);
            this.z = radius * Math.cos(phi);
            
            const speed = 0.5 + Math.random() * 0.5;
            const vTheta = theta + Math.PI / 2;
            this.vx = speed * Math.cos(vTheta);
            this.vy = (Math.random() - 0.5) * 0.2;
            this.vz = speed * Math.sin(vTheta);
            
            return;
        }
        
        // Gravitational force (F = G*M/r^2)
        const force = (gravity * 5000.0) / distSq;
        const ax = (dx / dist) * force;
        const ay = (dy / dist) * force;
        const az = (dz / dist) * force;
        
        // Update velocity
        this.vx += ax * dt;
        this.vy += ay * dt;
        this.vz += az * dt;
        
        // Apply drag
        const drag = 0.999;
        this.vx *= drag;
        this.vy *= drag;
        this.vz *= drag;
        
        // Update position
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.z += this.vz * dt;
    }
}

// Initialize WebGL
function initWebGL() {
    canvas = document.getElementById('canvas');
    gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    
    if (!gl) {
        alert('WebGL not supported in your browser');
        return false;
    }
    
    // Enable blending for glow effect
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    
    // Compile shaders
    const vertexShader = compileShader(gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
    
    // Create shader program
    shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);
    
    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        console.error('Shader program failed to link:', gl.getProgramInfoLog(shaderProgram));
        return false;
    }
    
    gl.useProgram(shaderProgram);
    
    // Create buffers
    positionBuffer = gl.createBuffer();
    colorBuffer = gl.createBuffer();
    
    return true;
}

// Compile a shader
function compileShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compilation error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    
    return shader;
}

// Create perspective projection matrix
function createPerspectiveMatrix(fov, aspect, near, far) {
    const f = 1.0 / Math.tan(fov / 2);
    const nf = 1 / (near - far);
    
    return [
        f / aspect, 0, 0, 0,
        0, f, 0, 0,
        0, 0, (far + near) * nf, -1,
        0, 0, 2 * far * near * nf, 0
    ];
}

// Create model-view matrix (camera transform)
function createModelViewMatrix(camX, camY, camZ) {
    // Simple lookAt implementation
    const zAxis = normalize([camX, camY, camZ]);
    const xAxis = normalize(cross([0, 1, 0], zAxis));
    const yAxis = cross(zAxis, xAxis);
    
    return [
        xAxis[0], yAxis[0], zAxis[0], 0,
        xAxis[1], yAxis[1], zAxis[1], 0,
        xAxis[2], yAxis[2], zAxis[2], 0,
        -dot(xAxis, [camX, camY, camZ]),
        -dot(yAxis, [camX, camY, camZ]),
        -dot(zAxis, [camX, camY, camZ]),
        1
    ];
}

// Vector math helpers
function normalize(v) {
    const len = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
    return [v[0]/len, v[1]/len, v[2]/len];
}

function cross(a, b) {
    return [
        a[1]*b[2] - a[2]*b[1],
        a[2]*b[0] - a[0]*b[2],
        a[0]*b[1] - a[1]*b[0]
    ];
}

function dot(a, b) {
    return a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
}

// Create particle system
function createParticleSystem(count) {
    particles = [];
    for (let i = 0; i < count; i++) {
        particles.push(new Particle());
    }
    particleCount = count;
    document.getElementById('particleCount').textContent = count.toLocaleString();
}

// Update physics
function updatePhysics(dt) {
    const deltaTime = dt * timeScale;
    for (let particle of particles) {
        particle.update(deltaTime);
    }
}

// Render the scene
function render() {
    // Resize canvas if needed
    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        gl.viewport(0, 0, canvas.width, canvas.height);
    }
    
    // Clear
    gl.clear(gl.COLOR_BUFFER_BIT);
    
    // Update camera position (rotate around origin)
    camera.x = Math.cos(time * camera.rotationSpeed) * 500;
    camera.z = Math.sin(time * camera.rotationSpeed) * 500;
    camera.y = 200 + Math.sin(time * camera.rotationSpeed * 0.5) * 100;
    
    // Create matrices
    const aspect = canvas.width / canvas.height;
    const projectionMatrix = createPerspectiveMatrix(
        75 * Math.PI / 180,  // FOV in radians
        aspect,
        0.1,
        10000
    );
    const modelViewMatrix = createModelViewMatrix(camera.x, camera.y, camera.z);
    
    // Prepare position and color data
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 4);
    
    for (let i = 0; i < particleCount; i++) {
        const p = particles[i];
        positions[i*3] = p.x;
        positions[i*3+1] = p.y;
        positions[i*3+2] = p.z;
        
        colors[i*4] = p.r;
        colors[i*4+1] = p.g;
        colors[i*4+2] = p.b;
        colors[i*4+3] = 0.8;
    }
    
    // Upload position data
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
    
    const positionLocation = gl.getAttribLocation(shaderProgram, 'aPosition');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);
    
    // Upload color data
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, colors, gl.DYNAMIC_DRAW);
    
    const colorLocation = gl.getAttribLocation(shaderProgram, 'aColor');
    gl.enableVertexAttribArray(colorLocation);
    gl.vertexAttribPointer(colorLocation, 4, gl.FLOAT, false, 0, 0);
    
    // Set uniforms
    const projectionLocation = gl.getUniformLocation(shaderProgram, 'uProjectionMatrix');
    gl.uniformMatrix4fv(projectionLocation, false, projectionMatrix);
    
    const modelViewLocation = gl.getUniformLocation(shaderProgram, 'uModelViewMatrix');
    gl.uniformMatrix4fv(modelViewLocation, false, modelViewMatrix);
    
    const pointSizeLocation = gl.getUniformLocation(shaderProgram, 'uPointSize');
    gl.uniform1f(pointSizeLocation, 2.0);
    
    // Draw particles
    gl.drawArrays(gl.POINTS, 0, particleCount);
}

// Animation loop
let lastFrameTime = Date.now();
let fpsLastTime = Date.now();

function animate() {
    requestAnimationFrame(animate);
    
    const now = Date.now();
    const deltaTime = Math.min((now - lastFrameTime) / 1000, 0.1); // Cap at 100ms
    lastFrameTime = now;
    
    time += deltaTime;
    
    // Update physics
    updatePhysics(deltaTime);
    
    // Render
    render();
    
    // Update FPS
    frameCount++;
    if (now - fpsLastTime >= 1000) {
        document.getElementById('fps').textContent = frameCount;
        frameCount = 0;
        fpsLastTime = now;
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
    // Canvas will resize automatically in render()
}

// Initialize application
function init() {
    if (!initWebGL()) {
        return;
    }
    
    createParticleSystem(particleCount);
    setupControls();
    
    window.addEventListener('resize', onWindowResize, false);
    
    lastFrameTime = Date.now();
    fpsLastTime = Date.now();
    animate();
}

// Start when DOM is ready
window.addEventListener('DOMContentLoaded', init);
