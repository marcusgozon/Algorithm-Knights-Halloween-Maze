"use strict";
/* maze-logic.js
   The "Data Structures & Algorithms" part of the game.
   Nothing in here touches the screen. It only works with arrays and numbers,
   so you can read it, test it, and reuse it on its own.
*/

// The 4 directions you can walk: right, left, down, up
const D4 = [[1,0],[-1,0],[0,1],[0,-1]];

function hashStr(str){
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++){ h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}
function mulberry32(a){
  return function(){
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(arr, rand){
  for (let i = arr.length - 1; i > 0; i--){ const j = Math.floor(rand() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}
/* Depth-first maze generation with an explicit stack. Records every step for the visualizer. */
function generate(cols, rows, rand){
  const g = Array.from({length: rows}, () => Array(cols).fill(1));
  const gen = [];
  const stack = [[1, 1]];
  g[1][1] = 0;
  gen.push({x:1, y:1, px:-1, py:-1, t:'v'});
  const dirs = [[2,0],[-2,0],[0,2],[0,-2]];
  while (stack.length){
    const [cx, cy] = stack[stack.length - 1];
    const opts = dirs.filter(([dx, dy]) => {
      const nx = cx + dx, ny = cy + dy;
      return nx > 0 && ny > 0 && nx < cols - 1 && ny < rows - 1 && g[ny][nx] === 1;
    });
    if (opts.length){
      const [dx, dy] = opts[Math.floor(rand() * opts.length)];
      g[cy + dy / 2][cx + dx / 2] = 0;
      g[cy + dy][cx + dx] = 0;
      stack.push([cx + dx, cy + dy]);
      gen.push({x:cx + dx, y:cy + dy, px:cx, py:cy, t:'v'});
    } else {
      stack.pop();
      gen.push({x:cx, y:cy, px:-1, py:-1, t:'b'});
    }
  }
  return {g, gen};
}
/* Breadth-first search over open tiles with a queue (index pointer = O(1) dequeue). */
function bfs(g, sx, sy, tx, ty){
  const rows = g.length, cols = g[0].length;
  const dist = Array.from({length: rows}, () => Array(cols).fill(-1));
  const prev = Array.from({length: rows}, () => Array(cols).fill(null));
  const q = [[sx, sy]], order = [];
  dist[sy][sx] = 0;
  let head = 0;
  while (head < q.length){
    const [x, y] = q[head++];
    order.push([x, y]);
    if (x === tx && y === ty) break;
    for (const [dx, dy] of D4){
      const nx = x + dx, ny = y + dy;
      if (g[ny] && g[ny][nx] === 0 && dist[ny][nx] < 0){
        dist[ny][nx] = dist[y][x] + 1; prev[ny][nx] = [x, y]; q.push([nx, ny]);
      }
    }
  }
  return {dist, prev, order};
}
function pathTo(prev, tx, ty){
  const p = []; let c = [tx, ty];
  while (c){ p.push(c); c = prev[c[1]][c[0]]; }
  return p.reverse();
}
/* Same BFS but records the queue so the visualizer can replay it. */
function bfsTrace(g, sx, sy, tx, ty){
  const rows = g.length, cols = g[0].length;
  const dist = Array.from({length: rows}, () => Array(cols).fill(-1));
  const prev = Array.from({length: rows}, () => Array(cols).fill(null));
  const q = [[sx, sy]], disc = [];
  dist[sy][sx] = 0;
  let head = 0, goalIdx = -1;
  while (head < q.length){
    const [x, y] = q[head];
    if (x === tx && y === ty){ goalIdx = head; disc.push(q.length); break; }
    for (const [dx, dy] of D4){
      const nx = x + dx, ny = y + dy;
      if (g[ny] && g[ny][nx] === 0 && dist[ny][nx] < 0){
        dist[ny][nx] = dist[y][x] + 1; prev[ny][nx] = [x, y]; q.push([nx, ny]);
      }
    }
    head++; disc.push(q.length);
  }
  return {q, disc, goalIdx, prev, dist};
}
/* Break some walls on purpose so the maze has LOOPS (used for the ghost levels).
   A wall is only opened if the two tiles on either side are already far apart by walking
   (>= minGap steps). That makes every new loop big enough to run around, not a tiny 4-tile circle.
   Walls sit between "cell" tiles, so opening one never creates a 2x2 open room. */
function addLoops(g, rand, count, minGap){
  const rows = g.length, cols = g[0].length, walls = [];
  for (let y = 1; y < rows - 1; y++) for (let x = 1; x < cols - 1; x++){
    if (g[y][x] !== 1) continue;
    if (x % 2 === 1 && y % 2 === 0 && g[y-1][x] === 0 && g[y+1][x] === 0) walls.push([x, y, x, y-1, x, y+1]);
    else if (x % 2 === 0 && y % 2 === 1 && g[y][x-1] === 0 && g[y][x+1] === 0) walls.push([x, y, x-1, y, x+1, y]);
  }
  shuffle(walls, rand);
  let added = 0;
  for (const gap of [minGap, Math.ceil(minGap / 2), 6]){
    for (const [wx, wy, ax, ay, bx, by] of walls){
      if (added >= count) return added;
      if (g[wy][wx] === 0) continue;
      const d = bfs(g, ax, ay).dist[by][bx];            // walking distance before the wall is opened
      if (d >= gap){ g[wy][wx] = 0; added++; }
    }
  }
  return added;
}
/* Shortest walk that starts at the start, visits every candy (any order) and ends at the door.
   Works with loops too: try every candy order (at most 6 candies = 720 orders) and keep the shortest. */
function perfectRun(g, start, exit, candies){
  const pts = [start, ...candies, exit], n = pts.length;
  const runs = pts.map(p => bfs(g, p[0], p[1]));        // distances from every important tile
  const d = (i, j) => runs[i].dist[pts[j][1]][pts[j][0]];
  let best = Infinity, bestOrder = null;
  const mids = candies.map((_, i) => i + 1);
  (function permute(order, left, len, last){
    if (len >= best) return;
    if (!left.length){
      const total = len + d(last, n - 1);
      if (total < best){ best = total; bestOrder = order.slice(); }
      return;
    }
    left.forEach((k, i) => {
      permute(order.concat(k), left.filter((_, j) => j !== i), len + d(last, k), k);
    });
  })([], mids, 0, 0);
  const route = [0, ...bestOrder, n - 1], marked = new Set();
  for (let i = 0; i < route.length - 1; i++){
    const b = runs[route[i]], t = pts[route[i + 1]];
    let c = [t[0], t[1]];
    while (c && !(c[0] === pts[route[i]][0] && c[1] === pts[route[i]][1])){ marked.add(c[0] + ',' + c[1]); c = b.prev[c[1]][c[0]]; }
  }
  return {len: best, marked};
}
function degree(g, x, y){
  let n = 0;
  for (const [dx, dy] of D4) if (g[y + dy] && g[y + dy][x + dx] === 0) n++;
  return n;
}
