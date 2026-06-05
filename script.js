// Simple pool game (single table, multiple balls)
// Controls: Click+drag on canvas to aim and set power; release to shoot.
// Shift for soft shot (reduced power). Space or Next Turn to reset cue when balls stop.

const canvas = document.getElementById('table');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

// Table specs
const pockets = [
  {x:30, y:30}, {x:W/2, y:20}, {x:W-30, y:30},
  {x:30, y:H-30}, {x:W/2, y:H-20}, {x:W-30, y:H-30}
];
const pocketRadius = 26;

// Physics params
let FRICTION = parseFloat(document.getElementById('friction').value);
const delta = 1/60;

// Ball class
class Ball {
  constructor(x,y,r,color,number=0){
    this.x=x; this.y=y; this.r=r; this.color=color; this.number=number;
    this.vx=0; this.vy=0; this.potted=false;
  }
  draw(){
    if(this.potted) return;
    ctx.beginPath(); ctx.fillStyle=this.color; ctx.arc(this.x,this.y,this.r,0,Math.PI*2); ctx.fill();
    ctx.lineWidth=2; ctx.strokeStyle="#111"; ctx.stroke();
    if(this.number!==0){
      ctx.fillStyle=(this.number===8||this.color==='#fff')? '#000':'#fff';
      ctx.font='12px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(this.number,this.x,this.y);
    }
  }
}

// Setup balls — cue is white, others are colored numbers
const balls = [];
function setupBalls(){
  balls.length=0;
  // cue ball
  balls.push(new Ball(240, H/2, 10, '#fff', 0));
  // triangle rack
  const colors = ['#f1c40f','#3498db','#2ecc71','#e74c3c','#9b59b6','#e67e22','#1abc9c','#000'];
  let startX = 680, startY = H/2;
  let num = 1;
  for(let row=0;row<5;row++){
    for(let i=0;i<=row;i++){
      const x = startX + row*22;
      const y = startY - row*10 + i*20;
      const color = (num===8)? '#000' : colors[(num-1)%colors.length];
      balls.push(new Ball(x,y,10,color,num));
      num++;
      if(num>15) break;
    }
    if(num>15) break;
  }
}

setupBalls();

// Game state
let aiming=false, aimStart=null, currentCuePower=0;
let currentPlayer = 1;
let messageEl = document.getElementById('message');
let turnEl = document.getElementById('turn');

// Input
canvas.addEventListener('pointerdown', (e)=>{
  if(anyBallMoving()) return; // only aim when balls are still
  aiming = true; aimStart = getCanvasPos(e);
});
canvas.addEventListener('pointermove', (e)=>{
  if(!aiming) return;
  const p = getCanvasPos(e); currentCuePower = distance(aimStart,p);
});
canvas.addEventListener('pointerup', (e)=>{
  if(!aiming) return;
  const aimEnd = getCanvasPos(e); aiming=false;
  const dir = {x: aimStart.x - aimEnd.x, y: aimStart.y - aimEnd.y};
  let power = Math.min(1, Math.sqrt(dir.x*dir.x+dir.y*dir.y)/140);
  if(e.shiftKey) power *= 0.35; // soft shot when Shift held
  // apply to cue ball (first ball)
  const cue = balls[0];
  const angle = Math.atan2(dir.y,dir.x);
  const speed = power * 18; // tuned
  cue.vx += Math.cos(angle) * speed;
  cue.vy += Math.sin(angle) * speed;
});

function getCanvasPos(e){
  const rect = canvas.getBoundingClientRect();
  return {x: (e.clientX-rect.left)* (canvas.width/rect.width), y: (e.clientY-rect.top)*(canvas.height/rect.height)}
}

// Buttons
document.getElementById('reset').addEventListener('click', ()=>{setupBalls();});
document.getElementById('nextTurn').addEventListener('click', ()=>{ if(!anyBallMoving()) { turnEl.textContent = `Turn: Player ${currentPlayer}`; } });
document.getElementById('friction').addEventListener('input', (e)=>{FRICTION = parseFloat(e.target.value);} );

// Physics utilities
function distance(a,b){ const dx=a.x-b.x, dy=a.y-b.y; return Math.sqrt(dx*dx+dy*dy); }
function anyBallMoving(){ return balls.some(b=>!b.potted && (Math.abs(b.vx)>0.02 || Math.abs(b.vy)>0.02)); }

function step(){
  // move
  for(const b of balls){
    if(b.potted) continue;
    b.x += b.vx;
    b.y += b.vy;
    b.vx *= FRICTION;
    b.vy *= FRICTION;
    if(Math.abs(b.vx)<0.01) b.vx=0;
    if(Math.abs(b.vy)<0.01) b.vy=0;
  }
  // collisions ball-ball
  for(let i=0;i<balls.length;i++){
    const A = balls[i]; if(A.potted) continue;
    for(let j=i+1;j<balls.length;j++){
      const B = balls[j]; if(B.potted) continue;
      const dx = B.x - A.x; const dy = B.y - A.y; const dist = Math.hypot(dx,dy);
      const minD = A.r + B.r;
      if(dist < minD && dist>0){
        // push apart
        const overlap = (minD - dist)/2;
        const nx = dx/dist, ny = dy/dist;
        A.x -= nx*overlap; A.y -= ny*overlap;
        B.x += nx*overlap; B.y += ny*overlap;
        // resolve velocities (elastic collision)
        const dvx = B.vx - A.vx; const dvy = B.vy - A.vy;
        const rel = dvx*nx + dvy*ny;
        if(rel>0) continue;
        const impulse = (-(1.9)*rel)/(1/1 + 1/1);
        const ix = impulse*nx, iy = impulse*ny;
        A.vx -= ix; A.vy -= iy;
        B.vx += ix; B.vy += iy;
      }
    }
  }
  // collisions with cushions
  for(const b of balls){
    if(b.potted) continue;
    if(b.x - b.r < 14){ b.x = 14 + b.r; b.vx = -b.vx * 0.95; }
    if(b.x + b.r > W - 14){ b.x = W-14 - b.r; b.vx = -b.vx * 0.95; }
    if(b.y - b.r < 14){ b.y = 14 + b.r; b.vy = -b.vy * 0.95; }
    if(b.y + b.r > H - 14){ b.y = H-14 - b.r; b.vy = -b.vy * 0.95; }
  }
  // pockets
  for(const b of balls){
    if(b.potted) continue;
    for(const p of pockets){
      if(Math.hypot(b.x-p.x, b.y-p.y) < pocketRadius){ b.potted = true; b.vx = b.vy = 0; }
    }
  }
}

function drawTable(){
  // table background drawn by CSS; draw rails as dark
  // pockets
  for(const p of pockets){
    ctx.beginPath(); ctx.fillStyle = '#111'; ctx.arc(p.x,p.y,pocketRadius,0,Math.PI*2); ctx.fill();
  }
}

function draw(){
  ctx.clearRect(0,0,W,H);
  drawTable();
  for(const b of balls) b.draw();
  // aim line
  if(aiming && !anyBallMoving()){
    ctx.save(); ctx.strokeStyle='rgba(255,255,255,0.8)'; ctx.lineWidth=2; ctx.setLineDash([8,6]);
    ctx.beginPath(); ctx.moveTo(aimStart.x, aimStart.y);
    const mouse = {x: aimStart.x - Math.cos(0)*0, y: aimStart.y - Math.sin(0)*0};
    // draw towards current pointer by using last known currentCuePower
    const angle = Math.atan2(0, -1);
    // actually draw to pointer position
    // cheat: show line from cue ball center to aim cursor (we tracked currentCuePower only)
    ctx.lineTo(aimStart.x - (currentCuePower*2)*( (eventPointer && eventPointer.x) ? (aimStart.x-eventPointer.x)/Math.max(1,currentCuePower) : 0 ),
                aimStart.y - (currentCuePower*2)*( (eventPointer && eventPointer.y) ? (aimStart.y-eventPointer.y)/Math.max(1,currentCuePower) : 0 ));
    ctx.stroke(); ctx.restore();
  }
}

// track last pointer for drawing aim
let eventPointer = null;
canvas.addEventListener('pointermove', (e)=>{ eventPointer = getCanvasPos(e); });
canvas.addEventListener('pointerout', ()=>{ eventPointer = null; });

// main loop
function loop(){ step(); draw(); updateUI(); requestAnimationFrame(loop); }
requestAnimationFrame(loop);

function updateUI(){
  const potted = balls.filter(b=>b.potted && b.number===0).length;
  turnEl.textContent = `Turn: Player ${currentPlayer}`;
  if(anyBallMoving()) messageEl.textContent = 'Balls moving...';
  else messageEl.textContent = 'Click & drag to aim; release to shoot. Hold Shift for a soft shot.';
}

// expose simple API for debugging
window._balls = balls;
