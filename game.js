// game.js — 씬 1: 한서 집 골목 로직·좌표
// ★ 배치/수치 조정은 이 파일만 고치면 됨 (assets.js는 안 건드림)

// ===== 확정 렌더링 규격 =====
const WALL_TOTAL = 229, WALL_BODY_BOTTOM = 213;   // 담장 원본
const GATE_TOTAL = 305, GATE_BODY_BOTTOM = 303;   // 대문 원본
const WALL_OVERLAP_SRC = 50, WALL_DRAW_H = 150;   // 담장 겹침/그리기 높이
const SPR_W = 157, SPR_H = 262, CHAR_H = 105;     // 한서 스프라이트
const GROUND_LINE = 250, TILE = 90;
const SCALE = WALL_DRAW_H / WALL_TOTAL;

// ===== 씬 1 맵 크기 =====
const MAP_W = 2000, MAP_H = 520;

// ===== 담장 구간 (★조정 지점: x=시작, to=끝, gate=대문 비율위치) =====
// gate가 있으면 그 담장에 대문이 뚫림. 구간 사이 빈 곳은 담장 없는 '틈'(식물로 채움).
const WALL_RUNS = [
  { x: 55,   to: 560,  gate: 0.5, gateName: "한서의 집" }, // 한서 집 담장 (짧게)
  { x: 760,  to: 1120 },                                   // 틈: 560~760 (덤불)
  { x: 1300, to: 1560, gate: 0.5, gateName: "이웃집" },    // 틈: 1120~1300 (나무)
  { x: 1720, to: 1870 },                                   // 틈: 1560~1720 (덤불)
];

// ===== 담장 뒤 지붕 (★조정 지점: drawH=지붕 크기) =====
const ROOFS = [
  { key: "hanok_c", x: 150,  drawH: 175, srcW: 200, srcH: 158 },
  { key: "hanok_a", x: 850,  drawH: 165, srcW: 196, srcH: 145 },
  { key: "hanok_b", x: 1350, drawH: 160, srcW: 193, srcH: 138 },
];
ROOFS.forEach(r => { r.w = r.srcW * (r.drawH / r.srcH); r.y = GROUND_LINE - r.drawH - 34; });

// ===== 식물 자동 배치 (scatter.js 규칙 엔진 사용) =====
// 담장 구조(WALL_RUNS)만 주면 규칙대로 나무·덤불·풀·꽃이 배치됨.
// ★ 골목 분위기 조절은 아래 PLANT_OPTS만 고치면 됨.
const PLANT_OPTS = {
  groundLine: GROUND_LINE,
  mapW: MAP_W,
  seed: 42,              // 이 값만 바꿔도 배치가 매번 달라짐
  treeDensity: 1.0,      // 틈마다 나무 놓을 확률 (0~1)
  bushDensity: 0.8,      // 대문/틈 옆 덤불 확률
  grassDensity: 1.0,     // 바닥 풀 양
  flowerDensity: 0.5,    // 꽃 확률
  // treeSet, bushSet, grassSet, flowerSet 로 종류도 지정 가능 (생략 시 전체)
};
const PLANTS = scatterPlants(WALL_RUNS, PLANT_OPTS);

// ===== 엔진 (아래는 웬만하면 안 건드림) =====
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const imgs = {};
Object.keys(ASSETS).forEach(k => {
  const im = new Image();
  im.src = "data:image/png;base64," + ASSETS[k];
  imgs[k] = im;
});

let player = { x: 280, y: 340, speed: 3.6, dir: "front", moving: false, frame: 0, timer: 0 };
const camera = { x: 0 };
const keys = {};
let transition = { active: false, alpha: 0, done: false };

window.addEventListener("keydown", e => {
  keys[e.key] = true;
  if (e.key.startsWith("Arrow") || e.key === " ") e.preventDefault();
});
window.addEventListener("keyup", e => { keys[e.key] = false; });

function charDims() { return { w: CHAR_H * (SPR_W / SPR_H), h: CHAR_H }; }

function gatePositions() {
  const gates = [];
  WALL_RUNS.forEach(r => {
    if (r.gate !== undefined && imgs.gate.width) {
      const gateW = imgs.gate.width * SCALE;
      const gx = r.x + (r.to - r.x - gateW) * r.gate;
      gates.push({ x: gx, w: gateW, name: r.gateName });
    }
  });
  return gates;
}

function update() {
  if (transition.active) {
    if (!transition.done) {
      transition.alpha = Math.min(1, transition.alpha + 0.03);
      if (transition.alpha >= 1) transition.done = true;
    } else if (keys["Enter"]) {
      transition = { active: false, alpha: 0, done: false };
      player.x = MAP_W - 220;
    }
    return;
  }
  let dx = 0, dy = 0; player.moving = false;
  if (keys["ArrowLeft"])  { dx -= player.speed; player.dir = "left";  player.moving = true; }
  if (keys["ArrowRight"]) { dx += player.speed; player.dir = "right"; player.moving = true; }
  if (keys["ArrowUp"])    { dy -= player.speed; player.dir = "back";  player.moving = true; }
  if (keys["ArrowDown"])  { dy += player.speed; player.dir = "front"; player.moving = true; }

  const { w, h } = charDims();
  player.x = Math.max(60, Math.min(MAP_W - w - 10, player.x + dx));
  player.y = Math.max(GROUND_LINE - h * 0.3, Math.min(MAP_H - h - 10, player.y + dy));

  if (player.moving) { player.timer++; if (player.timer > 5) { player.frame = (player.frame + 1) % 2; player.timer = 0; } }
  else player.frame = 0;

  if (player.x > MAP_W - 150) transition.active = true;
  camera.x = Math.max(0, Math.min(MAP_W - canvas.width, player.x - canvas.width / 2));
}

function getSprite() {
  if (!player.moving) return { img: imgs["idle_" + player.dir], flip: false };
  const w = player.frame === 0 ? imgs.walk1 : imgs.walk2;
  if (player.dir === "left")  return { img: w, flip: false };
  if (player.dir === "right") return { img: w, flip: true };
  return { img: imgs["idle_" + player.dir], flip: false };
}

function nearGate() {
  for (const g of gatePositions()) {
    if (Math.abs(player.x - (g.x + g.w / 2)) < 60 && player.y < GROUND_LINE + 40) return g;
  }
  return null;
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(-camera.x, 0);

  // 하늘
  ctx.fillStyle = "#2b2b33";
  ctx.fillRect(camera.x, 0, canvas.width, GROUND_LINE - 40);

  // 바닥
  const dirt = imgs.tile_dirt;
  if (dirt.complete) {
    const sx = Math.floor(camera.x / TILE) * TILE;
    for (let x = sx; x < camera.x + canvas.width + TILE; x += TILE)
      for (let y = GROUND_LINE - 40; y < MAP_H; y += TILE)
        ctx.drawImage(dirt, x, y, TILE, TILE);
  }

  // 1) 집 지붕 (담장 뒤)
  ROOFS.forEach(r => { const im = imgs[r.key]; if (im.complete) ctx.drawImage(im, r.x, r.y, r.w, r.drawH); });

  // 1-b) 담장 뒤 큰 나무 (담장보다 먼저 = 뒤에 깔림)
  PLANTS.filter(p => p.layer === "back").forEach(p => {
    const im = imgs[p.key];
    if (im && im.complete) ctx.drawImage(im, p.x, p.y, p.w, p.h);
  });

  // 2) 담장 구간
  const ws = imgs.wall_single;
  if (ws.complete) {
    const wallDrawH = WALL_TOTAL * SCALE, singleW = ws.width * SCALE, overlap = WALL_OVERLAP_SRC * SCALE;
    const wallY = GROUND_LINE - (WALL_BODY_BOTTOM * SCALE);
    WALL_RUNS.forEach(r => {
      let x = r.x;
      while (x < r.to) { ctx.drawImage(ws, x, wallY, singleW, wallDrawH); x += singleW - overlap; }
    });
  }

  // 3) 대문 (담장 위 겹침)
  const gate = imgs.gate;
  if (gate.complete) {
    const gateDrawH = GATE_TOTAL * SCALE;
    const gateY = GROUND_LINE - (GATE_BODY_BOTTOM * SCALE);
    gatePositions().forEach(g => { ctx.drawImage(gate, g.x, gateY, g.w, gateDrawH); });
  }

  // 오른쪽 전환 존
  ctx.fillStyle = "rgba(255,220,120,0.15)";
  ctx.fillRect(MAP_W - 130, GROUND_LINE - 40, 130, MAP_H - (GROUND_LINE - 40));
  ctx.fillStyle = "#ffdc78";
  ctx.font = "14px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("→ 종로 대로", MAP_W - 65, GROUND_LINE - 55);

  // 앞쪽 식물 + 캐릭터를 발 위치(y+높이) 기준으로 깊이 정렬해 그림
  const { w, h } = charDims();
  const sp = getSprite();
  const drawList = [];
  // 앞쪽 식물
  PLANTS.filter(p => p.layer === "front").forEach(p => {
    drawList.push({ footY: p.baseY, draw: () => {
      const im = imgs[p.key];
      if (im && im.complete) ctx.drawImage(im, p.x, p.y, p.w, p.h);
    }});
  });
  // 캐릭터 (발끝 = player.y + h)
  drawList.push({ footY: player.y + h, draw: () => {
    if (sp.img && sp.img.complete) {
      ctx.save();
      if (sp.flip) { ctx.translate(player.x + w, player.y); ctx.scale(-1, 1); ctx.drawImage(sp.img, 0, 0, w, h); }
      else ctx.drawImage(sp.img, player.x, player.y, w, h);
      ctx.restore();
    }
  }});
  // footY 작은 것(뒤)부터 → 큰 것(앞)이 위에 그려짐
  drawList.sort((a, b) => a.footY - b.footY);
  drawList.forEach(d => d.draw());

  ctx.restore();

  // UI
  const g = nearGate();
  if (g && !transition.active) {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(canvas.width / 2 - 120, 20, 240, 32);
    ctx.fillStyle = "#fff";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(g.name + " 대문", canvas.width / 2, 41);
  }
  if (transition.active) {
    ctx.fillStyle = "rgba(0,0,0," + transition.alpha + ")";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (transition.done) {
      ctx.fillStyle = "#fff";
      ctx.font = "18px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("로딩... 종로 대로 (씬 2 연결 예정)", canvas.width / 2, canvas.height / 2 - 10);
      ctx.font = "13px sans-serif";
      ctx.fillStyle = "#aaa";
      ctx.fillText("Enter 키로 골목으로 돌아가기", canvas.width / 2, canvas.height / 2 + 22);
    }
  }
}

function loop() { update(); draw(); requestAnimationFrame(loop); }
loop();
