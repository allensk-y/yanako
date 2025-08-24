'use strict';

const rayCount = 500;
const rayPropCount = 8;
const rayPropsLength = rayCount * rayPropCount;
const baseLength = 200;
const rangeLength = 200;
const baseSpeed = 0.05;
const rangeSpeed = 0.1;
const baseWidth = 10;
const rangeWidth = 20;
const baseHue = 250;   // tím
const rangeHue = 40;   // tím → xanh nước biển
const baseTTL = 50;
const rangeTTL = 100;
const noiseStrength = 100;
const xOff = 0.0015;
const yOff = 0.0015;
const zOff = 0.0015;
const backgroundColor = 'hsla(250,40%,5%,1)'; // tím đậm + chút xanh

let container;
let canvas;
let ctx;
let center;
let tick;
let simplex;
let rayProps;

// Hàm random và round bổ sung
function rand(max){ return Math.random() * max; }
function round(x){ return Math.round(x); }
function fadeInOut(life, ttl){
  return life < ttl/2 ? life/(ttl/2) : 1 - (life - ttl/2)/(ttl/2);
}

function setup() {
  container = document.querySelector('.content--canvas');
	createCanvas();
  resize();
  initRays();
	draw();
}

function initRays() {
  tick = 0;
  simplex = new SimplexNoise();
  rayProps = new Float32Array(rayPropsLength);

  for (let i = 0; i < rayPropsLength; i += rayPropCount) {
    initRay(i);
  }
}

function initRay(i) {
  let length = baseLength + rand(rangeLength);
  let x = rand(canvas.a.width);
  let y1 = center[1] + noiseStrength;
  let y2 = center[1] + noiseStrength - length;
  let n = simplex.noise3D(x * xOff, y1 * yOff, tick * zOff) * noiseStrength;
  y1 += n;
  y2 += n;
  let life = 0;
  let ttl = baseTTL + rand(rangeTTL);
  let width = baseWidth + rand(rangeWidth);
  let speed = baseSpeed + rand(rangeSpeed) * (round(rand(1)) ? 1 : -1);
  let hue = baseHue + rand(rangeHue);

  rayProps.set([x, y1, y2, life, ttl, width, speed, hue], i);
}

function drawRays() {
  for (let i = 0; i < rayPropsLength; i += rayPropCount) {
    updateRay(i);
  }
}

function updateRay(i) {
  let i2 = i+1, i3 = i+2, i4 = i+3, i5 = i+4, i6 = i+5, i7 = i+6, i8 = i+7;
  let x = rayProps[i];
  let y1 = rayProps[i2];
  let y2 = rayProps[i3];
  let life = rayProps[i4];
  let ttl = rayProps[i5];
  let width = rayProps[i6];
  let speed = rayProps[i7];
  let hue = rayProps[i8];

  drawRay(x, y1, y2, life, ttl, width, hue);

  x += speed;
  life++;

  rayProps[i] = x;
  rayProps[i4] = life;

  if (checkBounds(x) || life > ttl) initRay(i);
}

function drawRay(x, y1, y2, life, ttl, width, hue){
  let gradient = ctx.a.createLinearGradient(x, y1, x, y2);
  let sat = 70 + rand(20);   // 70-90%
  let light = 40 + rand(20); // 40-60%
  gradient.addColorStop(0, `hsla(${hue},100%,65%,0)`);
  gradient.addColorStop(0.5, `hsla(${hue},100%,65%,${fadeInOut(life, ttl)})`);
  gradient.addColorStop(1, `hsla(${hue},100%,65%,0)`);

  ctx.a.save();
  ctx.a.beginPath();
  ctx.a.strokeStyle = gradient;
  ctx.a.lineWidth = width;
  ctx.a.moveTo(x, y1);
  ctx.a.lineTo(x, y2);
  ctx.a.stroke();
  ctx.a.closePath();
  ctx.a.restore();
}

function checkBounds(x){
  return x < 0 || x > canvas.a.width;
}

function createCanvas(){
  canvas = {
    a: document.createElement('canvas'),
    b: document.createElement('canvas')
  };
  canvas.a.style = canvas.b.style = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  `;
  container.appendChild(canvas.a);
  container.appendChild(canvas.b);

  ctx = {
    a: canvas.a.getContext('2d'),
    b: canvas.b.getContext('2d')
  };
  center = [0,0];
}

function resize(){
  const { innerWidth, innerHeight } = window;
  canvas.a.width = innerWidth;
  canvas.a.height = innerHeight;
  canvas.b.width = innerWidth;
  canvas.b.height = innerHeight;

  center[0] = innerWidth/2;
  center[1] = innerHeight/2;
}

function render(){
  ctx.b.save();
  ctx.b.filter = 'blur(12px)';
  ctx.a.globalCompositeOperation = 'lighter';
  ctx.b.drawImage(canvas.a, 0, 0);
  ctx.b.restore();
}

function draw(){
  tick++;
  ctx.a.clearRect(0,0,canvas.a.width, canvas.a.height);
  ctx.b.fillStyle = backgroundColor;
  ctx.b.fillRect(0,0,canvas.b.width, canvas.b.height);
  drawRays();
  render();
  window.requestAnimationFrame(draw);
}

window.addEventListener('load', setup);
window.addEventListener('resize', resize);
