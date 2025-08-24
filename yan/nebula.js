// nebula.js — Rebuilt CUTE nebula (2D, shader + sprite icons + bloom + shooting stars)
// Exports: initNebula(canvasId='nebula'), resizeNebula(), renderNebula(tSeconds=0)

import * as THREE from 'https://unpkg.com/three@0.152.2/build/three.module.js';
import { EffectComposer } from 'https://unpkg.com/three@0.152.2/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://unpkg.com/three@0.152.2/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://unpkg.com/three@0.152.2/examples/jsm/postprocessing/UnrealBloomPass.js';

// ---------- module state ----------
let renderer, scene, camera, composer;
let quad, nebulaMaterial, nebulaUniforms;
let spriteList = [], spriteMeta = [];
let glowTex = null, plusTex = null, starIconTex = null, heartTex = null;
let gsapRef = null;
let shootingPool = [];
let W = 0, H = 0;

// ---------- config ----------
const CUTE_SPRITES = 28;
const SHOOT_MIN_MS = 7000;
const SHOOT_MAX_MS = 12000;
const PASTEL_HSLS = [
  [0.92, 0.60, 0.82],
  [0.80, 0.55, 0.78],
  [0.62, 0.55, 0.78],
  [0.15, 0.60, 0.78],
  [0.46, 0.60, 0.78]
];

const rand = (a,b) => a + Math.random()*(b-a);
const irand = (a,b) => Math.floor(rand(a,b+1));
const choice = arr => arr[irand(0, arr.length-1)];
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));

// ---------- helpers ----------
function pxToNDC(xPx, yPx, width, height){
  const x = (xPx / width) * 2 - 1;
  const y = 1 - (yPx / height) * 2;
  return new THREE.Vector3(x, y, 0);
}
function pxToScale(px, width, height){
  return new THREE.Vector3(px / (width * 0.5), px / (height * 0.5), 1);
}

// canvas textures: glow / plus / star icon (FontAwesome attempt) / heart
function makeGlowTexture(size=128){
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  const cx = size/2, cy = size/2, r = size/2;
  const grad = g.createRadialGradient(cx,cy,0,cx,cy,r);
  grad.addColorStop(0,'rgba(255,255,255,1)');
  grad.addColorStop(0.35,'rgba(255,255,255,0.85)');
  grad.addColorStop(0.75,'rgba(255,255,255,0.22)');
  grad.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0,0,size,size);
  const tex = new THREE.CanvasTexture(c); tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps=false;
  return tex;
}

function makePlusTexture(size=128){
  const c=document.createElement('canvas'); c.width=c.height=size; const g=c.getContext('2d');
  g.translate(size/2, size/2);
  g.lineWidth = Math.max(3, size*0.04); g.lineCap='round';
  g.strokeStyle = 'rgba(255,255,255,0.95)';
  const arm = size*0.16;
  g.beginPath(); g.moveTo(0,-arm*1.2); g.lineTo(0,arm*1.2); g.stroke();
  g.beginPath(); g.moveTo(-arm*1.2,0); g.lineTo(arm*1.2,0); g.stroke();
  // soft diagonals
  g.globalAlpha = 0.55; g.lineWidth = Math.max(2, size*0.02);
  g.beginPath(); g.moveTo(-arm*0.8,-arm*0.8); g.lineTo(arm*0.8,arm*0.8); g.stroke();
  g.beginPath(); g.moveTo(arm*0.8,-arm*0.8); g.lineTo(-arm*0.8,arm*0.8); g.stroke();
  const tex = new THREE.CanvasTexture(c); tex.minFilter=THREE.LinearFilter; tex.magFilter=THREE.LinearFilter; tex.generateMipmaps=false;
  return tex;
}

// try to draw FontAwesome star glyph (\uf005). If font not available, fallback to drawn star shape.
function makeStarIconTexture(size=128){
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
  g.clearRect(0,0,size,size);
  const center = size/2;
  // try FA glyph
  const faChar = '\uf005'; // usual FontAwesome star
  // prefer FA6 solid (weight 900)
  const faFont = '900 ' + Math.floor(size*0.7) + 'px "Font Awesome 6 Free", "Font Awesome 5 Free"';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = 'white';
  g.shadowBlur = Math.floor(size*0.12); g.shadowColor = 'rgba(255,255,255,0.95)';
  try{
    g.font = faFont;
    g.fillText(faChar, center, center);
    // quick pixel-check: if drawn is empty, fallback
    const data = g.getImageData(center, center, 1, 1).data;
    if(data[3] < 8){ throw new Error('FA not drawn'); }
  }catch(e){
    // fallback: draw star polygon
    g.clearRect(0,0,size,size);
    g.translate(center, center);
    g.fillStyle = 'white';
    const R = size*0.32, r = R*0.45, P = 5;
    g.beginPath();
    for(let i=0;i<P*2;i++){
      const ang = (i*Math.PI)/P;
      const rad = (i%2===0)?R:r;
      g.lineTo(Math.cos(ang)*rad, Math.sin(ang)*rad);
    }
    g.closePath();
    g.shadowBlur = 14; g.shadowColor='rgba(255,255,255,0.95)';
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c); tex.minFilter=THREE.LinearFilter; tex.magFilter=THREE.LinearFilter; tex.generateMipmaps=false;
  return tex;
}

function makeHeartTexture(size=128){
  const c=document.createElement('canvas'); c.width=c.height=size; const g=c.getContext('2d');
  g.translate(size/2, size*0.56);
  g.fillStyle = 'white'; g.beginPath();
  for(let t=-Math.PI; t<=Math.PI; t+=0.02){
    const x = 16*Math.sin(t)**3;
    const y = -(13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t));
    g.lineTo(x*size*0.012, y*size*0.012);
  }
  g.closePath(); g.shadowBlur = 12; g.shadowColor='rgba(255,255,255,0.95)'; g.fill();
  const tex = new THREE.CanvasTexture(c); tex.minFilter=THREE.LinearFilter; tex.magFilter=THREE.LinearFilter; tex.generateMipmaps=false;
  return tex;
}

// ---------- shader (vertex: use position injected by three; frag: nebula + star layers) ----------
const vert = `
precision highp float;
varying vec2 vUv;
void main(){
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position, 1.0);
}
`;

const frag = `
precision highp float;
varying vec2 vUv;
uniform vec2 u_resolution;
uniform float u_time;
uniform vec3 u_colorA;
uniform vec3 u_colorB;
uniform vec3 u_colorC;

float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7))) * 43758.5453123); }
float noise(vec2 p){
  vec2 i=floor(p), f=fract(p);
  vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(hash(i+vec2(0.0,0.0)), hash(i+vec2(1.0,0.0)), u.x),
             mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), u.x),
             u.y);
}
float fbm(vec2 p){
  float v=0.0, a=0.5;
  for(int i=0;i<6;i++){ v += a * noise(p); p *= 2.0; a *= 0.5; }
  return v;
}
vec3 palette(float t, vec3 a, vec3 b, vec3 c){
  return mix(a,b,smoothstep(0.0,1.0,t))*(0.25+0.25*t) + c*(0.1*(1.0-t));
}

float starLayer(vec2 uv, float scale, float thresh, float drift, float twspd){
  vec2 p = uv * scale + vec2(drift*0.001, -drift*0.0015);
  float n = noise(p);
  float base = smoothstep(thresh, 1.0, n);
  float ph = noise(p*11.0) * 6.28318;
  float tw = 0.5 + 0.5 * sin(u_time*twspd + ph);
  return base * tw;
}

void main(){
  vec2 uv = vUv;
  vec2 p = (uv - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0);
  float t = u_time * 0.10;

  float ang = 0.07 * sin(t*0.22);
  mat2 rot = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));

  float n1 = fbm(rot * (p*0.95 + vec2(t*0.22, -t*0.09)));
  float n2 = fbm(rot * (p*1.6 + vec2(-t*0.18, t*0.28)));
  float neb = mix(n1, n2, 0.55);
  float big = fbm(p * 0.34 + vec2(-t*0.04, t*0.02));
  neb = neb*0.82 + big*0.18;
  neb = pow(smoothstep(0.06, 0.86, neb), 1.05);

  float dist = length(uv - 0.5);
  float vign = smoothstep(0.8, 0.4, dist);
  neb *= mix(1.0, 0.22, dist*1.05);

  vec3 col = palette(neb, u_colorA, u_colorB, u_colorC);

  float s=0.0;
  s += starLayer(uv, 160.0, 0.986, t*40.0, 2.0);
  s += starLayer(uv, 300.0, 0.990, -t*28.0, 3.1);
  s += starLayer(uv, 420.0, 0.993, t*17.0, 4.2);
  s = clamp(s, 0.0, 1.5);

  col += vec3(1.0) * s * 1.05;
  col = pow(col, vec3(0.92));
  col *= vign * 0.35;   // 0.35 = độ tối tổng thể
  gl_FragColor = vec4(col * vign, 1.0);

}
`;

// ---------- sprites creation ----------
function createCuteSprites(count = CUTE_SPRITES){
  // cleanup
  spriteList.forEach(s => scene.remove(s));
  spriteList.length = 0; spriteMeta.length = 0;

  const width = W, height = H;
  for(let i=0;i<count;i++){
    const type = choice(['plus','star','heart']);
    let tex = (type==='plus') ? plusTex : (type==='star') ? starIconTex : heartTex;
    // material
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: rand(0.45, 0.95)
    });
    const spr = new THREE.Sprite(mat);

    const nx = Math.random(), ny = Math.random()*0.86 + 0.03;
    const sizePx = rand(14, 36) * (type==='heart' ? 1.2 : 1.0);
    const hs = choice(PASTEL_HSLS);
    const color = new THREE.Color().setHSL(hs[0], hs[1], hs[2]);
    mat.color = color;

    const pos = pxToNDC(nx*width, ny*height, width, height);
    const scl = pxToScale(sizePx, width, height);
    spr.position.copy(pos);
    spr.scale.copy(scl);

    // rotation stored on material (sprite.rotation is read-only)
    mat.rotation = rand(-0.6, 0.6);

    scene.add(spr);
    spriteList.push(spr);
    spriteMeta.push({ nx, ny, sizePx, phase: Math.random()*Math.PI*2, type });
  }

  // GSAP pulses if available
  if(gsapRef){
    spriteList.forEach((s, idx) => {
      const base = s.scale.clone();
      gsapRef.to(s.scale, { x: base.x * rand(1.08,1.32), y: base.y * rand(1.08,1.32), duration: rand(1.4,2.4), yoyo:true, repeat:-1, ease:'sine.inOut', delay: idx*0.06 });
      gsapRef.to(s.material, { opacity: clamp(s.material.opacity * rand(0.7,1.2), 0.35, 1.0), duration: rand(1.2,2.2), yoyo:true, repeat:-1, ease:'sine.inOut', delay: idx*0.09 });
    });
  }
}

// ---------- shooting star ----------
function spawnShooting(){
  const width = W, height = H;
  const mat = new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthTest:false, depthWrite:false, blending:THREE.AdditiveBlending, opacity:0 });
  const spr = new THREE.Sprite(mat);
  const startY = rand(height*0.05, height*0.32);
  const sx = -width*0.12, ex = width*1.12;
  const sy = startY, ey = startY + rand(height*0.20, height*0.45);
  spr.position.copy(pxToNDC(sx, sy, width, height));
  spr.scale.copy(pxToScale(rand(18,42), width, height));
  scene.add(spr);
  const startTime = performance.now();
  const duration = rand(1100, 1600);
  shootingPool.push({ spr, sx, sy, ex, ey, startTime, duration });
}
let lastShot = 0;
function maybeSpawn(now){
  if(now - lastShot > rand(SHOOT_MIN_MS, SHOOT_MAX_MS)){
    spawnShooting();
    lastShot = now;
  }
}

// ---------- public API ----------
export function initNebula(canvasId = 'nebula'){
  const canvas = document.getElementById(canvasId);
  if(!canvas){ console.error('nebula canvas not found'); return; }

  W = window.innerWidth; H = window.innerHeight;
  renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:false, powerPreference:'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 2));
  renderer.setSize(W, H);
  renderer.setClearColor(0x050519, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera(-1,1,1,-1,0,1);

  const geometry = new THREE.PlaneGeometry(2,2);
  nebulaUniforms = {
    u_time: { value: 0.0 },
    u_resolution: { value: new THREE.Vector2(W, H) },
    u_colorA: { value: new THREE.Color(0.14, 0.04, 0.28) },
    u_colorB: { value: new THREE.Color(0.18, 0.42, 0.84) },
    u_colorC: { value: new THREE.Color(0.90, 0.45, 0.78) }
  };
  nebulaMaterial = new THREE.ShaderMaterial({ uniforms: nebulaUniforms, vertexShader: vert, fragmentShader: frag });
  quad = new THREE.Mesh(geometry, nebulaMaterial); scene.add(quad);

  composer = new EffectComposer(renderer);
  composer.setSize(W, H);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.3, 0.6, 0.1);
  bloom.threshold = 0.35;
  bloom.strength = 0.45;
  bloom.radius = 0.5;

  composer.addPass(bloom);

  // textures
  glowTex = makeGlowTexture(128);
  plusTex = makePlusTexture(128);
  starIconTex = makeStarIconTexture(128);
  heartTex = makeHeartTexture(128);
  gsapRef = (typeof window !== 'undefined') ? (window.gsap || null) : null;

  createCuteSprites(CUTE_SPRITES);

  window.addEventListener('resize', () => resizeNebula(), { passive:true });
}

export function resizeNebula(){
  if(!renderer) return;
  W = window.innerWidth; H = window.innerHeight;
  renderer.setSize(W, H); composer.setSize(W, H);
  nebulaUniforms.u_resolution.value.set(W, H);
  spriteList.forEach((s, i) => {
    const m = spriteMeta[i] || {};
    const posN = pxToNDC((m.nx||0)*W, (m.ny||0)*H, W, H);
    const scl = pxToScale(m.sizePx || 18, W, H);
    s.position.copy(posN); s.scale.copy(scl);
  });
}

export function renderNebula(tSeconds = 0){
  if(!composer || !nebulaUniforms) return;
  nebulaUniforms.u_time.value = tSeconds;

  // update sprites fallback if no GSAP
  if(!gsapRef){
    for(let i=0;i<spriteList.length;i++){
      const s=spriteList[i], meta = spriteMeta[i];
      const tw = 0.8 + 0.25*Math.sin(tSeconds*1.6 + (meta && meta.phase || 0));
      // assume original scale base from sizePx
      const base = pxToScale((meta && meta.sizePx) || 18, W, H);
      s.scale.x = base.x * (0.9 + 0.2 * tw);
      s.scale.y = base.y * (0.9 + 0.2 * tw);
      s.material.opacity = clamp(0.35 + 0.65*tw, 0.2, 1.0);
      s.material.rotation = 0.02 * Math.sin(tSeconds*1.2 + (meta && meta.phase || 0));
    }
  } else {
    // also add subtle rotation even with GSAP
    for(let i=0;i<spriteList.length;i++){
      const s = spriteList[i], meta = spriteMeta[i];
      s.material.rotation = 0.02 * Math.sin(tSeconds*1.1 + (meta && meta.phase || 0));
    }
  }

  // update shooting pool
  const now = performance.now();
  for(let i=shootingPool.length-1;i>=0;i--){
    const o = shootingPool[i];
    const elapsed = now - o.startTime;
    const t = elapsed / o.duration;
    if(t >= 1){
      scene.remove(o.spr);
      shootingPool.splice(i, 1);
      continue;
    }
    const x = o.sx + (o.ex - o.sx) * t;
    const y = o.sy + (o.ey - o.sy) * t;
    o.spr.position.copy(pxToNDC(x, y, W, H));
    o.spr.material.opacity = 0.9 * (1 - t);
  }

  maybeSpawn(now);

  composer.render();
}
