"use strict";
/* game.js
   Everything you SEE and TOUCH: drawing, controls, sounds, the lesson screen.
   It uses the algorithms from maze-logic.js (generate, bfs, bfsTrace, perfectRun...).
*/
const $ = id => document.getElementById(id);
const T = 16;           // game tile size (low-res pixels)
const VT = 8;           // visualizer tile size
const API_URL = "https://script.google.com/macros/s/AKfycbxdgLOZ57k1K6a0XWYmE1rRgd1Q7_kUMFREkSHYTNYKWivCX7oJzJ_FBXDea1ydNZivvg/exec";
const QUIZ_URL = "https://script.google.com/macros/s/AKfycbx3yaIg2hgGs5EEY2cjRlnEo9AuejznGtv4KBa3bneNVhcNSAozcR4cESwnYXgWgS7j/exec";
const DIFF = {
  cozy:      {name:'Cozy',      cols:19, rows:13, candy:4, ghost:0,   dark:.35, radius:6, loops:0},
  spooky:    {name:'Spooky',    cols:25, rows:17, candy:5, ghost:480, dark:.62, radius:5, loops:10},
  nightmare: {name:'Nightmare', cols:31, rows:19, candy:6, ghost:330, dark:.85, radius:4, loops:14}
};
 
 
/* ---------- ambience ---------- */
(function ambience(){
  const c = $('moon'), x = c.getContext('2d');
  for (let j = 0; j < 24; j++) for (let i = 0; i < 24; i++){
    const d = Math.hypot(i - 11.5, j - 11.5);
    if (d <= 10){ x.fillStyle = d > 8.6 ? '#8f1220' : '#e0303c'; x.fillRect(i, j, 1, 1); }
  }
  x.fillStyle = '#7a0e1a';
  [[8,8,3,2],[14,12,2,2],[9,15,2,1],[15,6,2,1],[12,16,3,1]].forEach(([a,b,w,h]) => x.fillRect(a, b, w, h));
  const box = $('critters');
  for (let i = 0; i < 14; i++){
    const f = document.createElement('i');
    f.className = 'firefly';
    f.style.left = (Math.random() * 100) + 'vw';
    f.style.top = (30 + Math.random() * 65) + 'vh';
    f.style.setProperty('--dur', (6 + Math.random() * 8) + 's');
    f.style.setProperty('--delay', (-Math.random() * 8) + 's');
    f.style.setProperty('--dx', (Math.random() * 80 - 40) + 'px');
    f.style.setProperty('--dy', (Math.random() * 60 - 40) + 'px');
    box.appendChild(f);
  }
  const bat = ['k.........k','kk..k.k..kk','kkkkkkkkkkk','.kk.kkk.kk.','..k.....k..'];
  for (let n = 0; n < 2; n++){
    const w = document.createElement('div'); w.className = 'bat';
    w.style.top = (70 + n * 90) + 'px';
    w.style.setProperty('--dur', (24 + n * 9) + 's');
    w.style.setProperty('--delay', (-n * 13) + 's');
    const cv = document.createElement('canvas'); cv.width = 11; cv.height = 5;
    const bx = cv.getContext('2d'); bx.fillStyle = '#0b0616';
    bat.forEach((r, j) => [...r].forEach((ch, i) => { if (ch === 'k') bx.fillRect(i, j, 1, 1); }));
    w.appendChild(cv); box.appendChild(w);
  }
})();
 
/* ---------- sound ---------- */
let audio = null;
function beep(freq, dur = .08, type = 'square', vol = .04, slide = 0){
  if (!$('tgSound').checked || sfxVol <= 0) return;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime;
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.linearRampToValueAtTime(freq + slide, t + dur);
    g.gain.setValueAtTime(vol * sfxVol / 0.8, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g); g.connect(audio.destination); o.start(t); o.stop(t + dur);
  } catch (e) {}
}
 
/* ---------- music, cheer & volume (files are in the assets/ folder) ---------- */
const bgMusic = $('bgMusic'), cheerSfx = $('cheerSfx');
let musicVol = 0.2, sfxVol = 0.5;       // 0 to 1 (kept low on purpose)
let musicWanted = false;                // should the music be playing right now?
let fadeTimer = null, fading = false;
 
try {
  const m = parseFloat(localStorage.getItem('akm-vol2-music')), f = parseFloat(localStorage.getItem('akm-vol2-sfx'));
  if (!isNaN(m)) musicVol = m;
  if (!isNaN(f)) sfxVol = f;
} catch (e) {}
$('volMusic').value = Math.round(musicVol * 100);
$('volSfx').value = Math.round(sfxVol * 100);
 
function saveVolumes(){
  try { localStorage.setItem('akm-vol2-music', musicVol); localStorage.setItem('akm-vol2-sfx', sfxVol); } catch (e) {}
}
function safePlay(a){ const p = a.play(); if (p && p.catch) p.catch(() => {}); }   // browsers may block play() until a tap
function applyAudio(){
  const on = $('tgSound').checked;
  bgMusic.muted = !on; cheerSfx.muted = !on;
  if (!fading) bgMusic.volume = musicVol;
  cheerSfx.volume = sfxVol;
}
function fadeMusic(to, ms, done){          // smooth fade in 50ms steps
  clearInterval(fadeTimer); fading = true;
  const from = bgMusic.volume, steps = Math.max(1, ms / 50); let i = 0;
  fadeTimer = setInterval(() => {
    i++;
    bgMusic.volume = Math.min(1, Math.max(0, from + (to - from) * i / steps));
    if (i >= steps){ clearInterval(fadeTimer); fading = false; if (done) done(); }
  }, 50);
}
function startMusic(){                      // must be called from a tap/click (Start button)
  clearInterval(fadeTimer); fading = false; musicWanted = true;
  applyAudio(); bgMusic.volume = musicVol;
  safePlay(bgMusic);
}
function stopMusic(fadeMs){
  musicWanted = false;
  if (!fadeMs){ bgMusic.pause(); return; }
  fadeMusic(0, fadeMs, () => bgMusic.pause());
}
function playCheer(){
  applyAudio(); cheerSfx.currentTime = 0; safePlay(cheerSfx);
}
// stop the music when the tab is hidden, bring it back when you return
document.addEventListener('visibilitychange', () => {
  if (document.hidden) bgMusic.pause(); else if (musicWanted) safePlay(bgMusic);
});
 
// Try to start the music as soon as the page opens.
// Browsers often block sound until the first tap, click, or key press,
// so if that happens we start it on the very first interaction instead.
function autoStartMusic(){
  musicWanted = true; applyAudio();
  const p = bgMusic.play();
  if (p && p.catch) p.catch(() => {
    const events = ['pointerdown', 'keydown', 'touchend', 'click'];
    const kick = () => {
      if (musicWanted && bgMusic.paused && !document.hidden) safePlay(bgMusic);
      events.forEach(ev => removeEventListener(ev, kick));
    };
    events.forEach(ev => addEventListener(ev, kick, {passive:true}));
  });
}
 
/* ---------- sprites ---------- */
const PAL = {o:'#ff8a2b', d:'#b8480c', g:'#5cd16a', k:'#1b1030', y:'#ffd23f', w:'#f6f2ff', c:'#b9c8ff'};
function makeSprite(rows){
  const w = Math.max(...rows.map(r => r.length)), h = rows.length;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== '.' && PAL[ch]){ x.fillStyle = PAL[ch]; x.fillRect(i, j, 1, 1); } }));
  return c;
}
const PLAYER = makeSprite([
  '.....gg.....',
  '....gg......',
  '..dooooood..',
  '.dooooooood.',
  'dookooookood',
  'dooooooooood',
  'dookkkkkkood',
  '.dooooooood.',
  '..dddddddd..',
  '...kk..kk...',
  '...kk..kk...'
]);
const GHOST = makeSprite([
  '...wwwwww...',
  '..wwwwwwww..',
  '.wwwwwwwwww.',
  '.wwkkwwkkww.',
  '.wwkkwwkkww.',
  '.wwwwwwwwww.',
  '.wwwwkkwwww.',
  '.wwwwkkwwww.',
  '.wwwwwwwwww.',
  '.cccccccccc.',
  '.ww.www.www.',
  '.w...w...w..'
]);
 
/* ---------- state ---------- */
const canvas = $('game'), ctx = canvas.getContext('2d');
const seedInput = $('seedInput'), nameInput = $('nameInput');
const WORDS = ['PUMPKIN','WITCH','GHOUL','COBWEB','CAULDRON','BAT','SPIDER','MUMMY','CANDY','MOON','RAVEN','GOBLIN'];
const randomSeed = () => WORDS[Math.floor(Math.random() * WORDS.length)] + '-' + (10 + Math.floor(Math.random() * 90));
let S = null, diff = 'cozy', mode = 'menu';
const held = [];
let queued = null;
 
function hash2(x, y, s){
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(s + 1, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
 
function setup(){
  const d = DIFF[diff];
  if (!seedInput.value.trim()) seedInput.value = randomSeed();
  const seed = seedInput.value.trim().toUpperCase();
  const rand = mulberry32(hashStr(seed + '|' + diff));
  const {g, gen} = generate(d.cols, d.rows, rand);
  // Ghost levels: knock out some walls so there are loops to run around (and a way to escape the ghost)
  const loops = d.loops ? addLoops(g, rand, d.loops, 14) : 0;
  const cols = d.cols, rows = d.rows, start = [1, 1];
  const fs = bfs(g, 1, 1);
 
  const allLeaves = [];   // dead ends of the maze (the leaves of the tree)
  for (let y = 1; y < rows - 1; y++) for (let x = 1; x < cols - 1; x++){
    if (g[y][x] === 0 && degree(g, x, y) === 1 && !(x === 1 && y === 1)) allLeaves.push([x, y]);
  }
  // The door always goes at the END of a dead end, as far from the start as possible.
  // That way the door can never block the road to any candy.
  let exit = allLeaves[0] || [cols - 2, rows - 2];
  allLeaves.forEach(p => { if (fs.dist[p[1]][p[0]] > fs.dist[exit[1]][exit[0]]) exit = p; });
  const leaves = allLeaves.filter(p => !(p[0] === exit[0] && p[1] === exit[1]));
  // candy goes to dead ends (leaves of the tree), spread out with a farthest-point pick
  const pool = shuffle(leaves.slice(), rand), chosen = [], anchors = [start, exit];
  while (chosen.length < d.candy && pool.length){
    let best = -1, bi = 0;
    pool.forEach((p, i) => {
      const m = Math.min(...anchors.map(a => Math.abs(a[0] - p[0]) + Math.abs(a[1] - p[1])));
      if (m > best){ best = m; bi = i; }
    });
    const p = pool.splice(bi, 1)[0]; chosen.push(p); anchors.push(p);
  }
  const candies = chosen.map(p => ({x:p[0], y:p[1], got:false}));
  while (candies.length < d.candy){
    const p = fs.order[Math.floor(rand() * fs.order.length)];
    if (!(p[0] === 1 && p[1] === 1) && !(p[0] === exit[0] && p[1] === exit[1]) && !candies.some(c => c.x === p[0] && c.y === p[1])) candies.push({x:p[0], y:p[1], got:false});
  }
 
  let ghost = null;
  if (d.ghost){
    pool.sort((a, b) => fs.dist[b[1]][b[0]] - fs.dist[a[1]][a[0]]);
    let den = pool.find(p => !candies.some(c => c.x === p[0] && c.y === p[1]));
    if (!den) den = fs.order[Math.floor(fs.order.length * .6)];
    ghost = {x:den[0], y:den[1], hx:den[0], hy:den[1], rx:den[0], ry:den[1], awake:false, next:0, cool:0};
  }
  const pr = perfectRun(g, start, exit, candies.map(c => [c.x, c.y]));
 
  S = {
    d, seed, cols, rows, g, gen, start, exit, fs, leaves, candies, ghost,
    got:0, moves:0, rewalk:0, scares:0, px:1, py:1, rx:1, ry:1,
    heat:new Map([['1,1', 1]]), started:false, t0:0, elapsed:0, lastMove:0, slide:null, bumpT:0,
    ghostPath:[], particles:[], flash:0, shake:0, loops,
    perfect:pr.len, steiner:pr.marked, shortest:fs.dist[exit[1]][exit[0]]
  };
  canvas.width = cols * T; canvas.height = rows * T;
  ctx.imageSmoothingEnabled = false;
  $('stage').style.maxWidth = (cols * T * 2) + 'px';
  buildBG();
  $('hSeed').textContent = seed;
}
 
/* ---------- pixel art: static layer ---------- */
function drawFloor(x, tx, ty, ox, oy){
  x.fillStyle = ((tx + ty) & 1) ? '#1b1517' : '#211a1c';
  x.fillRect(ox, oy, T, T);
  for (let i = 0; i < 5; i++){
    const px = Math.floor(hash2(tx, ty, i) * T), py = Math.floor(hash2(tx, ty, i + 9) * T);
    x.fillStyle = hash2(tx, ty, i + 20) > .5 ? '#2d2225' : '#120d0f';
    x.fillRect(ox + px, oy + py, 1 + (i % 2), 1);
  }
  const r = hash2(tx, ty, 99);
  if (r < .05){
    x.fillStyle = '#f2e6d0'; x.fillRect(ox + 7, oy + 10, 2, 3);
    x.fillStyle = '#e0433a'; x.fillRect(ox + 5, oy + 8, 6, 2); x.fillRect(ox + 6, oy + 7, 4, 1);
    x.fillStyle = '#fff'; x.fillRect(ox + 6, oy + 8, 1, 1); x.fillRect(ox + 9, oy + 8, 1, 1);
  } else if (r < .10){
    x.fillStyle = '#a8281f'; x.fillRect(ox + 6, oy + 9, 3, 2);
    x.fillStyle = '#6e1712'; x.fillRect(ox + 8, oy + 10, 2, 1);
  } else if (r < .14){
    x.fillStyle = '#5f5558'; x.fillRect(ox + 4, oy + 10, 3, 2); x.fillRect(ox + 9, oy + 7, 2, 2);
    x.fillStyle = '#7d7276'; x.fillRect(ox + 4, oy + 10, 3, 1);
  } else if (r < .18){
    x.fillStyle = '#7a1c26'; x.fillRect(ox + 5, oy + 11, 1, 3); x.fillRect(ox + 7, oy + 9, 1, 5); x.fillRect(ox + 9, oy + 11, 1, 3);
  }
}
function drawHedge(x, tx, ty, ox, oy, g){
  x.fillStyle = '#2a0b10'; x.fillRect(ox, oy, T, T);
  for (let i = 0; i < 14; i++){
    const px = Math.floor(hash2(tx, ty, i) * T), py = Math.floor(hash2(tx, ty, i + 40) * T), r = hash2(tx, ty, i + 80);
    x.fillStyle = r < .4 ? '#5a141c' : (r < .8 ? '#14050a' : '#8f2230');
    x.fillRect(ox + px, oy + py, 2, 2);
  }
  const open = (dx, dy) => g[ty + dy] && g[ty + dy][tx + dx] === 0;
  if (open(0, 1)){ x.fillStyle = '#0c0306'; x.fillRect(ox, oy + T - 4, T, 4); x.fillStyle = '#050102'; x.fillRect(ox, oy + T - 1, T, 1); }
  if (open(0, -1)){ x.fillStyle = '#c23445'; x.fillRect(ox, oy, T, 2); }
  if (open(-1, 0)){ x.fillStyle = '#7a1c28'; x.fillRect(ox, oy, 1, T); }
  if (open(1, 0)){ x.fillStyle = '#12040a'; x.fillRect(ox + T - 1, oy, 1, T); }
  const h = hash2(tx, ty, 123);
  if (h < .05){ x.fillStyle = '#ff8a2b'; x.fillRect(ox + 3, oy + 4, 2, 2); x.fillRect(ox + 10, oy + 8, 2, 2); }
  else if (h < .08 && open(0, 1)){
    // tiny jack-o-lantern set into the hedge
    x.fillStyle = '#ff8a2b'; x.fillRect(ox + 4, oy + 4, 8, 7);
    x.fillStyle = '#b8480c'; x.fillRect(ox + 4, oy + 10, 8, 1);
    x.fillStyle = '#ffd23f'; x.fillRect(ox + 5, oy + 6, 2, 2); x.fillRect(ox + 9, oy + 6, 2, 2); x.fillRect(ox + 6, oy + 9, 4, 1);
    x.fillStyle = '#5cd16a'; x.fillRect(ox + 7, oy + 2, 2, 2);
  }
}
function buildBG(){
  const {cols, rows, g} = S;
  const c = document.createElement('canvas'); c.width = cols * T; c.height = rows * T;
  const x = c.getContext('2d');
  for (let ty = 0; ty < rows; ty++) for (let tx = 0; tx < cols; tx++){
    if (g[ty][tx] === 1) drawHedge(x, tx, ty, tx * T, ty * T, g); else drawFloor(x, tx, ty, tx * T, ty * T);
  }
  // start rune
  const ox = T, oy = T;
  x.fillStyle = '#7a1a22'; x.fillRect(ox + 2, oy + 2, 12, 12);
  x.fillStyle = '#b3283a'; x.fillRect(ox + 3, oy + 3, 10, 10);
  x.fillStyle = '#2a0f14'; x.fillRect(ox + 4, oy + 4, 8, 8);
  x.fillStyle = '#ff6b6b'; x.fillRect(ox + 7, oy + 6, 2, 4); x.fillRect(ox + 6, oy + 7, 4, 2);
  S.bg = c;
}
 
/* ---------- game logic ---------- */
function toast(msg, ms = 1900){
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), ms);
}
function burst(tx, ty, color){
  for (let i = 0; i < 14; i++){
    const a = Math.random() * Math.PI * 2, s = 30 + Math.random() * 50;
    S.particles.push({x:tx * T + 8, y:ty * T + 8, vx:Math.cos(a) * s, vy:Math.sin(a) * s - 20, life:520, max:520, c:color});
  }
}
function bump(now){
  if (now - S.bumpT > 260){ beep(90, .05, 'square', .03); S.bumpT = now; }
}
function pickup(cd, now){
  cd.got = true; S.got++; S.slide = null;
  burst(cd.x, cd.y, '#ff7ab8');
  beep(660, .07, 'square', .05); setTimeout(() => beep(990, .1, 'square', .05), 70);
  const left = S.candies.length - S.got;
  if (left === 0){
    toast('The crypt door is open! Run for the glowing door.', 2600);
    setTimeout(() => beep(520, .18, 'triangle', .06, 400), 150);
  } else if (S.ghost && !S.ghost.awake){
    S.ghost.awake = true; S.ghost.cool = now + 1500; S.ghost.next = now + 1500;
    toast('You woke the ghost! It is coming for you.', 2600);
    beep(300, .4, 'sawtooth', .05, -200);
  } else {
    toast(left + ' candy left');
  }
}
function caught(now){
  const gh = S.ghost;
  S.scares++; S.slide = null;
  S.px = S.start[0]; S.py = S.start[1]; S.rx = S.px; S.ry = S.py;
  gh.x = gh.hx; gh.y = gh.hy; gh.rx = gh.x; gh.ry = gh.y;
  gh.cool = now + 2500; gh.next = now + 2500; S.ghostPath = [];
  S.flash = now + 350; S.shake = now + 300;
  beep(240, .4, 'sawtooth', .08, -190);
  toast('Boo! The ghost sent you back to the start.');
}
function tryMove(dx, dy, now){
  const nx = S.px + dx, ny = S.py + dy;
  if (!(S.g[ny] && S.g[ny][nx] === 0)){ bump(now); return false; }
  if (nx === S.exit[0] && ny === S.exit[1] && S.got < S.candies.length){
    bump(now); toast('Door locked. ' + (S.candies.length - S.got) + ' candy left!'); return false;
  }
  if (!S.started){ S.started = true; S.t0 = now; }
  S.px = nx; S.py = ny; S.moves++;
  const key = nx + ',' + ny, c = S.heat.get(key) || 0;
  S.heat.set(key, c + 1); if (c > 0) S.rewalk++;
  beep(170 + (S.moves % 4) * 14, .03, 'square', .014);
  for (const cd of S.candies) if (!cd.got && cd.x === nx && cd.y === ny) pickup(cd, now);
  const gh = S.ghost;
  if (gh && gh.awake && now >= gh.cool && gh.x === nx && gh.y === ny){ caught(now); return true; }
  if (nx === S.exit[0] && ny === S.exit[1]){ win(now); return true; }
  if (S.slide){
    const opts = D4.filter(([ax, ay]) => !(ax === -dx && ay === -dy) && S.g[S.py + ay] && S.g[S.py + ay][S.px + ax] === 0);
    S.slide = opts.length === 1 ? opts[0] : null;
  }
  return true;
}
function update(now, dt){
  if (mode !== 'play') return;
  if (now - S.lastMove >= 125){
    let dir = null;
    if (held.length){ dir = held[held.length - 1]; S.slide = null; }
    else if (queued){ dir = queued; S.slide = null; }
    else if (S.slide) dir = S.slide;
    if (dir){
      queued = null;
      const ok = tryMove(dir[0], dir[1], now);
      S.lastMove = now;
      if (!ok) S.slide = null;
    }
  }
  const gh = S.ghost;
  if (mode === 'play' && gh && gh.awake && now >= gh.cool && now >= gh.next){
    const b = bfs(S.g, gh.x, gh.y, S.px, S.py);       // the ghost thinks with BFS
    const p = pathTo(b.prev, S.px, S.py);
    S.ghostPath = p;
    if (p.length > 1){ gh.x = p[1][0]; gh.y = p[1][1]; }
    gh.next = now + S.d.ghost;
    if (gh.x === S.px && gh.y === S.py) caught(now);
  }
}
 
/* ---------- rendering ---------- */
const DARK = [0, .25, .5, .75, 1].map(a => a);
function drawCandy(cd, now, i){
  if (cd.got) return;
  const x = cd.x * T, y = cd.y * T, bob = Math.round(Math.sin(now / 220 + i));
  ctx.fillStyle = '#ff4d9d'; ctx.fillRect(x + 5, y + 6 + bob, 6, 5);
  ctx.fillStyle = '#ffd0e8'; ctx.fillRect(x + 6, y + 6 + bob, 1, 5); ctx.fillRect(x + 9, y + 6 + bob, 1, 5);
  ctx.fillStyle = '#ffd23f'; ctx.fillRect(x + 2, y + 7 + bob, 3, 3); ctx.fillRect(x + 11, y + 7 + bob, 3, 3);
  ctx.fillStyle = '#fff6b0'; ctx.fillRect(x + 2, y + 7 + bob, 1, 1); ctx.fillRect(x + 13, y + 9 + bob, 1, 1);
  if (((now / 260 + i) | 0) % 3 === 0){ ctx.fillStyle = '#fff'; ctx.fillRect(x + 12, y + 3 + bob, 1, 3); ctx.fillRect(x + 11, y + 4 + bob, 3, 1); }
}
function drawDoor(open, now){
  const ox = S.exit[0] * T, oy = S.exit[1] * T;
  ctx.fillStyle = '#140c0e'; ctx.fillRect(ox, oy, T, T);
  ctx.fillStyle = '#7d7378'; ctx.fillRect(ox + 1, oy + 2, 14, 14); ctx.fillRect(ox + 3, oy, 10, 2);
  ctx.fillStyle = '#564c52'; ctx.fillRect(ox + 1, oy + 2, 1, 14); ctx.fillRect(ox + 14, oy + 2, 1, 14);
  if (open){
    const f = (Math.sin(now / 180) + 1) / 2;
    ctx.fillStyle = '#ff3b3b'; ctx.fillRect(ox + 3, oy + 3, 10, 13);
    ctx.fillStyle = '#ffc9c9'; ctx.fillRect(ox + 5, oy + 5, 6, 11);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(ox + 7, oy + 7, 2, 9);
    ctx.globalAlpha = .16 + .12 * f; ctx.fillStyle = '#ff3030'; ctx.fillRect(ox - 6, oy - 6, T + 12, T + 12); ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = '#4a2f22'; ctx.fillRect(ox + 3, oy + 3, 10, 13);
    ctx.fillStyle = '#35201a'; ctx.fillRect(ox + 6, oy + 3, 1, 13); ctx.fillRect(ox + 10, oy + 3, 1, 13);
    ctx.fillStyle = '#b8bdd6'; ctx.fillRect(ox + 6, oy + 8, 4, 5);
    ctx.fillStyle = '#8a90ad'; ctx.fillRect(ox + 7, oy + 6, 2, 2);
    ctx.fillStyle = '#140c0e'; ctx.fillRect(ox + 7, oy + 10, 2, 1);
  }
}
function drawGhost(now){
  const gh = S.ghost; if (!gh) return;
  const bob = Math.round(Math.sin(now / 250) * 1.2);
  const x = Math.round(gh.rx * T) + 2, y = Math.round(gh.ry * T) + 2 + bob;
  if (!gh.awake){
    ctx.globalAlpha = .5; ctx.drawImage(GHOST, x, y); ctx.globalAlpha = 1;
    ctx.fillStyle = '#cfe0ff'; const zb = Math.round((now / 400) % 2);
    ctx.fillRect(x + 10, y - 3 - zb, 3, 1); ctx.fillRect(x + 11, y - 2 - zb, 1, 1); ctx.fillRect(x + 10, y - 1 - zb, 3, 1);
  } else if (now < gh.cool){
    if (((now / 110) | 0) % 2) { ctx.globalAlpha = .6; ctx.drawImage(GHOST, x, y); ctx.globalAlpha = 1; }
  } else {
    ctx.globalAlpha = .92; ctx.drawImage(GHOST, x, y); ctx.globalAlpha = 1;
  }
}
function render(now, dt){
  const k = 1 - Math.exp(-dt / 50);
  S.rx += (S.px - S.rx) * k; S.ry += (S.py - S.ry) * k;
  if (S.ghost){ const kg = 1 - Math.exp(-dt / 130); S.ghost.rx += (S.ghost.x - S.ghost.rx) * kg; S.ghost.ry += (S.ghost.y - S.ghost.ry) * kg; }
 
  ctx.save();
  if (now < S.shake) ctx.translate(Math.round((Math.random() - .5) * 4), Math.round((Math.random() - .5) * 4));
  ctx.drawImage(S.bg, 0, 0);
 
  // breadcrumbs: tiles you have walked (brighter = walked again)
  S.heat.forEach((c, key) => {
    const [x, y] = key.split(',').map(Number);
    ctx.fillStyle = 'rgba(255,90,90,' + Math.min(.12 + c * .08, .45) + ')';
    ctx.fillRect(x * T + 6, y * T + 6, 4, 4);
  });
  // optional teaching overlay: the ghost's BFS path
  if ($('tgGhost').checked && S.ghost && S.ghost.awake && S.ghostPath.length){
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    S.ghostPath.forEach(([x, y]) => ctx.fillRect(x * T + 6, y * T + 6, 4, 4));
  }
  // lantern light: darker the farther from the player (stepped for a pixel look)
  for (let ty = 0; ty < S.rows; ty++) for (let tx = 0; tx < S.cols; tx++){
    const dist = Math.hypot(tx - S.rx, ty - S.ry);
    const a = Math.min(1, Math.max(0, (dist - S.d.radius + 1) / 3));
    const lvl = Math.ceil(a * 4) / 4 * S.d.dark;
    if (lvl > 0){ ctx.fillStyle = 'rgba(0,0,0,' + lvl.toFixed(2) + ')'; ctx.fillRect(tx * T, ty * T, T, T); }
  }
  drawDoor(S.got === S.candies.length, now);
  S.candies.forEach((cd, i) => drawCandy(cd, now, i));
  drawGhost(now);
  // player
  const hop = (now - S.lastMove < 110 && mode === 'play') ? -1 : 0;
  ctx.drawImage(PLAYER, Math.round(S.rx * T) + 2, Math.round(S.ry * T) + 3 + hop);
  // particles
  for (let i = S.particles.length - 1; i >= 0; i--){
    const p = S.particles[i]; p.life -= dt;
    if (p.life <= 0){ S.particles.splice(i, 1); continue; }
    p.x += p.vx * dt / 1000; p.y += p.vy * dt / 1000; p.vy += 120 * dt / 1000;
    ctx.globalAlpha = p.life / p.max; ctx.fillStyle = p.c; ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  if (now < S.flash){ ctx.fillStyle = 'rgba(255,60,90,.33)'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
}
const fmt = ms => { const s = Math.floor(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const hudCache = {};
function setHud(id, v){ if (hudCache[id] !== v){ hudCache[id] = v; $(id).textContent = v; } }
function hud(now){
  const el = (mode === 'play' && S.started) ? now - S.t0 : S.elapsed;
  setHud('hCandy', S.got + '/' + S.candies.length);
  setHud('hSteps', String(S.moves));
  setHud('hTime', fmt(el));
  setHud('hBoo', String(S.scares));
}
let last = performance.now();
function frame(ts){
  const dt = Math.min(64, ts - last); last = ts;
  if (S){ update(ts, dt); render(ts, dt); hud(ts); }
  requestAnimationFrame(frame);
}
 
/* ---------- celebration: confetti (the win box now stays open so players can save their time) ---------- */
const cf = $('confetti'), cfx = cf.getContext('2d');
let cfPieces = [], cfRaf = 0, winToken = 0;
const CF_COLORS = ['#e5202f', '#ff6b6b', '#ffffff', '#ffd23f', '#ff7ab8', '#9a1020'];
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
function stopConfetti(){
  cancelAnimationFrame(cfRaf); cfPieces = [];
  cfx.clearRect(0, 0, cf.width, cf.height);
}
function launchConfetti(){
  if (reduceMotion()) return;
  stopConfetti();
  const px = 3;                                          // chunky pixels (1 canvas pixel = 3 screen pixels)
  cf.width = Math.ceil(innerWidth / px); cf.height = Math.ceil(innerHeight / px);
  const W = cf.width, H = cf.height, G = 220;
  const add = (x, y, vx, vy) => cfPieces.push({x, y, vx, vy, s:1 + Math.floor(Math.random() * 2), spin:Math.random() * 6,
    c:CF_COLORS[Math.floor(Math.random() * CF_COLORS.length)]});
  for (let i = 0; i < 110; i++){                         // two cannons, one in each bottom corner
    const right = i % 2, h = H * (.4 + Math.random() * .5);
    add(right ? W : 0, H, (right ? -1 : 1) * (25 + Math.random() * 130), -Math.sqrt(2 * G * h));
  }
  const t0 = performance.now(); let last = t0;
  const tick = now => {
    const dt = Math.max(0, Math.min(.05, (now - last) / 1000)); last = now;
    if (now - t0 < 2600) for (let k = 0; k < 2; k++) add(Math.random() * W, -2, (Math.random() - .5) * 20, 15 + Math.random() * 30);
    cfx.clearRect(0, 0, W, H);
    for (let i = cfPieces.length - 1; i >= 0; i--){
      const p = cfPieces[i];
      p.vy += G * dt; if (p.vy > 55) p.vy = 55;          // float down slowly
      p.x += (p.vx + Math.sin(now / 200 + p.spin) * 14) * dt; p.y += p.vy * dt;
      if (p.y > H + 4){ cfPieces.splice(i, 1); continue; }
      cfx.fillStyle = p.c; cfx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s);
    }
    if ((now - t0 < 2600 || cfPieces.length) && now - t0 < 9000) cfRaf = requestAnimationFrame(tick);
    else cfx.clearRect(0, 0, W, H);
  };
  cfRaf = requestAnimationFrame(tick);
}
function celebrate(){
  launchConfetti();
  ['#ff6b6b', '#ffffff', '#ffd23f'].forEach(c => burst(S.exit[0], S.exit[1], c));
}
 
/* ---------- flow ---------- */
function startGame(){
  setup();
  mode = 'play'; held.length = 0; queued = null;
  winToken++; stopConfetti();
  cheerSfx.pause(); cheerSfx.currentTime = 0;
  startMusic();
  $('menu').hidden = true; $('winbox').hidden = true; $('lesson').hidden = true;
  fitStage();
  if (window.hideLeaderboard) hideLeaderboard();
  toast('Candy hides in the dead ends. Grab it all!', 2600);
}
function backToMenu(){
  mode = 'menu'; held.length = 0;
  winToken++; stopConfetti(); cheerSfx.pause(); startMusic();
  $('lesson').hidden = true; $('winbox').hidden = true; $('menu').hidden = false;
  fitStage();
  if (window.hideLeaderboard) hideLeaderboard();
  cancelAnimationFrame(vzRaf);
  seedInput.value = randomSeed(); setup();
  window.scrollTo({top:0, behavior:'smooth'});
}
function win(now){
  mode = 'won'; S.elapsed = now - S.t0; held.length = 0; S.slide = null;
  [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, .16, 'square', .05), i * 120));
  stopMusic(1200);   // fade the music out
  playCheer();       // and cheer!
  const name = nameInput.value.trim() || 'Traveler';
  $('winLine').textContent = name + ', you made it out in ' + fmt(S.elapsed) + ' with ' + S.scares + (S.scares === 1 ? ' boo.' : ' boos.');
  $('winbox').hidden = false;
  afterWin();        // logged in: save the time. Not logged in: show sign up / log in
  showLesson(name);
  celebrate();
}
function showLesson(name){
  const eff = Math.min(100, Math.round(S.perfect / Math.max(1, S.moves) * 100));
  const rank = eff >= 90 ? 'Maze Master: almost the best possible route!'
             : eff >= 70 ? 'Graph Explorer: very few wasted steps.'
             : eff >= 45 ? 'Brave Backtracker: you hit dead ends and came back.'
             : 'Curious Wanderer: you explored lots of the maze!';
  let best = null;
  try {
    const key = 'hollow-best-' + diff + '-' + S.seed, prev = parseFloat(localStorage.getItem(key));
    best = (!isNaN(prev) && prev < S.elapsed) ? prev : S.elapsed;
    localStorage.setItem(key, String(best));
  } catch (e) { best = S.elapsed; }
  $('rRank').textContent = rank;
  $('rTime').textContent = fmt(S.elapsed);
  $('rSteps').textContent = S.moves;
  $('rPerfect').textContent = S.perfect;
  $('rBoo').textContent = S.scares;
  $('rBest').textContent = fmt(best);
  $('perfectExplain').textContent = 'The fewest steps to grab every candy and reach the door is ' + S.perfect + '. You took ' + S.moves + '. Wrong turns and ghost boos add steps, and that is totally okay!';
 
  // data for the graph tabs
  let V = 0, E = 0;
  for (let y = 0; y < S.rows; y++) for (let x = 0; x < S.cols; x++){
    if (S.g[y][x] !== 0) continue;
    V++;
    if (S.g[y][x + 1] === 0) E++;
    if (S.g[y + 1] && S.g[y + 1][x] === 0) E++;
  }
  S.V = V; S.E = E;
  S.orderIdx = Array.from({length:S.rows}, () => Array(S.cols).fill(-1));
  S.fs.order.forEach(([x, y], i) => { S.orderIdx[y][x] = i; });
  S.bt = bfsTrace(S.g, S.start[0], S.start[1], S.exit[0], S.exit[1]);
  $('graphFacts').textContent = 'Your maze has ' + V + ' dots and ' + E + ' lines.' + (S.loops ? ' This level has extra loops, which means more lines and more ways to escape the ghost!' : '');
 
  $('lesson').hidden = false;
  vz.width = S.cols * VT; vz.height = S.rows * VT;
  selectTab('run');
  buildQuiz();
  if (window.showLeaderboard) showLeaderboard(diff);   // the board only appears after a win
  if (!acct && window.loadLeaderboard) loadLeaderboard(API_URL).catch(() => {});   // guests see the scores too
}
 
/* ---------- visualizer ---------- */
const vz = $('viz'), vx = vz.getContext('2d');
let vzMode = 'run', vzRaf = 0, vzSpeed = 4;
const VC = {wall:'#0d0709', dim:'#2a1418', settled:'#7a1a22', orange:'#ff3b3b', gold:'#ffd23f', mint:'#7ef0b0', pink:'#ff7ab8', edge:'#c0485a', node:'#ffe6e6', teal:'#2bd1a0'};
const vTile = (x, y, c) => { vx.fillStyle = c; vx.fillRect(x * VT, y * VT, VT, VT); };
const vDot = (x, y, c, s) => { vx.fillStyle = c; const o = (VT - s) / 2; vx.fillRect(x * VT + o, y * VT + o, s, s); };
function vBase(fn){
  vx.fillStyle = VC.wall; vx.fillRect(0, 0, vz.width, vz.height);
  for (let y = 0; y < S.rows; y++) for (let x = 0; x < S.cols; x++) if (S.g[y][x] === 0) vTile(x, y, fn(x, y));
}
function vMarks(){
  S.candies.forEach(c => vDot(c.x, c.y, VC.pink, 6));
  vDot(S.start[0], S.start[1], VC.mint, 6);
  vDot(S.exit[0], S.exit[1], VC.gold, 6);
}
const LEGEND = {
  run:'Dark = you never went there. Dark red = you walked there once. Bright red or white = you walked there again. Pink dots = candy, green = start, yellow = door.',
  graph:'Every bright dot is a place (a vertex). Every red line is a path between two places (an edge). The dots light up one by one.',
  dfs:'Dark red = tunnels already dug. Bright red = the plates in the pile (the stack). Yellow = the top plate.',
  bfs:'White = people waiting in line (the queue). Red to orange = how far from the start. Yellow line = the shortest way to the door.',
  tree:'Teal = the best possible walk. Yellow = the straight road to the door. Pink dots = dead ends (leaves) that hold candy.'
};
const ANIM = {graph:true, dfs:true, bfs:true};
function vzMax(m){ return m === 'graph' ? S.fs.order.length : m === 'dfs' ? S.gen.length : S.bt.goalIdx + 1; }
function drawViz(m, i){
  let info = '';
  if (m === 'run'){
    vBase((x, y) => { const c = S.heat.get(x + ',' + y) || 0; return c === 0 ? VC.dim : c === 1 ? '#a8322a' : c === 2 ? '#ff4f3f' : '#ffd0c8'; });
    vMarks();
    info = 'You took ' + S.moves + ' steps and walked over ' + S.rewalk + ' tiles a second time.';
  } else if (m === 'graph'){
    vx.fillStyle = VC.wall; vx.fillRect(0, 0, vz.width, vz.height);
    const on = (x, y) => S.orderIdx[y] && S.orderIdx[y][x] >= 0 && S.orderIdx[y][x] < i;
    vx.fillStyle = VC.edge;
    for (let y = 0; y < S.rows; y++) for (let x = 0; x < S.cols; x++){
      if (!on(x, y)) continue;
      if (on(x + 1, y) && S.g[y][x + 1] === 0) vx.fillRect(x * VT + VT / 2, y * VT + VT / 2 - 1, VT, 2);
      if (on(x, y + 1) && S.g[y + 1][x] === 0) vx.fillRect(x * VT + VT / 2 - 1, y * VT + VT / 2, 2, VT);
    }
    for (let y = 0; y < S.rows; y++) for (let x = 0; x < S.cols; x++) if (on(x, y)) vDot(x, y, VC.node, 3);
    S.candies.forEach(c => { if (on(c.x, c.y)) vDot(c.x, c.y, VC.pink, 6); });
    if (on(S.start[0], S.start[1])) vDot(S.start[0], S.start[1], VC.mint, 6);
    if (on(S.exit[0], S.exit[1])) vDot(S.exit[0], S.exit[1], VC.gold, 6);
    info = 'Dots lit up: ' + Math.min(i, S.V) + ' of ' + S.V + '.';
  } else if (m === 'dfs'){
    const carved = new Set(), stack = []; let deepest = 0;
    for (let k = 0; k < i; k++){
      const s = S.gen[k];
      if (s.t === 'v'){
        carved.add(s.x + ',' + s.y);
        if (s.px >= 0) carved.add(((s.x + s.px) / 2) + ',' + ((s.y + s.py) / 2));
        stack.push([s.x, s.y]); deepest = Math.max(deepest, stack.length);
      } else stack.pop();
    }
    vx.fillStyle = VC.wall; vx.fillRect(0, 0, vz.width, vz.height);
    carved.forEach(key => { const [x, y] = key.split(',').map(Number); vTile(x, y, VC.settled); });
    for (let j = 0; j < stack.length; j++){
      vTile(stack[j][0], stack[j][1], VC.orange);
      if (j > 0) vTile((stack[j][0] + stack[j - 1][0]) / 2, (stack[j][1] + stack[j - 1][1]) / 2, VC.orange);
    }
    if (stack.length){ const h = stack[stack.length - 1]; vTile(h[0], h[1], VC.gold); }
    info = i >= S.gen.length ? 'Done! The pile is empty, so every room is connected. The pile was ' + deepest + ' plates tall at most.'
                             : 'Step ' + i + ' of ' + S.gen.length + '. Plates in the stack: ' + stack.length + '. Tallest so far: ' + deepest + '.';
  } else if (m === 'bfs'){
    const b = S.bt, maxD = Math.max(1, b.dist[S.exit[1]][S.exit[0]]);
    vBase(() => VC.dim);
    for (let k = 0; k < i; k++){ const [x, y] = b.q[k]; vTile(x, y, 'hsl(' + ((350 + (b.dist[y][x] / maxD) * 50) % 360) + ',75%,45%)'); }
    const lo = i, hi = i > 0 ? b.disc[i - 1] : 1;
    for (let k = lo; k < hi; k++){ const [x, y] = b.q[k]; vTile(x, y, '#fff4dc'); }
    if (i >= b.goalIdx + 1) pathTo(b.prev, S.exit[0], S.exit[1]).forEach(([x, y]) => vTile(x, y, VC.gold));
    vMarks();
    info = i >= b.goalIdx + 1 ? 'Found the door! The shortest way is ' + b.dist[S.exit[1]][S.exit[0]] + ' steps. The search checked ' + (b.goalIdx + 1) + ' tiles to find it.'
                              : 'Tiles checked: ' + i + '. People waiting in the line (queue): ' + Math.max(0, hi - lo) + '.';
  } else if (m === 'tree'){
    vBase(() => VC.dim);
    S.steiner.forEach(key => { const [x, y] = key.split(',').map(Number); vTile(x, y, VC.teal); });
    pathTo(S.fs.prev, S.exit[0], S.exit[1]).forEach(([x, y]) => vTile(x, y, VC.gold));
    S.leaves.forEach(([x, y]) => vDot(x, y, VC.pink, 4));
    vMarks();
    info = 'Dead ends (leaf tips): ' + S.leaves.length + '. Best possible walk: ' + S.perfect + ' steps.';
  }
  $('vzInfo').textContent = info;
}
function vzSet(m){
  vzMode = m; cancelAnimationFrame(vzRaf);
  $('vzLegend').textContent = LEGEND[m] || '';
  const box = document.querySelector('.vizbox').parentNode;
  const show = !!ANIM[m];
  $('btnReplay').hidden = !show; $('vzSpeed').parentNode.hidden = !show;
  if (m === 'quiz') { vzMode = 'run'; drawViz('run', 0); return; }
  if (!show){ drawViz(m, 0); return; }
  vzPlay();
}
function vzPlay(){
  cancelAnimationFrame(vzRaf);
  const max = vzMax(vzMode), m = vzMode;
  let acc = 0, lt = performance.now();
  const tick = t => {
    if (m !== vzMode) return;
    acc += (t - lt) / 1000 * vzSpeed * 15; lt = t;
    const i = Math.min(max, Math.floor(acc));
    drawViz(m, i);
    if (i < max) vzRaf = requestAnimationFrame(tick);
  };
  vzRaf = requestAnimationFrame(tick);
}
function selectTab(name){
  document.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-selected', String(t.dataset.tab === name)));
  document.querySelectorAll('.pane').forEach(p => p.classList.toggle('active', p.id === 'pane-' + name));
  vzSet(name === 'quiz' ? 'run' : name);
  if (name === 'quiz'){ $('vzLegend').textContent = LEGEND.run; }
}
 
/* ---------- quiz ---------- */
const QUIZ = [
  {q:'People wait in a line at the canteen. Who gets served first?',
   o:['The person who joined the line first','The person who joined last','The tallest person','A random person'], a:0,
   why:'A line like this is a queue: first in, first out. The ghost uses a queue to decide which tile to check next.'},
  {q:'You put 3 plates in a pile. Which plate do you take off first?',
   o:['The one at the bottom','The one on top, the last one you put down','The one in the middle','Any plate, it does not matter'], a:1,
   why:'A pile of plates is a stack: last in, first out. The maze builder used a stack to remember where to go back to.'},
  {q:'The maze builder walks into a dead end. What does it do?',
   o:['It gives up','It goes back to the last spot that had another path','It knocks down every wall','It starts the whole maze again'], a:1,
   why:'Going back to try something else is called backtracking. You do the same when you take a wrong turn!'},
  {q:'A computer sees the maze as dots joined by lines. What is that called?',
   o:['A graph','A song','A bar chart','A pile of plates'], a:0,
   why:'Every tile is a dot and every step between tiles is a line. Subway maps and GPS roads are graphs too.'},
  {q:'How does the ghost find the shortest way to you?',
   o:['It guesses','It walks through walls','It checks close tiles first, then farther ones, like a ripple in a pond','It follows the loudest sound'], a:2,
   why:'This is BFS. Near tiles are always checked before far tiles, so the first time the ripple reaches you is the quickest way.'}
];
 
/* Sends the finished quiz to the Google Form (through the small web app in the Form's own script, QUIZ_URL). */
async function saveQuiz(score, total, answers, letters){
  if (!acct){ $('quizScore').textContent += '  (Not saved: log in to record your score.)'; return; }
  try {
    const r = await api({
      action: 'quiz',
      email: acct.email,
      name: nameInput.value.trim(),
      score: score,
      total: total,
      mode: diff,
      answers: answers.join(' | '),
      choices: letters
    }, QUIZ_URL);
    if (r.ok) $('quizScore').textContent += '  (Score saved!)';
    else if (r.duplicate) $('quizScore').textContent += '  (Your first score was already saved. This try is just for practice.)';
    else $('quizScore').textContent += '  (Not saved: ' + r.message + ')';
  } catch (e) {
    $('quizScore').textContent += '  (Could not save. Check your connection.)';
  }
}
function buildQuiz(){
  const box = $('quizBox'); box.innerHTML = ''; let answered = 0, score = 0;
  const picks = [], letters = [];                              // what the player chose, sent to the form
  $('quizScore').textContent = ''; $('btnQuizRetry').hidden = true;
  QUIZ.forEach((item, qi) => {
    const q = document.createElement('div'); q.className = 'q';
    const p = document.createElement('p'); p.textContent = item.q; q.appendChild(p);
    const opts = document.createElement('div'); opts.className = 'opts'; q.appendChild(opts);
    const why = document.createElement('div'); why.className = 'why'; why.textContent = item.why; q.appendChild(why);
    item.o.forEach((text, idx) => {
      const b = document.createElement('button'); b.className = 'opt'; b.textContent = text;
      b.addEventListener('click', () => {
        [...opts.children].forEach((c, ci) => { c.disabled = true; if (ci === item.a) c.classList.add('right'); });
        if (idx !== item.a) b.classList.add('wrong'); else score++;
        picks[qi] = 'Q' + (qi + 1) + ': ' + 'ABCD'[idx] + (idx === item.a ? ' (right)' : ' (wrong, answer ' + 'ABCD'[item.a] + ')');
        letters[qi] = 'ABCD'[idx];
        q.classList.add('done'); answered++;
        if (answered === QUIZ.length){
          $('quizScore').textContent = 'Score: ' + score + '/' + QUIZ.length + (score === QUIZ.length ? '. Perfect! You know the basics of data structures and algorithms!' : score >= 4 ? '. Great job! You get the main ideas.' : '. Good try! Peek at the tabs and have another go.');
          $('btnQuizRetry').hidden = false;
          saveQuiz(score, QUIZ.length, picks, letters);        // records it in the Google Form
        }
      });
      opts.appendChild(b);
    });
    box.appendChild(q);
  });
}
 

/* ---------- sign up / log in with Gmail + code (on the start menu, remembered on this device) ---------- */
async function api(body, url = API_URL){
  const r = await fetch(url, {method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body:JSON.stringify(body)});
  return r.json();
}
function setMsg(id, text, bad){
  const m = $(id); m.textContent = text; m.style.color = bad ? 'var(--bad)' : 'var(--ok)';
}
function fitStage(){                 // the menu scrolls inside the box; never stretch the stage
  $('stage').style.minHeight = '';
  const m = $('menu'); if (m) m.scrollTop = 0;
}
let acct = null;     // {email, token} once the Gmail is confirmed
try { acct = JSON.parse(localStorage.getItem('akm-acct') || 'null'); } catch (e) {}
function saveAcct(){
  try { if (acct) localStorage.setItem('akm-acct', JSON.stringify(acct)); else localStorage.removeItem('akm-acct'); } catch (e) {}
}
function syncNameField(){            // the name is only needed when signing up
  const loggedIn = !!(acct && acct.email && acct.token);
  const onLogin = !$('paneLogin').hidden;
  $('nameField').hidden = loggedIn || onLogin;
}
function showTab(which){
  const su = which === 'signup';
  $('paneSignup').hidden = !su; $('paneLogin').hidden = su;
  $('tabSignup').setAttribute('aria-selected', String(su));
  $('tabLogin').setAttribute('aria-selected', String(!su));
  $('authMsg').textContent = '';
  syncNameField();
  fitStage();
}
function renderAuth(){
  const on = !!(acct && acct.email && acct.token);
  $('authBox').hidden = on; $('whoLine').hidden = !on;
  if (on) $('loggedAs').textContent = acct.email;
  syncNameField();
  fitStage();
}
function logout(){
  nameInput.value = '';
  acct = null; saveAcct(); renderAuth(); showTab('login');
  ['suEmail', 'suCode', 'liEmail', 'liCode'].forEach(id => { $(id).value = ''; });
  $('suCodeRow').hidden = true; $('liCodeRow').hidden = true;
}
async function checkSession(){       // on page load: is the saved login still good?
  if (!acct) return;
  try {
    const r = await api({action:'session', email:acct.email, token:acct.token});
    if (!r.ok && r.relogin){ acct = null; saveAcct(); renderAuth(); }
    else if (r.ok && r.name) nameInput.value = r.name;
  } catch (e) {}                     // offline: keep the saved login
}

/* after a win: save the time (if logged in), then show the leaderboard */
function finishWinSoon(ms){
  const token = winToken;
  setTimeout(() => {
    if (token !== winToken || mode !== 'won') return;
    $('winbox').hidden = true;
    ($('board') || $('lesson')).scrollIntoView({behavior:reduceMotion() ? 'auto' : 'smooth', block:'start'});
  }, ms);
}
async function afterWin(){
  if (acct){ if (await submitTime()) finishWinSoon(2500); }
  else setMsg('saveMsg', 'You are not logged in, so this time was not saved. Choose New game, then sign up or log in.', true);
}
async function submitTime(){         // saves the time into this account's row, then refreshes the board
  const secs = Math.round(S.elapsed / 1000), md = diff;
  let ok = false;
  setMsg('saveMsg', 'Saving your time...');
  try {
    const r = await api({action:'submit', email:acct.email, token:acct.token, mode:md, seconds:secs});
    ok = !!r.ok;
    setMsg('saveMsg', r.message, !r.ok);
    if (!r.ok && r.relogin) logout();
  } catch (e){ setMsg('saveMsg', 'Could not save your time. Check your connection.', true); }
  try { await loadLeaderboard(API_URL); } catch (e) {}
  return ok;
}

// The sign up form and the log in form work the same way, each with its own inputs.
function wireAuth(kind, ids){
  const E = $(ids.email), SEND = $(ids.send), ROW = $(ids.row), CODE = $(ids.code), OK = $(ids.ok);
  SEND.addEventListener('click', async () => {
    const email = E.value.trim();
    if (!email) return setMsg('authMsg', 'Type your Gmail first.', true);
    if (kind === 'signup' && !nameInput.value.trim()) return setMsg('authMsg', 'Type your name first.', true);
    SEND.disabled = true; setMsg('authMsg', 'Sending the code...');
    try {
      const r = await api({action:'sendCode', kind, email});
      if (r.ok){
        setMsg('authMsg', r.message);
        ROW.hidden = false; CODE.focus();
        setTimeout(() => { SEND.disabled = false; }, 60000);
      } else {
        SEND.disabled = false;
        if (r.switchTo){                         // wrong form: send them to the right one
          showTab(r.switchTo);
          $(r.switchTo === 'login' ? 'liEmail' : 'suEmail').value = email;
        }
        setMsg('authMsg', r.message, true);
      }
    } catch (e){ setMsg('authMsg', 'Could not reach the server. Try again.', true); SEND.disabled = false; }
    fitStage();
  });
  OK.addEventListener('click', async () => {
    const email = E.value.trim(), code = CODE.value.trim();
    if (!code) return setMsg('authMsg', 'Type the 6-digit code.', true);
    OK.disabled = true; setMsg('authMsg', 'Checking...');
    try {
      const v = await api({action:'verifyCode', kind, email, code, name:nameInput.value.trim()});
      if (!v.ok){
        if (v.switchTo) showTab(v.switchTo);
        setMsg('authMsg', v.message, true);
      } else {
        acct = {email:v.email, token:v.token}; saveAcct();
        if (v.name) nameInput.value = v.name;
        ROW.hidden = true; CODE.value = '';
        renderAuth();
        setMsg('authMsg', 'Confirmed! You are logged in. Press Start.');
      }
    } catch (e){ setMsg('authMsg', 'Could not reach the server. Try again.', true); }
    OK.disabled = false; fitStage();
  });
}
wireAuth('signup', {email:'suEmail', send:'suSend', row:'suCodeRow', code:'suCode', ok:'suConfirm'});
wireAuth('login',  {email:'liEmail', send:'liSend', row:'liCodeRow', code:'liCode', ok:'liConfirm'});
$('tabSignup').addEventListener('click', () => showTab('signup'));
$('tabLogin').addEventListener('click', () => showTab('login'));
$('btnLogout').addEventListener('click', logout);

/* ---------- input ---------- */
const KEYDIR = {ArrowUp:[0,-1], ArrowDown:[0,1], ArrowLeft:[-1,0], ArrowRight:[1,0], w:[0,-1], s:[0,1], a:[-1,0], d:[1,0]};
const keyOf = e => e.key.length === 1 ? e.key.toLowerCase() : e.key;
addEventListener('keydown', e => {
  if (mode !== 'play' || (e.target && e.target.tagName === 'INPUT')) return;
  const d = KEYDIR[keyOf(e)]; if (!d) return;
  e.preventDefault();
  if (!held.includes(d)) held.push(d);
  queued = d;
});
addEventListener('keyup', e => {
  const d = KEYDIR[keyOf(e)]; if (!d) return;
  const i = held.indexOf(d); if (i >= 0) held.splice(i, 1);
});
addEventListener('blur', () => { held.length = 0; });
document.querySelectorAll('#dpad button').forEach(btn => {
  const d = btn.dataset.d.split(',').map(Number);
  const down = e => {
    e.preventDefault();
    if (mode !== 'play') return;
    if (!held.includes(d)) held.push(d);
    queued = d; btn.classList.add('on');
  };
  const up = () => { const i = held.indexOf(d); if (i >= 0) held.splice(i, 1); btn.classList.remove('on'); };
  btn.addEventListener('pointerdown', down);
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => btn.addEventListener(ev, up));
  btn.addEventListener('contextmenu', e => e.preventDefault());
});
let swipe0 = null;
canvas.addEventListener('touchstart', e => { if (mode !== 'play') return; const t = e.changedTouches[0]; swipe0 = [t.clientX, t.clientY]; }, {passive:true});
canvas.addEventListener('touchend', e => {
  if (mode !== 'play' || !swipe0) return;
  const t = e.changedTouches[0], dx = t.clientX - swipe0[0], dy = t.clientY - swipe0[1]; swipe0 = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
  S.slide = Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)];   // glide along the corridor
}, {passive:true});

document.querySelectorAll('.level').forEach(b => b.addEventListener('click', () => {
  diff = b.dataset.level;
  document.querySelectorAll('.level').forEach(x => x.setAttribute('aria-checked', String(x === b)));
  setup();
}));
seedInput.addEventListener('input', () => { if (seedInput.value.trim()) setup(); });
seedInput.addEventListener('blur', () => { if (!seedInput.value.trim()){ seedInput.value = randomSeed(); setup(); } });
$('btnDice').addEventListener('click', () => { seedInput.value = randomSeed(); setup(); });
$('btnStart').addEventListener('click', () => {
  if (!acct){ setMsg('authMsg', 'Sign up or log in first, or press "Play without saving my time".', true); fitStage(); return; }
  startGame();
});
$('btnGuest').addEventListener('click', startGame);
$('btnMenu').addEventListener('click', backToMenu);
$('btnAgain').addEventListener('click', startGame);
$('btnAgain2').addEventListener('click', backToMenu);
$('btnLearn').addEventListener('click', () => { winToken++; $('winbox').hidden = true; $('lesson').scrollIntoView({behavior:'smooth', block:'start'}); });
$('btnReplay').addEventListener('click', vzPlay);
$('btnQuizRetry').addEventListener('click', buildQuiz);
$('vzSpeed').addEventListener('input', e => { vzSpeed = +e.target.value; });
document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => selectTab(t.dataset.tab)));
$('tgSound').addEventListener('change', () => {
  applyAudio();
  if ($('tgSound').checked){ beep(520, .06); if (musicWanted) safePlay(bgMusic); }
});
$('volMusic').addEventListener('input', e => {
  musicVol = e.target.value / 100; saveVolumes();
  if (!fading) bgMusic.volume = musicVol;
});
$('volSfx').addEventListener('input', e => {
  sfxVol = e.target.value / 100; saveVolumes();
  cheerSfx.volume = sfxVol;
});
$('volSfx').addEventListener('change', () => beep(660, .06));   // little preview beep when you let go

renderAuth();
checkSession();
fitStage();
addEventListener('resize', fitStage);
addEventListener('load', fitStage);
applyAudio();
autoStartMusic();
seedInput.value = randomSeed();
setup();
requestAnimationFrame(frame);

/* ---------- leaderboard (built into this file; the board appears after a win) ---------- */
(function () {
  const MODES = [["cozy", "Cozy"], ["spooky", "Spooky"], ["nightmare", "Nightmare"]];
  const data = { cozy: [], spooky: [], nightmare: [] };   // rows: [name, seconds]
  let current = "cozy";
  const fmt = s => Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");

  const css = document.createElement("style");
  css.textContent =
    "#board[hidden]{display:none !important}" +
    "#board h2{font-size:clamp(12px,3vw,16px);color:var(--gold);margin:0 0 4px}" +
    "#board .note{color:var(--muted);font-size:18px;margin:0 0 10px}" +
    "#lbTabs{display:flex;gap:6px;margin-bottom:10px}" +
    ".lbtab{font-family:'Press Start 2P','Courier New',monospace;font-size:10px;color:var(--muted);background:var(--code);border:3px solid var(--line);padding:10px 12px;cursor:pointer}" +
    ".lbtab[aria-selected='true']{background:var(--accent);color:#fff}" +
    ".lbtab:focus-visible{outline:3px solid var(--gold);outline-offset:2px}" +
    "#lbList{list-style:none;margin:0;padding:0}" +
    "#lbList li{display:grid;grid-template-columns:38px 1fr auto;gap:10px;padding:6px 10px;background:var(--code);border:2px solid var(--panel-2);margin-bottom:6px}" +
    "#lbList .no{color:var(--muted)}#lbList li:first-child .no{color:var(--gold)}" +
    "#lbList b{font-weight:400;color:var(--gold)}";
  document.head.appendChild(css);

  const board = document.createElement("section");
  board.className = "panel"; board.id = "board"; board.hidden = true; board.style.marginTop = "18px";
  board.setAttribute("aria-label", "Top 5 per mode");
  board.innerHTML =
    '<h2 class="pixel">Top 5 Knights</h2><p class="note">Fastest escapes, per mode.</p>' +
    '<div id="lbTabs" role="tablist" aria-label="Game mode"></div><ol id="lbList"></ol>';
  document.getElementById("lesson").before(board);

  const tabs = board.querySelector("#lbTabs");
  MODES.forEach(([id, label]) => {
    const b = document.createElement("button");
    b.className = "lbtab"; b.setAttribute("role", "tab"); b.dataset.mode = id; b.textContent = label;
    b.addEventListener("click", () => { current = id; render(); });
    tabs.appendChild(b);
  });

  function render() {
    tabs.querySelectorAll(".lbtab").forEach(b => b.setAttribute("aria-selected", String(b.dataset.mode === current)));
    const ol = board.querySelector("#lbList"); ol.textContent = "";
    const rows = (data[current] || []).slice(0, 5);
    if (!rows.length) {
      ol.innerHTML = "<li><span></span><span>No players yet.</span><span></span></li>";
      return;
    }
    rows.forEach((r, i) => {
      const li = document.createElement("li");
      [["no", "#" + (i + 1)], ["", r[0]], ["", null]].forEach(([cls, text]) => {
        const s = document.createElement(text === null ? "b" : "span");
        s.className = cls; s.textContent = text === null ? fmt(r[1]) : text; li.appendChild(s);
      });
      ol.appendChild(li);
    });
  }

  // Loads data only. It never reveals the board.
  window.loadLeaderboard = async function (url) {
    const bust = url + (url.indexOf('?') >= 0 ? '&' : '?') + 't=' + Date.now();   // always fetch fresh scores
    const rows = await fetch(bust, {cache: 'no-store'}).then(r => r.json());
    rows.sort((a, b) => Number(a.seconds) - Number(b.seconds));                    // fastest first, always
    MODES.forEach(([id]) => {
      data[id] = rows.filter(r => r.mode === id).slice(0, 5).map(r => [r.name, r.seconds]);
    });
    render();
  };
  // Only this reveals it. Called from showLesson() in game.js after a win.
  window.showLeaderboard = function (mode) { if (data[mode]) current = mode; board.hidden = false; render(); };
  window.hideLeaderboard = function () { board.hidden = true; };
  render();
})();