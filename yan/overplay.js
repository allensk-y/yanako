// overlay.js
// Exports: initOverlay(), resizeOverlay(), update(dtSeconds), render(), initInputs()
/* ================== CONFIG (giữ nguyên từ bản gốc) ================== */
const TARGET_WORD      = ['U','N','I','V','E','R'];
const LETTER_INTERVAL  = 2200;
const BG_METEOR_MAX    = 8;
const FPS_CAP          = 60;

const STAR_COUNT       = 480;
const STAR_LAYERS      = [0.55, 0.8, 1.0];
const SKY_TOP          = 'rgba(6,8,16,1)';
const SKY_BOTTOM       = 'rgba(2,3,10,1)';

const CONSTELLATION_COUNT  = 3;
const CONSTELLATION_POINTS = [5,7];

const HUE_RANGE        = [210, 315];
const METEOR_SPEED     = [5.2, 9.5];
const METEOR_LEN       = [120, 220];
const TRAIL_THICKNESS  = 2.4;
const SPARK_RATE       = 6;
const SPARK_TTL        = [18, 36];
const SPARK_SIZE       = [0.8, 1.8];

const BASE_ANGLE       = Math.PI * 0.22;
const ANGLE_JITTER     = Math.PI * 0.02;
const GROW_STEPS       = 22;
const GROW_EASE        = t => t<0 ? 0 : t>1 ? 1 : (1 - Math.cos(Math.PI * t)) * 0.5;
const HEAD_CROSS_PROB  = 0.25;
const HEAD_CROSS_SIZE  = [6, 12];
const HEAD_CROSS_T     = [6, 12];
const LETTER_SPEED     = [4.8, 6.2];

/* ================== STATE ================== */
let W = 0, H = 0, DPR = 1;
let fx = null, ctx = null;

let stars = [];
let constellations = [];
let bgMeteors = [];
let letterMeteors = [];
let sparks = [];

let letterQueueIndex = 0;
let letterTimer = 0;

/* ============== UTILS ============== */
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const rand  = (min,max)=>min+Math.random()*(max-min);
const irand = (min,max)=>Math.floor(rand(min,max+1));
const choice = a=>a[irand(0,a.length-1)];
const now  = ()=>performance.now();
function $(s){ return document.querySelector(s); }

/* ============== CANVAS SETUP ============== */
export function initOverlay(canvasId = 'fx') {
  fx = document.getElementById(canvasId);
  if (!fx) { console.error('#' + canvasId + ' not found'); return; }
  DPR = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
  ctx = fx.getContext('2d');
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  resizeOverlay();
  initStars();
  initConstellations();
}

export function resizeOverlay() {
  W = Math.floor(window.innerWidth);
  H = Math.floor(window.innerHeight);
  if (!fx) return;
  fx.width = Math.floor(W * DPR);
  fx.height = Math.floor(H * DPR);
  fx.style.width = W + 'px';
  fx.style.height = H + 'px';
}

/* ================== SKY / STARS (draw on fx) ================== */
function initStars(){
  stars.length = 0;
  for(let i=0;i<STAR_COUNT;i++){
    const depth = choice(STAR_LAYERS);
    stars.push({
      x: Math.random()*W,
      y: Math.random()*H*rand(0.45,0.9),
      r: rand(0.4,1.8)*(1+(1-depth)*0.5),
      baseAlpha: rand(0.5,1),
      depth,
      w: rand(0.7,2.1),
      phase: Math.random()*Math.PI*2
    });
  }
}
function drawSky(){
  // assume transform already set to DPR scale by caller
  const grad = ctx.createLinearGradient(0,0,0,H);
  grad.addColorStop(0, SKY_TOP); grad.addColorStop(1, SKY_BOTTOM);
  ctx.fillStyle = grad; ctx.fillRect(0,0,W,H);

  ctx.globalCompositeOperation='lighter';
  for(const s of stars){
    const a = clamp(s.baseAlpha*(0.65+0.35*Math.sin(now()*0.001*s.w+s.phase)), 0.15, 1);
    ctx.globalAlpha = a;
    ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2);
    ctx.fillStyle='rgba(255,255,255,0.95)'; ctx.fill();
    ctx.globalAlpha = a*0.28;
    ctx.beginPath(); ctx.arc(s.x,s.y,s.r*2.6,0,Math.PI*2);
    ctx.fillStyle='rgba(170,200,255,0.22)'; ctx.fill();
  }
  ctx.globalAlpha=1; ctx.globalCompositeOperation='source-over';
}

/* ============== CONSTELLATIONS ============== */
function initConstellations(){
  constellations.length=0;
  for(let c=0;c<CONSTELLATION_COUNT;c++){
    const n=irand(CONSTELLATION_POINTS[0], CONSTELLATION_POINTS[1]);
    const pts=[];
    for(let i=0;i<n;i++){ pts.push({x:rand(W*0.06,W*0.94), y:rand(H*0.07,H*0.42)}); }
    pts.sort((a,b)=>a.x-b.x);
    constellations.push({pts, alpha:rand(0.12,0.22)});
  }
}
function drawConstellations(){
  ctx.save(); ctx.globalCompositeOperation='lighter';
  for(const c of constellations){
    ctx.globalAlpha=c.alpha;
    for(const p of c.pts){
      ctx.beginPath(); ctx.arc(p.x,p.y,1.4,0,Math.PI*2);
      ctx.fillStyle='rgba(230,240,255,0.9)'; ctx.fill();
    }
    ctx.lineWidth=0.8; ctx.strokeStyle='rgba(160,200,255,0.35)';
    ctx.beginPath();
    c.pts.forEach((p,i)=> i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y));
    ctx.stroke();
  }
  ctx.restore();
}

/* ================== METEORS / SPARKS ================== */
function randomHue(){ return rand(HUE_RANGE[0], HUE_RANGE[1]); }
function parallelAngle(){ return BASE_ANGLE + rand(-ANGLE_JITTER, ANGLE_JITTER); }
function maybeMakeHeadCross(){
  if(Math.random() > HEAD_CROSS_PROB) return null;
  return { life: irand(HEAD_CROSS_T[0], HEAD_CROSS_T[1]), age:0, size: rand(HEAD_CROSS_SIZE[0], HEAD_CROSS_SIZE[1]) };
}

function spawnBgMeteor(){
  const angle = parallelAngle();
  const speed = rand(METEOR_SPEED[0], METEOR_SPEED[1]);
  const targetLen = rand(METEOR_LEN[0], METEOR_LEN[1]);

  bgMeteors.push({
    x: rand(-W*0.2, W*0.6),
    y: rand(-H*0.1, H*0.5),
    vx: Math.cos(angle)*speed,
    vy: Math.sin(angle)*speed,
    targetLen,
    growT: 0,
    hue: randomHue(),
    life:0,
    history:[],
    headCross: maybeMakeHeadCross()
  });
  if(bgMeteors.length>BG_METEOR_MAX) bgMeteors.shift();
}

function spawnLetterMeteor(ch){
  const angle = parallelAngle();
  const speed = rand(LETTER_SPEED[0], LETTER_SPEED[1]);
  const targetLen = rand(140, 220);
  const startX = rand(-W*0.15, W*0.2);
  const startY = rand(H*0.05, H*0.30);

  letterMeteors.push({
    x:startX, y:startY,
    vx:Math.cos(angle)*speed,
    vy:Math.sin(angle)*speed,
    targetLen,
    growT:0, hue: randomHue(), life:0, ch,
    history:[], headCross: maybeMakeHeadCross()
  });
}

function updMeteor(m){
  m.life++;
  m.x+=m.vx; m.y+=m.vy;
  if(m.growT < GROW_STEPS) m.growT++;
  m.history.push({x:m.x,y:m.y});
  if(m.history.length>8) m.history.shift();

  // sparks
  for(let i=0;i<SPARK_RATE;i++){
    const ang = Math.atan2(m.vy,m.vx) + rand(Math.PI-0.35, Math.PI+0.35);
    const spd = rand(0.5,2.2);
    sparks.push({
      x:m.x - Math.cos(ang)*rand(2,6),
      y:m.y - Math.sin(ang)*rand(2,6),
      vx:Math.cos(ang)*spd, vy:Math.sin(ang)*spd + rand(0.02,0.06),
      size:rand(SPARK_SIZE[0],SPARK_SIZE[1]),
      ttl:irand(SPARK_TTL[0],SPARK_TTL[1]),
      age:0, hue:m.hue
    });
  }

  if(m.headCross){
    m.headCross.age++;
    if(m.headCross.age >= m.headCross.life) m.headCross = null;
  }

  // simple kill: if far outside viewport -> dead
  if(m.x - m.targetLen > W + 80 || m.y - m.targetLen > H + 80 || m.x < -W*0.6 || m.y < -H*0.6){
    m.dead = true;
  }
}

function drawHeadCross(m){
  if(!m.headCross) return;
  const t = 1 - (m.headCross.age / m.headCross.life);
  const s = m.headCross.size * (0.7 + 0.3 * t);
  ctx.save();
  ctx.globalCompositeOperation='lighter';
  ctx.globalAlpha = 0.6 * t;
  ctx.lineWidth = 1;
  ctx.strokeStyle = `hsla(${m.hue},95%,70%,0.9)`;
  ctx.beginPath();
  ctx.moveTo(m.x, m.y - s); ctx.lineTo(m.x, m.y + s); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(m.x - s, m.y); ctx.lineTo(m.x + s, m.y); ctx.stroke();
  ctx.restore();
}

function drawMeteor(m, showLetter=false){
  const angle = Math.atan2(m.vy,m.vx);
  const growRatio = GROW_EASE(m.growT / GROW_STEPS);
  const curLen = m.targetLen * growRatio;
  const tx = m.x - Math.cos(angle)*curLen;
  const ty = m.y - Math.sin(angle)*curLen;

  const grad = ctx.createLinearGradient(tx,ty,m.x,m.y);
  grad.addColorStop(0.00, `hsla(${m.hue},95%,70%,0)`);
  grad.addColorStop(0.35, `hsla(${m.hue},95%,70%,0.35)`);
  grad.addColorStop(0.75, `hsla(${m.hue},95%,70%,0.85)`);
  grad.addColorStop(1.00, `hsla(${m.hue},95%,70%,1)`);

  ctx.save();
  ctx.globalCompositeOperation='lighter';
  ctx.lineWidth=TRAIL_THICKNESS;
  ctx.strokeStyle=grad;
  ctx.beginPath(); ctx.moveTo(tx,ty); ctx.lineTo(m.x,m.y); ctx.stroke();

  ctx.globalAlpha=0.35; ctx.lineWidth=1.1;
  ctx.strokeStyle=`hsla(${m.hue},95%,70%,0.55)`;
  ctx.beginPath();
  m.history.forEach((p,i)=> i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y));
  ctx.stroke();
  ctx.globalAlpha=1;

  drawHeadCross(m);

  if(showLetter){
    ctx.font='700 24px Poppins, system-ui';
    ctx.fillStyle=`hsla(${m.hue},95%,92%,1)`;
    ctx.shadowBlur=18; ctx.shadowColor=`hsla(${m.hue},95%,70%,1)`;
    ctx.fillText(m.ch, m.x-8, m.y+8);
    // reset shadow
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
  }
  ctx.restore();
}

/* ================== SPARKS ================== */
function updSpark(p){
  p.age++; p.x+=p.vx; p.y+=p.vy; p.vy+=0.01;
  return p.age < p.ttl;
}
function drawSpark(p){
  const t = p.age / p.ttl, a = 1 - t;
  ctx.globalCompositeOperation='lighter';
  ctx.globalAlpha = a;
  ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,Math.PI*2);
  ctx.fillStyle = `hsla(${p.hue},95%,70%,0.85)`; ctx.fill();
  ctx.globalAlpha = 1;
}

/* ================== LOGIC + RENDER (called from main) ================== */
export function update(dt){
  // BG meteors
  if(bgMeteors.length < BG_METEOR_MAX) spawnBgMeteor();
  for(let i=bgMeteors.length-1;i>=0;i--){
    const m=bgMeteors[i]; updMeteor(m);
    if(m.dead) bgMeteors.splice(i,1);
  }

  // Letter scheduler
  letterTimer += dt*1000;
  if(letterQueueIndex < TARGET_WORD.length && letterTimer >= LETTER_INTERVAL){
    spawnLetterMeteor(TARGET_WORD[letterQueueIndex]);
    letterQueueIndex++;
    letterTimer = 0;
  }

  // Update letter meteors
  for(let i=letterMeteors.length-1;i>=0;i--){
    const m=letterMeteors[i]; updMeteor(m);
    if(m.dead) letterMeteors.splice(i,1);
  }

  // Sparks
  for(let i=sparks.length-1;i>=0;i--){
    if(!updSpark(sparks[i])) sparks.splice(i,1);
  }
}

export function render(){
  if(!ctx) return;
  // clear device pixels first
  ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,fx.width,fx.height);
  ctx.globalCompositeOperation = "lighter"; 

  // set to CSS pixel coordinate space (scaled)
  ctx.setTransform(DPR,0,0,DPR,0,0);

  // BG + constellations
  drawConstellations();

  // Draw sparks then meteors
  for(const p of sparks) drawSpark(p);
  for(const m of bgMeteors) drawMeteor(m,false);
  for(const m of letterMeteors) drawMeteor(m,true);
}

/* ================== UI / INPUTS (copied & slightly protected) ================== */
export function initInputs(){
  const inputs = Array.from(document.querySelectorAll('.dock__inputs input'));
  const progressEl = document.getElementById('progress');
  if(!progressEl || !inputs.length) return;
  let cur = 0;

  function updateProgress(){
    progressEl.textContent = `${cur} / ${TARGET_WORD.length}`;
  }
  function checkWin(){
    const typed = inputs.map(i=>i.value.toUpperCase()).join('');
    const target = TARGET_WORD.join('');
    if(typed === target){
      const end = Date.now() + 1000;
      (function frameConfetti(){
        if(window.confetti){
          confetti({
            particleCount: 60,
            spread: 70,
            startVelocity: 35,
            scalar: 1.0,
            origin: { y: 0.6 }
          });
        }
        if(Date.now() < end) requestAnimationFrame(frameConfetti);
      })();
      const modal = $('#winModal');
      if(modal){
        modal.hidden = false;
        if(window.gsap){
          gsap.fromTo('.modal__card', { y: 30, opacity: 0 }, { y:0, opacity:1, duration:.5, ease:'power3.out' });
        }
      }
    }
  }

  inputs.forEach((inp, idx)=>{
    inp.addEventListener('input', ()=>{
      const v = (inp.value[0] || '').toUpperCase();
      inp.value = v;
      const should = TARGET_WORD[idx];
      inp.classList.remove('wrong','correct');
      if(!v) return;
      if(v === should){
        inp.classList.add('correct');
        cur = Math.max(cur, idx+1);
        updateProgress();
        if(idx+1 < inputs.length) inputs[idx+1].focus();
        checkWin();
      } else {
        inp.classList.add('wrong');
      }
    });
    inp.addEventListener('keydown', (e)=>{
      if(e.key==='Backspace' && !inp.value && idx>0){
        inputs[idx-1].focus();
      }
    });
  });

  const playAgain = $('#playAgain');
  if(playAgain){
    playAgain.addEventListener('click', ()=>{
      inputs.forEach(i=>{ i.value=''; i.classList.remove('wrong','correct'); });
      cur=0; updateProgress();
      const modal = $('#winModal'); if(modal) modal.hidden = true;
      letterMeteors.length=0; letterQueueIndex=0; letterTimer=0;
      sparks.length=0; bgMeteors.length=0;
      if(window.gsap){
        gsap.from('.dock__inputs input', { scale: .9, opacity: 0, stagger: .04, duration: .4, ease: 'back.out(1.6)' });
      }
    });
  }

  // === Nút Qua Màn ===
  const nextLevel = $('#nextLevel');
  if (nextLevel) {
    nextLevel.addEventListener('click', () => {
      window.location.href = "../final/final.html"; // sang trang final
    });
  }

  if(inputs[0]) inputs[0].focus();
  updateProgress();
}
