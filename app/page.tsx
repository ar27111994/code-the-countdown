'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'motion/react';
import { Play, Pause, RotateCcw, ChevronRight, HelpCircle, Info, Maximize, Minimize, Volume2, VolumeX, Camera, CalendarClock } from 'lucide-react';

const MESSAGES = ["10", "9", "8", "7", "6", "5", "4", "3", "2", "1", "I / O"];

const GALAXY_COLORS = [
  [1.0, 1.0, 1.0], 
  [0.82, 0.89, 0.99], 
  [0.66, 0.78, 0.98], 
  [0.81, 0.74, 1.0], 
  [1.0, 0.87, 0.6]
];

const GOOGLE_COLORS = [
  [0.26, 0.52, 0.96], // Blue
  [0.92, 0.26, 0.21], // Red
  [0.98, 0.74, 0.02], // Yellow
  [0.2, 0.66, 0.33]   // Green
];

// 10 to 1 + I/O
const THEMES = [
  { primary: [0.6, 0.2, 1.0], secondary: [0.8, 0.5, 1.0], bg: [0.03, 0.01, 0.05, 0.1] }, // 10 Violet
  { primary: [0.3, 0.0, 0.8], secondary: [0.5, 0.2, 1.0], bg: [0.01, 0.0, 0.05, 0.1] },  // 9 Indigo
  { primary: [0.0, 0.4, 1.0], secondary: [0.2, 0.6, 1.0], bg: [0.0, 0.02, 0.05, 0.1] },  // 8 Blue
  { primary: [0.0, 0.8, 1.0], secondary: [0.5, 1.0, 1.0], bg: [0.0, 0.04, 0.06, 0.1] },  // 7 Cyan
  { primary: [0.0, 0.7, 0.6], secondary: [0.2, 0.9, 0.8], bg: [0.0, 0.04, 0.03, 0.1] },  // 6 Teal
  { primary: [0.2, 0.8, 0.2], secondary: [0.5, 1.0, 0.5], bg: [0.01, 0.04, 0.01, 0.1] }, // 5 Green
  { primary: [1.0, 0.8, 0.0], secondary: [1.0, 0.9, 0.4], bg: [0.06, 0.05, 0.0, 0.1] },  // 4 Yellow
  { primary: [1.0, 0.6, 0.0], secondary: [1.0, 0.8, 0.3], bg: [0.06, 0.03, 0.0, 0.1] },  // 3 Amber
  { primary: [1.0, 0.4, 0.0], secondary: [1.0, 0.6, 0.2], bg: [0.06, 0.02, 0.0, 0.1] },  // 2 Orange
  { primary: [1.0, 0.1, 0.1], secondary: [1.0, 0.4, 0.4], bg: [0.06, 0.0, 0.0, 0.1] },   // 1 Red
  { primary: null,            secondary: null,            bg: [0.02, 0.02, 0.03, 0.1] }  // I/O Google Colors
];

// Shaders
const pointVS = `
attribute vec2 position;
attribute vec3 color;
attribute float size;

uniform vec2 u_resolution;
uniform vec2 u_shake;
uniform vec2 u_parallax;
uniform float u_dpr;
uniform float u_time;

varying vec3 vColor;
varying float vTwinkle;

void main() {
  vec2 clipSpace = ((position / u_resolution) * 2.0) - 1.0;
  // Apply parallax and shake
  vec2 pos = (clipSpace + u_shake + (u_parallax * (0.02 + size * 0.005)));
  gl_Position = vec4(pos * vec2(1.0, -1.0), 0.0, 1.0);
  gl_PointSize = size * u_dpr;
  vColor = color;
  
  // Twinkle logic
  vTwinkle = 0.8 + 0.2 * sin(u_time * 0.005 + size * 1000.0);
}
`;

const pointFS = `
precision mediump float;
varying vec3 vColor;
varying float vTwinkle;

void main() {
  vec2 coord = gl_PointCoord - vec2(0.5);
  float dist = length(coord);
  if (dist > 0.5) discard;
  
  // Soft glowing core with sharper edge
  float alpha = smoothstep(0.5, 0.0, dist);
  alpha *= (1.0 - smoothstep(0.4, 0.5, dist)) * vTwinkle;
  
  // 17. Hero star lens flares
  float flare = smoothstep(0.1, 0.0, abs(coord.x)) * smoothstep(0.5, 0.0, abs(coord.y));
  flare += smoothstep(0.1, 0.0, abs(coord.y)) * smoothstep(0.5, 0.0, abs(coord.x));
  alpha = max(alpha, flare * alpha * vTwinkle);
  
  gl_FragColor = vec4(vColor, alpha);
}
`;

const quadVS = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

  const quadFS = `
precision mediump float;
uniform vec4 u_bg_color;
uniform vec2 u_resolution;
uniform float u_galaxy_factor; 
uniform float u_audio_intensity;
uniform vec2 u_parallax;
uniform float u_void_scale;

float noise(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 p = (gl_FragCoord.xy / u_resolution) * 2.0 - 1.0;
  p.x *= u_resolution.x / u_resolution.y;
  
  // Parallax influence on background logic
  p += u_parallax * 0.02;
  
  float d = length(p);
  
  float alpha = u_bg_color.a;
  vec3 col = u_bg_color.rgb;
  
  // Subtle film grain
  col += (noise(p + u_audio_intensity) - 0.5) * 0.02;

  // Starfield noise
  float stars = pow(noise(p * 300.0), 30.0) * 0.1;
  col += stars;

  if (u_galaxy_factor > 0.0) {
    // Gravitational Lensing / Accretion Disk (Interstellar styling)
    float diskScale = 0.25 + u_audio_intensity * 0.3;
    
    // Accretion disk edge glow with "light streaks"
    float angle = atan(p.y, p.x);
    
    // Add intricate procedural streaks
    float streaks = sin(angle * 30.0 + u_audio_intensity * 10.0) * 0.05 
                  + cos(angle * 15.0 - u_audio_intensity * 5.0) * 0.05;
                  
    // Deform disk based on distance to imitate black hole warping
    float warpedD = d * (1.0 - (0.05 / (d + 0.01)));
    
    float disk = smoothstep(0.12, 0.4 + streaks, warpedD) * smoothstep(0.9 + u_audio_intensity * 0.5, 0.3, warpedD);
    
    // Swirling motion based on position and audio
    float swirl = sin(warpedD * 25.0 - u_audio_intensity * 12.0 + angle * 3.0) * 0.5 + 0.5;
    vec3 galaxyCol = mix(vec3(0.5, 0.1, 0.9), vec3(0.1, 0.8, 1.0), swirl);
    
    // Golden-orange glow on the inner edge
    vec3 innerEnergy = mix(vec3(1.0, 0.5, 0.1), vec3(1.0, 1.0, 1.0), smoothstep(0.2, 0.15, warpedD));
    galaxyCol = mix(galaxyCol, innerEnergy, smoothstep(0.3, 0.15, warpedD));
    
    col += galaxyCol * disk * u_galaxy_factor * (0.8 + u_audio_intensity * 1.5);
    
    // Core Event Horizon (absolute black)
    float horizonSize = (0.18 - u_audio_intensity * 0.03) * u_void_scale;
    float center = 1.0 - smoothstep(horizonSize, horizonSize + 0.02, d);
    
    // Photon Sphere Glow - Fiery intense ring right on the event horizon
    float photonSphere = smoothstep(horizonSize + 0.1, horizonSize, d) * smoothstep(horizonSize - 0.05, horizonSize, d);
    col += vec3(1.0, 0.9, 0.7) * photonSphere * u_galaxy_factor * (2.0 + u_audio_intensity * 5.0);

    col *= (1.0 - center * u_galaxy_factor);
    alpha = mix(alpha, 1.0, center * u_galaxy_factor);
  }
  
  gl_FragColor = vec4(col * alpha, alpha);
}
`;

function compileShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Cannot create shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    throw new Error('Shader compile error');
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext, vs: string, fs: string) {
  const vShader = compileShader(gl, gl.VERTEX_SHADER, vs);
  const fShader = compileShader(gl, gl.FRAGMENT_SHADER, fs);
  const prog = gl.createProgram();
  if (!prog) throw new Error('Cannot create program');
  gl.attachShader(prog, vShader);
  gl.attachShader(prog, fShader);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(prog));
    throw new Error('Program link error');
  }
  return prog;
}

function sampleTextCoordinates(text: string, width: number, height: number, resolution: number) {
  if (width <= 0 || height <= 0) return [];
  const offscreen = document.createElement('canvas');
  offscreen.width = width;
  offscreen.height = height;
  const ctx = offscreen.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];

  let testFontSize = 100;
  ctx.font = `900 ${testFontSize}px "Arial Black", "Impact", system-ui, sans-serif`;
  let textWidth = ctx.measureText(text).width || (testFontSize * text.length * 0.6);
  let scale = Math.min((width * 0.5) / textWidth, (height * 0.5) / testFontSize);
  let fontSize = testFontSize * scale;
      
  ctx.font = `900 ${fontSize}px "Arial Black", "Impact", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(text, width / 2, height / 2);

  const imageData = ctx.getImageData(0, 0, width, height).data;
  const targets: {x: number, y: number, isOutline: boolean}[] = [];

  for (let y = 0; y < height; y += resolution) {
    for (let x = 0; x < width; x += resolution) {
      if (imageData[(y * width + x) * 4 + 3] > 128) {
        // Simple edge detection: check neighbors
        let isOutline = false;
        if (
          x - resolution < 0 || x + resolution >= width || 
          y - resolution < 0 || y + resolution >= height ||
          imageData[((y - resolution) * width + x) * 4 + 3] <= 128 ||
          imageData[((y + resolution) * width + x) * 4 + 3] <= 128 ||
          imageData[(y * width + (x - resolution)) * 4 + 3] <= 128 ||
          imageData[(y * width + (x + resolution)) * 4 + 3] <= 128
        ) {
          isOutline = true;
        }
        targets.push({ x, y, isOutline });
      }
    }
  }
  return targets;
}

class SynthEngine {
  ctx: AudioContext | null = null;
  masterGain: GainNode | null = null;
  analyser: AnalyserNode | null = null;
  droneGain: GainNode | null = null;
  droneOsc: OscillatorNode | null = null;
  droneMod: OscillatorNode | null = null;
  isMuted: boolean = false;
  initialized = false;

  init() {
    if (this.initialized) return;
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.6; 
    
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
    
    this.setupDrone();
    this.initialized = true;
  }

  destroy() {
    if (this.droneOsc) this.droneOsc.stop();
    if (this.droneMod) this.droneMod.stop();
    if (this.ctx) this.ctx.close();
    this.initialized = false;
  }

  getFrequencyData(): Uint8Array {
      if (!this.analyser) return new Uint8Array(0);
      const data = new Uint8Array(this.analyser.frequencyBinCount);
      this.analyser.getByteFrequencyData(data);
      return data;
  }

  toggleMute(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.6, this.ctx.currentTime, 0.1);
    }
  }

  setupDrone() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    
    this.droneOsc = this.ctx.createOscillator();
    this.droneGain = this.ctx.createGain();
    this.droneMod = this.ctx.createOscillator();
    const modGain = this.ctx.createGain();

    this.droneOsc.type = 'sine';
    this.droneOsc.frequency.value = 40; // 40Hz drone
    
    this.droneMod.type = 'sine';
    this.droneMod.frequency.value = 0.08; // 0.08 Hz LFO
    modGain.gain.value = 0.1; // ±10% modulation

    this.droneGain.gain.value = 0.05; // Mix at 5%
    
    this.droneMod.connect(modGain);
    const constantNode = this.ctx.createConstantSource();
    constantNode.offset.value = 1;
    constantNode.start();
    constantNode.connect(this.droneGain.gain);
    modGain.connect(this.droneGain.gain);

    this.droneOsc.connect(this.droneGain);
    this.droneGain.connect(this.masterGain);

    this.droneOsc.start();
    this.droneMod.start();
  }

  setTension(index: number) {
      if (!this.droneOsc || !this.droneMod || !this.ctx) return;
      const now = this.ctx.currentTime;
      if (index >= 0 && index <= 9) {
          const pitch = 40 + (index * 40 / 9);
          const lfo = 0.08 + (index * 0.32 / 9);
          this.droneOsc.frequency.setTargetAtTime(pitch, now, 0.5);
          this.droneMod.frequency.setTargetAtTime(lfo, now, 0.5);
      } else {
          this.droneOsc.frequency.setTargetAtTime(40, now, 1.0);
          this.droneMod.frequency.setTargetAtTime(0.08, now, 1.0);
      }
  }

  playWhoosh() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * 0.3; 
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;
    
    const noiseSrc = this.ctx.createBufferSource();
    noiseSrc.buffer = noiseBuffer;
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2000, now);
    filter.frequency.exponentialRampToValueAtTime(200, now + 0.3);
    
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.3);
    
    noiseSrc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    
    // Crackle
    const crackleFilter = this.ctx.createBiquadFilter();
    crackleFilter.type = 'bandpass';
    crackleFilter.frequency.setValueAtTime(10000, now);
    crackleFilter.Q.value = 1.0;
    const crackleGain = this.ctx.createGain();
    crackleGain.gain.setValueAtTime(0.08, now);
    crackleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    noiseSrc.connect(crackleFilter);
    crackleFilter.connect(crackleGain);
    crackleGain.connect(this.masterGain);
    
    noiseSrc.start();
  }
  
  playChord(index: number) {
    if (!this.initialized) this.init();
    if (this.ctx?.state === 'suspended') this.ctx.resume();
    if (!this.ctx || !this.masterGain) return;

    this.playWhoosh();
    const now = this.ctx.currentTime;
    
      if (index === 10) {
        // Finale fanfare (I/O)
        const freqs = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
      const octaves = [523.25, 659.25, 783.99, 1046.50];
      freqs.forEach((f, i) => {
        const osc1 = this.ctx!.createOscillator();
        const osc2 = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc1.frequency.value = f; osc2.frequency.value = octaves[i];
        osc1.type = 'sine'; osc2.type = 'sine';
        osc1.connect(gain); osc2.connect(gain);
        gain.connect(this.masterGain!);
        gain.gain.setValueAtTime(0, now + i * 0.08);
        gain.gain.linearRampToValueAtTime(0.1, now + i * 0.08 + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 5.0);
        osc1.start(now + i * 0.08); osc2.start(now + i * 0.08);
      });
      return;
    }

    // 10=Cm, 9=Dm, 8=Em, 7=Fm, 6=Gm, 5=Am, 4=Bm, 3=CM7, 2=DM7, 1=EM7
    const chords = [
      [130.81, 155.56, 196.00], // Cm
      [146.83, 174.61, 220.00], // Dm
      [164.81, 196.00, 246.94], // Em
      [174.61, 207.65, 261.63], // Fm
      [196.00, 233.08, 293.66], // Gm
      [220.00, 261.63, 329.63], // Am
      [246.94, 293.66, 369.99], // Bm
      [130.81, 164.81, 196.00, 246.94], // CM7
      [146.83, 185.00, 220.00, 277.18], // DM7
      [164.81, 207.65, 246.94, 311.13]  // EM7
    ];
    
    // Reversed: index 0 (which is "10") -> index 0 of chords
    const chord = chords[index] || chords[0];

    chord.forEach(freq => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine'; 
      osc.frequency.value = freq;
      osc.detune.value = (Math.random() - 0.5) * 8; // detail
      osc.connect(gain);
      gain.connect(this.masterGain!);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.2 / chord.length, now + 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 2.2);
      osc.start(now);
      osc.stop(now + 2.3);
    });
  }
}

class ParticleEngine {
  canvas: HTMLCanvasElement;
  gl: WebGLRenderingContext;
  
  numParticles: number;
  width = 0;
  height = 0;
  dpr = 1;
  animationFrameId = 0;

  posBuffer: WebGLBuffer;
  colorBuffer: WebGLBuffer;
  sizeBuffer: WebGLBuffer;
  quadBuffer: WebGLBuffer;

  posData: Float32Array;
  colorData: Float32Array;
  sizeData: Float32Array;

  x: Float32Array;
  y: Float32Array;
  tx: Float32Array;
  ty: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  mode: Uint8Array;
  orbitRadius: Float32Array;
  orbitAngle: Float32Array;
  orbitSpeed: Float32Array;
  ease: Float32Array;
  friction: Float32Array;
  targetColor: Float32Array;

  z: Float32Array;

  mouse = { x: -1000, y: -1000, radius: 150 };
  parallax = { x: 0, y: 0 };
  parallaxTarget = { x: 0, y: 0 };
  targetSize: Float32Array;
  
  pointProg: WebGLProgram;
  quadProg: WebGLProgram;

  galaxyFactor = 1.0;
  galaxyFactorTarget = 1.0;
  currentBgColor = THEMES[0].bg;
  shakeX = 0;
  shakeY = 0;
  shakeIntensity = 0;
  
  explodeTime = 0; // For chromatic aberration and shockwave
  orbitDecay = false; // For orbit decay outro

  synth: SynthEngine | null = null;
  freqData: any = new Uint8Array(0);

  overlayCtx: CanvasRenderingContext2D | null = null;

  constructor(canvas: HTMLCanvasElement, overlayCanvas: HTMLCanvasElement, synth: SynthEngine) {
    this.canvas = canvas;
    this.overlayCtx = overlayCanvas.getContext('2d');
    this.synth = synth;
    this.gl = canvas.getContext('webgl', { alpha: false, preserveDrawingBuffer: true, antialias: false })!;
    
    this.numParticles = window.innerWidth < 768 ? 20000 : 50000;
    
    this.posData = new Float32Array(this.numParticles * 2);
    this.colorData = new Float32Array(this.numParticles * 3);
    this.sizeData = new Float32Array(this.numParticles);

    this.x = new Float32Array(this.numParticles);
    this.y = new Float32Array(this.numParticles);
    this.tx = new Float32Array(this.numParticles);
    this.ty = new Float32Array(this.numParticles);
    this.vx = new Float32Array(this.numParticles);
    this.vy = new Float32Array(this.numParticles);
    this.mode = new Uint8Array(this.numParticles);
    this.orbitRadius = new Float32Array(this.numParticles);
    this.orbitAngle = new Float32Array(this.numParticles);
    this.orbitSpeed = new Float32Array(this.numParticles);
    this.ease = new Float32Array(this.numParticles);
    this.friction = new Float32Array(this.numParticles);
    this.z = new Float32Array(this.numParticles);
    this.targetColor = new Float32Array(this.numParticles * 3);
    this.targetSize = new Float32Array(this.numParticles);

    const maxRadius = Math.max(window.innerWidth, window.innerHeight) * 0.8;
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const arms = 3;

    for (let i = 0; i < this.numParticles; i++) {
      this.z[i] = Math.random();
      const isNebula = Math.random() < 0.01; 
      const isHero = Math.random() < 0.05;   

      if (isNebula) {
        this.mode[i] = 2; // Nebula
        this.sizeData[i] = 12 + Math.random() * 15; 
        this.targetSize[i] = this.sizeData[i];
        this.ease[i] = 0.003;
        this.friction[i] = 0.97; 
      } else {
        this.mode[i] = 0; // Galaxy
        this.sizeData[i] = isHero ? (1.5 + Math.random() * 2.5) : (0.5 + Math.random() * 1.0);
        this.targetSize[i] = this.sizeData[i];
        this.ease[i] = 0.01 + Math.random() * 0.015;
        this.friction[i] = 0.88 + Math.random() * 0.06;
      }

    // 9. Tighter spiral arms with dust lanes
    this.orbitRadius[i] = (Math.pow(Math.random(), 4.5) * 0.75 + 0.25) * maxRadius;
    
    // Core distribution: 80% in arms, 20% in lanes
    let armAngle = 0;
    if (Math.random() < 0.8) {
      // In arm
      const armIdx = Math.floor(Math.random() * arms);
      armAngle = (armIdx / arms) * Math.PI * 2 + (Math.random() - 0.5) * 0.15 * 2;
    } else {
      // Dust lane
      armAngle = Math.random() * Math.PI * 2;
      this.orbitRadius[i] *= (0.7 + Math.random() * 0.6); // diffuse
    }

    // Tighter spiral warp
    this.orbitAngle[i] = armAngle + (this.orbitRadius[i] / maxRadius) * 16.0;
    
    this.orbitSpeed[i] = (0.0001 + (1.0 - (this.orbitRadius[i] / maxRadius)) * 0.003) * (Math.random() > 0.5 ? 1 : -1);

      const c = GALAXY_COLORS[Math.floor(Math.random() * GALAXY_COLORS.length)];
      let r = c[0], g = c[1], b = c[2];
      
      if (isNebula) {
        // Deep space colors for nebula
        const nebulaC = [
            [0.2, 0.4, 0.8], // Blueish
            [0.6, 0.2, 0.8], // Purple
            [0.8, 0.4, 0.2]  // Gold/Orange
        ][Math.floor(Math.random() * 3)];
        r = nebulaC[0]; g = nebulaC[1]; b = nebulaC[2];
      }

      const ci = i * 3;
      this.colorData[ci] = r;
      this.colorData[ci+1] = g;
      this.colorData[ci+2] = b;
      this.targetColor[ci] = r;
      this.targetColor[ci+1] = g;
      this.targetColor[ci+2] = b;

      this.x[i] = cx + Math.cos(this.orbitAngle[i]) * this.orbitRadius[i];
      this.y[i] = cy + Math.sin(this.orbitAngle[i]) * this.orbitRadius[i] * 0.6;
      this.tx[i] = this.x[i];
      this.ty[i] = this.y[i];
      
      this.posData[i*2] = this.x[i];
      this.posData[i*2+1] = this.y[i];
    }

    this.pointProg = createProgram(this.gl, pointVS, pointFS);
    this.quadProg = createProgram(this.gl, quadVS, quadFS);

    this.posBuffer = this.gl.createBuffer()!;
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.posBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, this.posData, this.gl.DYNAMIC_DRAW);

    this.colorBuffer = this.gl.createBuffer()!;
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.colorBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, this.colorData, this.gl.DYNAMIC_DRAW);

    this.sizeBuffer = this.gl.createBuffer()!;
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.sizeBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, this.sizeData, this.gl.DYNAMIC_DRAW);

    const quadCoords = new Float32Array([-1,-1, 1,-1, -1,1, 1,1]);
    this.quadBuffer = this.gl.createBuffer()!;
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.quadBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, quadCoords, this.gl.STATIC_DRAW);

    this.resize();
    window.addEventListener('resize', this.resize);
    this.canvas.addEventListener('mousemove', this.onMouseMove);
    this.canvas.addEventListener('touchmove', this.onTouchMove, { passive: true });
    this.canvas.addEventListener('mouseout', this.onMouseOut);
    this.canvas.addEventListener('touchend', this.onMouseOut);

    this.gl.clearColor(0.01, 0.01, 0.02, 1.0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    this.loop();
  }

  destroy = () => {
    window.removeEventListener('resize', this.resize);
    this.canvas.removeEventListener('mousemove', this.onMouseMove);
    this.canvas.removeEventListener('touchmove', this.onTouchMove);
    this.canvas.removeEventListener('mouseout', this.onMouseOut);
    this.canvas.removeEventListener('touchend', this.onMouseOut);
    cancelAnimationFrame(this.animationFrameId);

    const gl = this.gl;
    if (gl) {
        gl.deleteBuffer(this.posBuffer);
        gl.deleteBuffer(this.colorBuffer);
        gl.deleteBuffer(this.sizeBuffer);
        gl.deleteBuffer(this.quadBuffer);
        gl.deleteProgram(this.pointProg);
        gl.deleteProgram(this.quadProg);
    }
    if (this.synth) {
      this.synth.destroy();
    }
  };

  resize = () => {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  };

  onMouseMove = (e: MouseEvent) => {
    this.mouse.x = e.clientX;
    this.mouse.y = e.clientY;
    this.parallaxTarget.x = (e.clientX / window.innerWidth - 0.5) * 2;
    this.parallaxTarget.y = (e.clientY / window.innerHeight - 0.5) * 2;
  };

  onTouchMove = (e: TouchEvent) => {
    if (e.touches.length > 0) {
      this.mouse.x = e.touches[0].clientX;
      this.mouse.y = e.touches[0].clientY;
      this.parallaxTarget.x = (e.touches[0].clientX / window.innerWidth - 0.5) * 2;
      this.parallaxTarget.y = (e.touches[0].clientY / window.innerHeight - 0.5) * 2;
    }
  };

  onMouseOut = () => {
    this.mouse.x = -1000;
    this.mouse.y = -1000;
  };

  setGalaxyMode = () => {
    this.orbitDecay = false;
    this.explodeTime = 0;
    this.galaxyFactorTarget = 1.0;
    this.currentBgColor = [0.03, 0.03, 0.04, 0.2]; 
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    for (let i = 0; i < this.numParticles; i++) {
        if (this.mode[i] !== 2) { 
            this.mode[i] = 0;
            this.orbitRadius[i] = Math.max(Math.min(this.width, this.height) * 0.15, this.orbitRadius[i]);
            const dx = this.x[i] - cx;
            const dy = this.y[i] - cy;
            const dist = Math.sqrt(dx*dx + dy*dy) || 1;
            this.vx[i] += (dx / dist) * 15.0 + (Math.random() - 0.5) * 5;
            this.vy[i] += (dy / dist) * 15.0 + (Math.random() - 0.5) * 5;
            
            this.ease[i] = 0.01 + Math.random() * 0.02;
            this.friction[i] = 0.85 + Math.random() * 0.1;
            this.targetSize[i] = (Math.random() < 0.05) ? (1.5 + Math.random() * 2.5) : (0.5 + Math.random() * 1.0);
            
            let c = GALAXY_COLORS[Math.floor(Math.random() * GALAXY_COLORS.length)];
            const ci = i * 3;
            this.colorData[ci] = 1.0; this.colorData[ci+1] = 1.0; this.colorData[ci+2] = 1.0;
            this.targetColor[ci] = c[0];
            this.targetColor[ci+1] = c[1];
            this.targetColor[ci+2] = c[2];
        }
    }
  };

    setText = (text: string, theme: any) => {
    this.explodeTime = performance.now();
    this.orbitDecay = false;
    const isMobile = window.innerWidth < 768;
    const reducedMotion = typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;
    const resolution = isMobile ? 3 : 2; 
    let targets = sampleTextCoordinates(text, this.width, this.height, resolution);
    targets.sort((a,b) => a.x - b.x);

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    targets.forEach(t => {
       if (t.x < minX) minX = t.x;
       if (t.x > maxX) maxX = t.x;
       if (t.y < minY) minY = t.y;
       if (t.y > maxY) maxY = t.y;
    });
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const maxDist = Math.max((maxX - minX) / 2, (maxY - minY) / 2) || 1;

    let pIndices: number[] = [];
    for(let i=0; i<this.numParticles; i++) {
       if(this.mode[i] !== 2) pIndices.push(i);
    }
    pIndices.sort((a,b) => this.x[a] - this.x[b]);

    let targetColors = theme.primary === null ? GOOGLE_COLORS : [theme.primary, theme.secondary];
    
    const wasTextMode = this.galaxyFactorTarget === 0.0;
    this.galaxyFactorTarget = 0.0;
    this.currentBgColor = theme.bg;
    
    // Hyperdrive effect for I/O
    if (text === "I / O") {
        this.shakeIntensity = 40;
        for (let i = 0; i < this.numParticles; i++) {
            this.vx[i] *= 15;
            this.vy[i] *= 15;
        }
    } else {
        this.shakeIntensity = 15; 
    }

    let targetIdx = 0;
    for (let j = 0; j < pIndices.length; j++) {
        const i = pIndices[j];

        if (targets.length > 0 && (targetIdx < targets.length || this.numParticles < targets.length * 2)) {
            const t = targets[targetIdx % targets.length];
            this.tx[i] = t.x + (Math.random() - 0.5) * 12;
            this.ty[i] = t.y + (Math.random() - 0.5) * 12;
            this.mode[i] = 1; 
            this.ease[i] = 0.12 + Math.random() * 0.08;
            this.friction[i] = 0.75 + Math.random() * 0.1; 
            
            if (!reducedMotion) {
                if (!wasTextMode || Math.random() > 0.3) {
                    this.vx[i] += (Math.random() - 0.5) * 35;
                    this.vy[i] += (Math.random() - 0.5) * 35;
                }
            }
            const distToCenter = Math.sqrt(Math.pow(t.x - centerX, 2) + Math.pow(t.y - centerY, 2));
            const normalizedDist = distToCenter / maxDist;
            
            // Highlight outline particles
            if (t.isOutline) {
                this.targetSize[i] = (2.0 + normalizedDist * 1.5) * (0.8 + Math.random() * 0.4);
                let c = targetColors[0]; // Use first theme color for outline
                const ci = i * 3;
                this.targetColor[ci] = c[0] * 1.2; // Brighter
                this.targetColor[ci+1] = c[1] * 1.2;
                this.targetColor[ci+2] = c[2] * 1.2;
            } else {
                this.targetSize[i] = (0.5 + normalizedDist * 1.5) * (0.5 + Math.random() * 1.0);
                let c = targetColors[Math.floor(Math.random() * targetColors.length)];
                const ci = i * 3;
                this.targetColor[ci] = c[0] * 0.3; // Dimmer fill
                this.targetColor[ci+1] = c[1] * 0.3;
                this.targetColor[ci+2] = c[2] * 0.3;
            }

            targetIdx++;
        } else {
            this.mode[i] = 0; 
            this.orbitRadius[i] = Math.max(Math.min(this.width, this.height)*0.15, this.orbitRadius[i]);
            this.ease[i] = 0.01 + Math.random() * 0.02;
            this.friction[i] = 0.85 + Math.random() * 0.05;
            this.targetSize[i] = (Math.random() < 0.05) ? (1.5 + Math.random() * 2.5) : (0.5 + Math.random() * 1.0);
            
            // Fireworks for I/O
            if (text === "I / O" && Math.random() < 0.1) {
                this.vx[i] += (Math.random() - 0.5) * 100;
                this.vy[i] += (Math.random() - 0.5) * 100;
                this.targetSize[i] = 5.0;
                let c = GOOGLE_COLORS[Math.floor(Math.random() * GOOGLE_COLORS.length)];
                const ci = i * 3;
                this.targetColor[ci] = c[0];
                this.targetColor[ci+1] = c[1];
                this.targetColor[ci+2] = c[2];
            } else {
                let c = GALAXY_COLORS[Math.floor(Math.random() * GALAXY_COLORS.length)];
                const ci = i * 3;
                // Darken non-text particles so the text stands out more
                this.targetColor[ci] = c[0] * 0.15; 
                this.targetColor[ci+1] = c[1] * 0.15;
                this.targetColor[ci+2] = c[2] * 0.15;
            }
        }
    }

    // Set Nebula colors
    for (let i = 0; i < this.numParticles; i++) {
        if (this.mode[i] === 2) {
             let c = targetColors[Math.floor(Math.random() * targetColors.length)];
             const ci = i * 3;
             this.targetColor[ci] = c[0] * 0.3;
             this.targetColor[ci+1] = c[1] * 0.3;
             this.targetColor[ci+2] = c[2] * 0.3;
        }
    }
  };

  loop = () => {
    const cx = this.width / 2;
    const cy = this.height / 2;
    const mx = this.mouse.x;
    const my = this.mouse.y;
    const mRadius = this.mouse.radius;
    const mRadiusSq = mRadius * mRadius;

    this.parallax.x += (this.parallaxTarget.x - this.parallax.x) * 0.05;
    this.parallax.y += (this.parallaxTarget.y - this.parallax.y) * 0.05;

    if (this.synth) {
        this.freqData = this.synth.getFrequencyData();
    }

    const x = this.x, y = this.y, tx = this.tx, ty = this.ty;
    const vx = this.vx, vy = this.vy, mode = this.mode;
    const orbitRadius = this.orbitRadius, orbitAngle = this.orbitAngle;
    const orbitSpeed = this.orbitSpeed, ease = this.ease, friction = this.friction;
    const cd = this.colorData, tc = this.targetColor, pd = this.posData;

    let avgFreq = 0;
    if (this.freqData.length > 0) {
        for (let i = 0; i < 64; i++) avgFreq += this.freqData[i];
        avgFreq /= 64;
    }
    const audioScale = 1.0 + (avgFreq / 255) * 1.5;
    const reducedMotion = typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;

    for (let i = 0; i < this.numParticles; i++) {
      const m = mode[i];
      
      let mdx = x[i] - mx;
      let mdy = y[i] - my;
      let mdistSq = mdx*mdx + mdy*mdy;

      if (m === 0 || m === 2) { 
        let ang = orbitAngle[i] + orbitSpeed[i];
        orbitAngle[i] = ang;
        let rad = orbitRadius[i];
        
        // Vibrate orbit radius with audio
        if (avgFreq > 20) {
            rad += (Math.random() - 0.5) * (avgFreq * 0.1);
        }

        tx[i] = cx + Math.cos(ang) * rad;
        ty[i] = cy + Math.sin(ang) * rad * 0.6; 
      } else if (m === 1) { 
        tx[i] += (Math.random() - 0.5) * 0.2;
        ty[i] += (Math.random() - 0.5) * 0.2;
      }
      
      if (this.orbitDecay) {
        tx[i] = cx;
        ty[i] = cy;
        ease[i] = 0.05;
        friction[i] = 0.90;
      }
      
      let dx = tx[i] - x[i];
      let dy = ty[i] - y[i];
      let distSq = dx*dx + dy*dy;
      let curEase = ease[i];
      
      // Inject audio energy into velocity
      if (avgFreq > 50) {
          vx[i] += (Math.random() - 0.5) * (avgFreq * 0.05);
          vy[i] += (Math.random() - 0.5) * (avgFreq * 0.05);
      }

        if (m === 2) {
          // Nebula behavior: swirl around mouse if close
          if (mdistSq < mRadiusSq * 4) {
             let angle = Math.atan2(mdy, mdx) + 0.1;
             let dist = Math.sqrt(mdistSq);
             tx[i] = mx + Math.cos(angle) * dist;
             ty[i] = my + Math.sin(angle) * dist;
          }
          vx[i] += dx * curEase;
          vy[i] += dy * curEase;
          vx[i] += (Math.random() - 0.5) * curEase * 12;
          vy[i] += (Math.random() - 0.5) * curEase * 12;
        } else {
         if (m === 1) {
            // Elastic arrival for text mode
            if (distSq > 1600 && !reducedMotion) {
               let dist = Math.sqrt(distSq);
               let angle = Math.atan2(dy, dx) + 0.3; // Spatial swirl
               vx[i] += Math.cos(angle) * dist * curEase * 0.8;
               vy[i] += Math.sin(angle) * dist * curEase * 0.8;
            } else {
               vx[i] += dx * curEase;
               vy[i] += dy * curEase;
            }
          } else {
            // Smooth orbital motion
            vx[i] += dx * curEase;
            vy[i] += dy * curEase;
          }
      }
      
      if (mdistSq < mRadiusSq) {
        let mdist = Math.sqrt(mdistSq);
        let force = (mRadius - mdist) / mRadius;
        let angle = Math.atan2(mdy, mdx);
        vx[i] += Math.cos(angle) * force * 15;
        vy[i] += Math.sin(angle) * force * 15;
      }
      
      vx[i] *= friction[i];
      vy[i] *= friction[i];
      x[i] += vx[i];
      y[i] += vy[i];
      
      const ci = i * 3;
      cd[ci]   += (tc[ci]   - cd[ci])   * 0.05;
      cd[ci+1] += (tc[ci+1] - cd[ci+1]) * 0.05;
      cd[ci+2] += (tc[ci+2] - cd[ci+2]) * 0.05;

      this.sizeData[i] += (this.targetSize[i] - this.sizeData[i]) * 0.1;

      pd[i*2]   = x[i];
      pd[i*2+1] = y[i];
    }

    if (this.shakeIntensity > 0.1) {
      this.shakeX = (Math.random() - 0.5) * this.shakeIntensity;
      this.shakeY = (Math.random() - 0.5) * this.shakeIntensity;
      this.shakeIntensity *= 0.85; 
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
    }

    const now = performance.now();
    const t = Math.max(0, now - this.explodeTime);
    const ct = this.explodeTime === 0 ? 9999 : t;

    let voidScale = 1.0;
    
    if (this.galaxyFactorTarget === 0 && ct > 10000 && !this.orbitDecay) {
        this.orbitDecay = true;
        for(let i=0; i<this.numParticles; i++) {
            this.vx[i] = 0;
            this.vy[i] = 0;
        }
    }
    
    if (this.orbitDecay) {
        this.galaxyFactorTarget = 1.0; 
        const decayTime = ct - 10000;
        if (decayTime > 0) {
            voidScale = 1.0 + Math.min(1.5, (decayTime / 3000) * 1.5);
        }
    }

    this.galaxyFactor += (this.galaxyFactorTarget - this.galaxyFactor) * 0.05;

    const gl = this.gl;
    
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(this.quadProg);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    const qLoc = gl.getAttribLocation(this.quadProg, 'position');
    gl.enableVertexAttribArray(qLoc);
    gl.vertexAttribPointer(qLoc, 2, gl.FLOAT, false, 0, 0);
    
    gl.uniform2f(gl.getUniformLocation(this.quadProg, 'u_resolution'), this.canvas.width, this.canvas.height);
    gl.uniform4fv(gl.getUniformLocation(this.quadProg, 'u_bg_color'), this.currentBgColor);
    gl.uniform1f(gl.getUniformLocation(this.quadProg, 'u_galaxy_factor'), this.galaxyFactor);
    gl.uniform1f(gl.getUniformLocation(this.quadProg, 'u_audio_intensity'), avgFreq / 255.0);
    gl.uniform2f(gl.getUniformLocation(this.quadProg, 'u_parallax'), this.parallax.x, this.parallax.y);
    gl.uniform1f(gl.getUniformLocation(this.quadProg, 'u_void_scale'), voidScale);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.posData);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.colorData);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.sizeBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.sizeData);

    gl.useProgram(this.pointProg);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
    const pLoc = gl.getAttribLocation(this.pointProg, 'position');
    gl.enableVertexAttribArray(pLoc);
    gl.vertexAttribPointer(pLoc, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
    const cLoc = gl.getAttribLocation(this.pointProg, 'color');
    gl.enableVertexAttribArray(cLoc);
    gl.vertexAttribPointer(cLoc, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.sizeBuffer);
    const sLoc = gl.getAttribLocation(this.pointProg, 'size');
    gl.enableVertexAttribArray(sLoc);
    gl.vertexAttribPointer(sLoc, 1, gl.FLOAT, false, 0, 0);

    gl.uniform2f(gl.getUniformLocation(this.pointProg, 'u_resolution'), this.width, this.height);
    gl.uniform2f(gl.getUniformLocation(this.pointProg, 'u_shake'), this.shakeX / this.width, this.shakeY / this.height);
    gl.uniform2f(gl.getUniformLocation(this.pointProg, 'u_parallax'), this.parallax.x, this.parallax.y);
    gl.uniform1f(gl.getUniformLocation(this.pointProg, 'u_time'), performance.now());
    
    // Scale point size based on audio average
    const pulseFactor = avgFreq / 255.0;
    gl.uniform1f(gl.getUniformLocation(this.pointProg, 'u_dpr'), this.dpr * (1.0 + pulseFactor * 0.4));

    gl.drawArrays(gl.POINTS, 0, this.numParticles);

    // Overlay Post-Processing
    if (this.overlayCtx) {
        const ctx = this.overlayCtx;
        ctx.clearRect(0, 0, this.width, this.height);
        
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.15;
        const scale = 1.05;
        const dw = this.width * scale;
        const dh = this.height * scale;
        
        if (this.canvas.width > 0 && this.canvas.height > 0 && dw > 0 && dh > 0) {
            ctx.drawImage(this.canvas, (this.width - dw) / 2, (this.height - dh) / 2, dw, dh);
        }
        ctx.globalAlpha = 1.0;
        ctx.globalCompositeOperation = 'source-over';
        
        // 15. Shockwave ring
        if (ct < 1000 && !reducedMotion) {
            const progress = ct / 1000;
            const r = progress * Math.max(this.width, this.height);
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 255, 255, ${1.0 - Math.pow(progress, 0.5)})`;
            ctx.lineWidth = 4 + (1 - progress) * 20;
            ctx.stroke();

            // 16. Chromatic aberration flash
            if (ct < 300) {
                const flash = 1.0 - (ct / 300);
                ctx.globalCompositeOperation = 'screen';
                ctx.fillStyle = `rgba(255, 0, 0, ${0.18 * flash})`;
                ctx.fillRect((Math.random()-0.5)*10, (Math.random()-0.5)*10, this.width, this.height);
                ctx.fillStyle = `rgba(0, 0, 255, ${0.18 * flash})`;
                ctx.fillRect((Math.random()-0.5)*10, (Math.random()-0.5)*10, this.width, this.height);
                ctx.globalCompositeOperation = 'source-over';
            }
        }
        
        // Audio visualiser ring
        if (avgFreq > 5 && this.galaxyFactor > 0.01) {
            const rBase = Math.min(this.width, this.height) * 0.15 * 1.05;
            ctx.beginPath();
            for (let i = 0; i <= 64; i++) {
                const fIndex = i === 64 ? 0 : i;
                const amp = this.freqData[fIndex] / 255.0;
                const angle = (i / 64) * Math.PI * 2;
                const rLine = rBase + amp * 30 * this.galaxyFactor;
                const lx = cx + Math.cos(angle) * rLine;
                const ly = cy + Math.sin(angle) * rLine * 0.6;
                if (i === 0) ctx.moveTo(lx, ly);
                else ctx.lineTo(lx, ly);
            }
            ctx.closePath();
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.4 * this.galaxyFactor})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
        
        // 14. Nebula blobs
        ctx.globalCompositeOperation = 'screen';
        const drawNebula = (color: string, speed1: number, speed2: number, size: number) => {
            const nx = cx + Math.cos(now * speed1) * this.width * 0.3;
            const ny = cy + Math.sin(now * speed2) * this.height * 0.3;
            const grad = ctx.createRadialGradient(nx, ny, 0, nx, ny, size);
            grad.addColorStop(0, color);
            grad.addColorStop(1, 'transparent');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(nx, ny, size, 0, Math.PI * 2);
            ctx.fill();
        };

        const pulse = avgFreq / 255.0;
        const bSize = Math.max(this.width, this.height) * 0.4 * (1.0 + pulse * 0.2);
        
        drawNebula('rgba(0, 255, 255, 0.05)', 0.0003, 0.0004, bSize);
        drawNebula('rgba(255, 0, 255, 0.05)', 0.0005, 0.0002, bSize * 1.2);
        drawNebula('rgba(0, 100, 255, 0.05)', 0.0002, 0.0006, bSize * 0.8);
        ctx.globalCompositeOperation = 'source-over';
    }

    this.animationFrameId = requestAnimationFrame(this.loop);
  };
}

export default function CodeTheCountdown() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<ParticleEngine | null>(null);
  const synthRef = useRef<SynthEngine | null>(null);

  const [index, setIndex] = useState(() => {
     if (typeof window !== 'undefined' && window.location.hash) {
        const params = new URLSearchParams(window.location.hash.slice(1));
        if (params.has('step') && Number(params.get('step')) >= 0) {
           return parseInt(params.get('step')||'-1');
        }
     }
     return -1;
  });
  const [isPlaying, setIsPlaying] = useState(() => {
     if (typeof window !== 'undefined' && window.location.hash) {
        const params = new URLSearchParams(window.location.hash.slice(1));
        if (params.has('step') && Number(params.get('step')) >= 0) return false;
     }
     return false;
  });
  const [hasStarted, setHasStarted] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const [showInteractionTip, setShowInteractionTip] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const tm = setTimeout(() => {
        setIsMuted(localStorage.getItem('galaxy-mute') === 'true');
      }, 0);
      return () => clearTimeout(tm);
    }
  }, []);

  const [pace, setPace] = useState(() => {
     if (typeof window !== 'undefined' && window.location.hash) {
        const params = new URLSearchParams(window.location.hash.slice(1));
        if (params.has('pace')) {
           return parseInt(params.get('pace')||'3200');
        }
     }
     return 3200;
  });
  const [isLive, setIsLive] = useState(false);
  const [liveDays, setLiveDays] = useState("0d");
  const [liveTime, setLiveTime] = useState("");
  const [controlsVisible, setControlsVisible] = useState(true);
  const [konamiActivated, setKonamiActivated] = useState(false);
  
  const setStep = useCallback((newIndex: number) => {
      if (newIndex >= MESSAGES.length) {
         setIsPlaying(false);
         newIndex = -1; 
      }

      setIndex(newIndex);
      
      if (newIndex === -1) {
          engineRef.current?.setGalaxyMode();
          synthRef.current?.setTension(-1);
      } else {
          const theme = THEMES[newIndex % THEMES.length];
          engineRef.current?.setText(isLive ? liveDays : MESSAGES[newIndex], theme);
          synthRef.current?.playChord(newIndex);
          synthRef.current?.setTension(newIndex);
      }
  }, [isLive, liveDays]);

  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let konamiIndex = 0;
    const konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];
    
    const konamiHandler = (e: KeyboardEvent) => {
      if (e.code === konamiCode[konamiIndex]) {
         konamiIndex++;
         if (konamiIndex === konamiCode.length) {
            setKonamiActivated(true);
            setTimeout(() => setKonamiActivated(false), 2000);
            konamiIndex = 0;
            // Fun full-screen flash effect logic
            if (engineRef.current) {
                engineRef.current.shakeIntensity = 100;
                const gl = engineRef.current.gl;
                gl.clearColor(1, 1, 1, 1);
                gl.clear(gl.COLOR_BUFFER_BIT);
                engineRef.current.explodeTime = performance.now();
            }
            synthRef.current?.playChord(3); 
         }
      } else {
         konamiIndex = 0;
      }
    };
    
    window.addEventListener('keydown', konamiHandler);
    return () => window.removeEventListener('keydown', konamiHandler);
  }, []);

  useEffect(() => {
    const showControls = () => {
      setControlsVisible(true);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = setTimeout(() => {
        setControlsVisible(false);
      }, 3000);
    };

    window.addEventListener('mousemove', showControls);
    window.addEventListener('touchstart', showControls, { passive: true });
    window.addEventListener('keydown', showControls);
    showControls(); 

    return () => {
      window.removeEventListener('mousemove', showControls);
      window.removeEventListener('touchstart', showControls);
      window.removeEventListener('keydown', showControls);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

  const touchStartX = useRef(0);

  useEffect(() => {
    localStorage.setItem('galaxy-mute', isMuted.toString());
    synthRef.current?.toggleMute(isMuted);
  }, [isMuted]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
       window.history.replaceState(null, '', `#step=${index}&pace=${pace}`);
    }
  }, [index, pace]);



  useEffect(() => {
    if (isLive) {
      const io2026 = new Date('May 20, 2026 09:00:00 PST').getTime();
      const updateLive = () => {
        const diff = io2026 - Date.now();
        if (diff <= 0) {
           setLiveDays("0d"); setLiveTime("00:00:00");
           if (index !== 10) setStep(10);
           return;
        }
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const mins = Math.floor((diff / 1000 / 60) % 60);
        const secs = Math.floor((diff / 1000) % 60);
        setLiveDays(days > 0 ? `D-${days}` : "I / O");
        setLiveTime(`${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
      };
      updateLive();
      const int = setInterval(updateLive, 1000);
      return () => clearInterval(int);
    }
  }, [isLive, index, setStep]);

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    if (canvasRef.current && overlayRef.current) {
      synthRef.current = new SynthEngine();
      engineRef.current = new ParticleEngine(canvasRef.current, overlayRef.current, synthRef.current);
    }
    return () => {
      engineRef.current?.destroy();
    };
  }, []);
  
  const handleNext = useCallback(() => {
      setStep(index + 1);
  }, [index, setStep]);

  const handlePrev = useCallback(() => {
     setStep(Math.max(-1, index - 1));
  }, [index, setStep]);

  const handleReset = useCallback(() => {
      setIsPlaying(false);
      setStep(-1);
  }, [setStep]);

  const togglePlay = useCallback(() => {
      if (!hasStarted) {
          setHasStarted(true);
          setShowInteractionTip(true);
          setTimeout(() => setShowInteractionTip(false), 5000);
          synthRef.current?.init();
      }
      if (!isPlaying && index === -1) setStep(0);
      setIsPlaying(prev => !prev);
  }, [hasStarted, isPlaying, index, setStep]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying && !isLive) {
      interval = setInterval(() => {
        handleNext();
      }, index === 10 ? 15000 : (index === 9 ? Math.max(2500, pace * 1.5) : pace)); 
    }
    return () => clearInterval(interval);
  }, [isPlaying, index, handleNext, pace, isLive]);

  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (e.code === 'Space') {
              e.preventDefault();
              togglePlay();
          } else if (e.code === 'ArrowRight') {
              handleNext();
          } else if (e.code === 'ArrowLeft') {
              handlePrev();
          } else if (e.code === 'KeyR') {
              handleReset();
          } else if (e.code === 'KeyF') {
              toggleFullscreen();
          }
      };
      
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, handleNext, handlePrev, handleReset]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    if (deltaX < -50) handleNext();
    else if (deltaX > 50) handlePrev();
  };

  const handleCanvasClick = () => {
    if (index === -1) togglePlay();
    else handleNext();
  };

  const takeScreenshot = () => {
    if (canvasRef.current) {
        const link = document.createElement('a');
        link.download = 'galaxy-collapse.png';
        link.href = canvasRef.current.toDataURL('image/png');
        link.click();
    }
  };

  return (
    <div className="fixed inset-0 w-full h-screen bg-[#020205] overflow-hidden selection:bg-transparent touch-none">
      <div 
        className="absolute inset-0 w-full h-full"
        style={{
           transition: index === 10 ? 'all 12s cubic-bezier(0.2, 0.8, 0.2, 1)' : 'all 1s ease',
           filter: index === 10 ? 'hue-rotate(360deg)' : 'hue-rotate(0deg)',
           transform: index === 10 ? 'scale(1.08)' : 'scale(1)',
        }}
      >
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="absolute inset-0 cursor-crosshair z-0"
        />
        
        <canvas 
          ref={overlayRef} 
          className="absolute inset-0 pointer-events-none mix-blend-screen z-10" 
        />

        <div className="absolute inset-x-0 bottom-0 h-1/2 pointer-events-none bg-gradient-to-t from-black/80 to-transparent z-0" />
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.85)_100%)] mix-blend-multiply z-10" />
        
        {index === 10 && (
           <motion.div 
             initial={{ opacity: 0, filter: 'blur(10px)' }}
             animate={{ opacity: 1, filter: 'blur(0px)' }}
             transition={{ delay: 2, duration: 4, ease: 'easeOut' }}
             className="absolute top-[60%] flex w-full justify-center z-20 pointer-events-none drop-shadow-[0_0_15px_rgba(255,255,255,0.5)] overflow-hidden"
             style={{ maxWidth: '100vw' }}
           >
             <span className="text-white/70 text-lg md:text-3xl font-mono uppercase text-center block px-4 whitespace-nowrap flex gap-1">
               {"Google I/O 2026".split('').map((char, i) => (
                   <motion.span 
                      key={i} 
                      initial={{opacity: 0, y: 20}}
                      animate={{opacity: 1, y: 0}}
                      transition={{delay: 2 + i * 0.06, duration: 0.5}}
                      style={{ letterSpacing: '0.18em', fontWeight: 300, color: 'rgba(255,255,255,0.82)' }}
                   >
                     {char === ' ' ? '\u00A0' : char}
                   </motion.span>
               ))}
             </span>
           </motion.div>
        )}
        
        {isLive && index !== 10 && (
           <motion.div 
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             className="absolute top-[65%] w-full text-center text-white/50 text-xl font-mono tracking-widest pointer-events-none z-20 flex flex-col items-center gap-2"
           >
             <div className="flex items-center gap-2 bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20 mb-2">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[10px] text-red-400 font-bold uppercase tracking-tighter">Live Stream Countdown</span>
             </div>
             {liveTime}
           </motion.div>
        )}
      </div>
      
      <div className={`absolute top-8 right-8 flex gap-4 pointer-events-auto z-20 items-center transition-opacity duration-500 ${controlsVisible ? 'opacity-100' : 'opacity-0'}`}>
         <button 
           onClick={() => setIsMuted(!isMuted)} 
           className="text-white/60 hover:text-white transition-colors" 
           title="Toggle Sound"
           aria-label={isMuted ? "Unmute" : "Mute"}
         >
           {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
         </button>
         <button 
           onClick={takeScreenshot} 
           className="text-white/60 hover:text-white transition-colors" 
           title="Screenshot"
           aria-label="Take Screenshot"
         >
           <Camera className="w-5 h-5" />
         </button>
      </div>
      
      <div className={`absolute top-24 right-8 flex gap-2 pointer-events-auto z-10 transition-opacity duration-500 ${controlsVisible ? 'opacity-100' : 'opacity-0'}`}>
         {MESSAGES.map((msg, i) => (
             <div 
               key={i} 
               onClick={() => setStep(i)}
               title={msg}
               className={`w-2 h-2 rounded-full cursor-pointer transition-all duration-500 will-change-transform hover:scale-[2.0] hover:bg-white ${
                 i === index ? 'bg-white scale-[1.75] shadow-[0_0_8px_rgba(255,255,255,0.8)]' : 
                 (i < index ? 'bg-white/45' : 'bg-white/15')
               }`} 
             />
         ))}
      </div>

      <div className={`absolute top-0 w-full bg-black z-30 transition-all duration-1000 ${isPlaying && !isLive ? 'h-12' : 'h-0'}`} />
      <div className={`absolute bottom-0 w-full bg-black z-30 transition-all duration-1000 ${isPlaying && !isLive ? 'h-12' : 'h-0'}`} />

      <motion.div 
        className={`absolute bottom-16 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 z-40 transition-opacity duration-500 ${controlsVisible ? 'opacity-100' : 'opacity-0'}`}
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5, type: 'spring' }}
      >
        <div className="flex items-center gap-4 bg-white/5 backdrop-blur-md px-6 py-4 rounded-full border border-white/10 shadow-2xl pointer-events-auto">
        <button
          onClick={handleReset}
          className="p-3 bg-white/5 hover:bg-white/10 text-white flex-shrink-0 rounded-full transition-colors active:scale-95"
          title="Back to Galaxy (R)"
          aria-label="Reset Galaxy"
        >
          <RotateCcw className="w-5 h-5" />
        </button>

        <button
          onClick={togglePlay}
          className="p-4 bg-indigo-600 hover:bg-indigo-500 text-white aspect-square rounded-full flex-shrink-0 transition-colors shadow-lg shadow-indigo-500/25 active:scale-95"
          title={isPlaying ? "Pause (Space)" : "Play Countdown (Space)"}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <Pause className="w-6 h-6 fill-current" />
          ) : (
            <Play className="w-6 h-6 fill-current ml-1" />
          )}
        </button>

        <button
          onClick={handleNext}
          className="p-3 bg-white/5 hover:bg-white/10 text-white flex-shrink-0 rounded-full transition-colors active:scale-95"
          title="Next Number (Arrow Right)"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        <div className="w-px h-6 bg-white/10 mx-2 hidden sm:block" />

        <button
          onClick={toggleFullscreen}
          className="hidden sm:flex p-3 bg-white/5 hover:bg-white/10 text-white flex-shrink-0 rounded-full transition-colors active:scale-95"
          title="Toggle Fullscreen (F)"
        >
          {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
        </button>

        <button
          onClick={() => { 
            const nextLive = !isLive;
            setIsLive(nextLive); 
            if (nextLive) {
               setStep(0);
               setIsPlaying(false);
            } else {
               setStep(-1);
               setIsPlaying(false);
            }
          }}
          className={`p-3 text-white flex-shrink-0 rounded-full transition-colors active:scale-95 flex items-center gap-2 text-sm font-bold ${isLive ? 'bg-red-500/20 text-red-400 border border-red-500/50' : 'bg-white/5 hover:bg-white/10'}`}
          title="Live I/O 2026 Countdown"
        >
          <CalendarClock className="w-5 h-5" /> 
        </button>
        </div>
        
        {!isLive && (
          <div className="flex items-center gap-3 bg-white/5 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 pointer-events-auto">
            <span className="text-white/50 text-[10px] uppercase font-bold tracking-wider">Pace</span>
            <input 
              type="range" min="800" max="5000" step="200" 
              value={pace} onChange={(e) => setPace(parseInt(e.target.value))}
              className="w-24 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        )}
      </motion.div>

      {!hasStarted && (
        <motion.div 
          className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm pointer-events-none"
          exit={{ opacity: 0 }}
        >
            <motion.div 
              className="bg-[#0b0c10] border border-white/10 p-8 rounded-3xl max-w-sm text-center pointer-events-auto shadow-2xl"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: "spring", bounce: 0.4 }}
            >
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 mx-auto flex items-center justify-center mb-6 shadow-xl shadow-indigo-500/20">
                   <RotateCcw className="w-8 h-8 text-white -rotate-45" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">Galaxy Collapse</h1>
                <p className="text-gray-400 mb-6 text-sm">
                   100,000 star particles orbit a massive gravity well. 
                   <br/><br/>
                   Enabled with WebGL acceleration, Web Audio synthesis, and smooth warping.
                </p>
                <div className="bg-white/5 rounded-lg p-3 text-left text-xs text-gray-400 mb-8 space-y-1">
                   <div className="flex justify-between"><span>Spacebar</span> <span>Play / Pause</span></div>
                   <div className="flex justify-between"><span>Arrows</span> <span>Next / Prev</span></div>
                   <div className="flex justify-between"><span>Key R</span> <span>Reset Galaxy</span></div>
                </div>
                <button
                   onClick={togglePlay}
                   className="w-full py-4 rounded-xl bg-white text-black font-semibold hover:bg-gray-200 transition-colors active:scale-95 shadow-xl shadow-white/10"
                >
                   Enter Simulation
                </button>
            </motion.div>
        </motion.div>
      )}
      
      <div className="absolute top-8 left-8 flex flex-col pointer-events-none z-10 mix-blend-screen">
          <span className="text-white/60 font-mono text-sm uppercase tracking-[0.3em] font-bold">Code The</span>
          <span className="text-white font-sans text-xl font-black tracking-tighter">COUNTDOWN</span>
          
          <motion.div 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: showInteractionTip ? 1 : 0, x: showInteractionTip ? 0 : -10 }}
            className="mt-4 flex items-center gap-2 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-white/10"
          >
            <Info className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-white/80 text-[10px] uppercase tracking-wider font-bold">Tip: Move cursor or touch to disturb the space</span>
          </motion.div>
          {konamiActivated && (
             <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-4 px-3 py-1.5 rounded-lg bg-yellow-500/20 border border-yellow-500/50 text-yellow-300 font-mono text-xs uppercase"
             >
                Maximum Power
             </motion.div>
          )}
      </div>

      {hasStarted && (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 z-30 pointer-events-auto">
          <button 
            onClick={() => setShowHints(!showHints)}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 backdrop-blur-md rounded-full border border-white/10 text-white/60 text-xs transition-all hover:text-white"
          >
            <HelpCircle className="w-4 h-4" />
            <span>{showHints ? 'Hide Hints' : 'Show Hints'}</span>
          </button>
          
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ 
              opacity: showHints ? 1 : 0, 
              y: showHints ? 10 : 0,
              scale: showHints ? 1 : 0.95,
              pointerEvents: showHints ? 'auto' : 'none'
            }}
            className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 bg-[#0b0c10]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl shadow-black"
          >
            <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              Keyboard Shortcuts
            </h3>
            <div className="space-y-2 text-[11px]">
              <div className="flex justify-between items-center text-gray-400">
                <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10 text-white font-mono">Space</kbd>
                <span>Play / Pause</span>
              </div>
              <div className="flex justify-between items-center text-gray-400">
                <div className="flex gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10 text-white font-mono">←</kbd>
                  <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10 text-white font-mono">→</kbd>
                </div>
                <span>Navigate Numbers</span>
              </div>
              <div className="flex justify-between items-center text-gray-400">
                <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10 text-white font-mono">R</kbd>
                <span>Reset Simulation</span>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-white/5">
              <h3 className="text-white font-bold text-sm mb-2 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                Quick Tips
              </h3>
              <p className="text-gray-400 text-[10px] leading-relaxed">
                Interact with the particles using your mouse or touch. Particles will react to your movement and the countdown rhythm.
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
