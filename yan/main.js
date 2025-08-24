// main.js
import { initNebula, resizeNebula, renderNebula } from './nebula.js';
import { initOverlay, resizeOverlay, update, render, initInputs } from './overplay.js';

let lastTime = 0, acc = 0;
const FPS_CAP = 60;
const STEP = 1000 / FPS_CAP;

function boot(){
  initNebula('nebula');
  initOverlay('fx');
  initInputs();

  window.addEventListener('resize', ()=>{
    resizeNebula();
    resizeOverlay();
  }, { passive: true });

  requestAnimationFrame(animate);
}

function animate(ts){
  if(!lastTime) lastTime = ts;
  const dt = ts - lastTime;
  lastTime = ts;

  acc += dt;
  let updated = false;
  while(acc >= STEP){
    update(STEP / 1000); // physics update in seconds
    acc -= STEP; updated = true;
  }

  // draw overlay only when updated is true (simple optimization)
  if(updated) render();

  // nebula can render every frame for smooth shader animation
  renderNebula(ts * 0.001);

  requestAnimationFrame(animate);
}

window.addEventListener('DOMContentLoaded', boot);
