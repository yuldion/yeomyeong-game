// game2.js — 씬 2: 종로 대로 로직·좌표
// 씬1(game.js)과 같은 방식: 배치/수치 조정은 이 파일만 고치면 됨
// assets.js(공용) + assets2.js(씬2 전용) 로드 후 실행됨

// ===== 씬1과 공유하는 렌더링 규격 =====
const SPR_W = 157, SPR_H = 262, CHAR_H = 105;   // 한서 스프라이트
const GROUND_LINE = 250, TILE = 96;

// ===== 씬 2 맵 크기 (씬1보다 넓은 "대로" 느낌) =====
const MAP_W = 2600, MAP_H = 520;

// ===== 건물 배치 (★조정 지점: x=위치, drawH=높이, name=간판 이름 있으면 표시) =====
// 씬1 ROOFS와 동일한 방식: 원본 비율 유지, drawH만 지정하면 w는 자동 계산.
const BUILDINGS = [
  { key: "bld_yakbang",       x: 140,  drawH: 155, srcW: 170, srcH: 152, name: "약방" },
  { key: "bld_hanok_house1",  x: 420,  drawH: 145, srcW: 196, srcH: 145 },
  { key: "bld_japhwa",        x: 660,  drawH: 150, srcW: 161, srcH: 144, name: "잡화점" },
  { key: "bld_12",            x: 900,  drawH: 150, srcW: 131, srcH: 147 },
  { key: "bld_uiwon",         x: 1120, drawH: 178, srcW: 157, srcH: 156, name: "경성의원" },
  { key: "bld_20",            x: 1380, drawH: 140, srcW: 115, srcH: 135 },
  { key: "bld_yangbokjeom",   x: 1580, drawH: 155, srcW: 160, srcH: 150, name: "양복점" },
  { key: "bld_shop2f",        x: 1820, drawH: 188, srcW: 127, srcH: 157 },
  { key: "bld_gatehouse",     x: 2080, drawH: 172, srcW: 200, srcH: 158 },
];
BUILDINGS.forEach(b => { b.w = b.srcW * (b.drawH / b.srcH); b.y = GROUND_LINE - b.drawH + 14; });

// ===== NPC 배치 (★조정 지점) =====
// type "static": 제자리 고정, 플레이어 접근 시 idle→react 스프라이트 전환
// type "patrol": range[0]~range[1] 사이를 왕복. walk1/walk2 있으면 걷기 애니메이션
const NPCS = [
  { id: "yakbang", name: "약방주인", type: "static",
    idleKey: "npc_yakbang_idle", reactKey: "npc_yakbang_react",
    x: 195, footY: 345, dispH: 112, srcW: 110, srcH: 232 },
  { id: "sunsa", name: "순사", type: "static",
    idleKey: "npc_sunsa_idle", reactKey: "npc_sunsa_react",
    x: 1020, footY: 345, dispH: 122, srcW: 209, srcH: 329 },
  { id: "sinsa", name: "신사", type: "patrol", speed: 0.7,
    idleKey: "npc_sinsa_idle", walk1Key: "npc_sinsa_walk1", walk2Key: "npc_sinsa_walk2",
    x: 1650, range: [1580, 1920], footY: 345, dispH: 108, srcW: 136, srcH: 219 },
  { id: "grandpa", name: "단골아저씨", type: "patrol", speed: 0.5,
    idleKey: "npc_grandpa_idle", walk1Key: "npc_grandpa_walk1", walk2Key: "npc_grandpa_walk2",
    x: 500, range: [360, 780], footY: 348, dispH: 96, srcW: 82, srcH: 138 },
];
NPCS.forEach(n => {
  n.h = n.dispH; n.w = n.srcW * (n.dispH / n.srcH); n.y = n.footY - n.h;
  n.dir = 1; n.frame = 0; n.timer = 0;
});

// ===== 엔진 =====
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const imgs = {};
Object.keys(ASSETS).forEach(k => {
  const im = new Image();
  im.src = "data:image/png;base64," + ASSETS[k];
  imgs[k] = im;
});

// 씬1 오른쪽 끝에서 넘어오면 왼쪽 진입 지점에서 시작
let player = { x: 200, y: 340, speed: 3.6, dir: "front", moving: false, frame: 0, timer: 0 };
let cloudOffset = 0;
const camera = { x: 0 };
const keys = {};
// transition.dir: "back"(씬1로) / "forward"(다음 구역, 아직 미구현 → 제자리 복귀)
let transition = { active: false, alpha: 0, done: false, dir: null };

window.addEventListener("keydown", e => {
  keys[e.key] = true;
  if (e.key.startsWith("Arrow") || e.key === " ") e.preventDefault();
});
window.addEventListener("keyup", e => { keys[e.key] = false; });

function charDims() { return { w: CHAR_H * (SPR_W / SPR_H), h: CHAR_H }; }

function update() {
  cloudOffset += 0.15;

  // NPC 패트롤 이동
  NPCS.forEach(n => {
    if (n.type !== "patrol") return;
    n.x += n.dir * n.speed;
    if (n.x < n.range[0]) { n.x = n.range[0]; n.dir = 1; }
    if (n.x > n.range[1]) { n.x = n.range[1]; n.dir = -1; }
    n.timer++;
    if (n.timer > 8) { n.frame = (n.frame + 1) % 2; n.timer = 0; }
  });

  if (transition.active) {
    if (!transition.done) {
      transition.alpha = Math.min(1, transition.alpha + 0.03);
      if (transition.alpha >= 1) transition.done = true;
    } else if (keys["Enter"]) {
      if (transition.dir === "back") {
        location.href = "index.html";
      } else {
        // 시장 구간은 아직 없음 → 대로 오른쪽 끝에서 되돌아옴
        transition = { active: false, alpha: 0, done: false, dir: null };
        player.x = MAP_W - 220;
      }
    }
    return;
  }

  let dx = 0, dy = 0; player.moving = false;
  if (keys["ArrowLeft"])  { dx -= player.speed; player.dir = "left";  player.moving = true; }
  if (keys["ArrowRight"]) { dx += player.speed; player.dir = "right"; player.moving = true; }
  if (keys["ArrowUp"])    { dy -= player.speed; player.dir = "back";  player.moving = true; }
  if (keys["ArrowDown"])  { dy += player.speed; player.dir = "front"; player.moving = true; }

  const { w, h } = charDims();
  player.x = Math.max(10, Math.min(MAP_W - w - 10, player.x + dx));
  player.y = Math.max(GROUND_LINE - h * 0.3, Math.min(MAP_H - h - 10, player.y + dy));

  if (player.moving) { player.timer++; if (player.timer > 5) { player.frame = (player.frame + 1) % 2; player.timer = 0; } }
  else player.frame = 0;

  if (player.x > MAP_W - 150) transition = { active: true, alpha: 0, done: false, dir: "forward" };
  if (player.x < 60) transition = { active: true, alpha: 0, done: false, dir: "back" };

  camera.x = Math.max(0, Math.min(MAP_W - canvas.width, player.x - canvas.width / 2));
}

function getSprite() {
  if (!player.moving) return { img: imgs["idle_" + player.dir], flip: false };
  const w = player.frame === 0 ? imgs.walk1 : imgs.walk2;
  if (player.dir === "left")  return { img: w, flip: false };
  if (player.dir === "right") return { img: w, flip: true };
  return { img: imgs["idle_" + player.dir], flip: false };
}

function npcSprite(n) {
  const near = Math.abs(player.x - n.x) < 70 && player.y < GROUND_LINE + 40;
  if (n.type === "static") {
    return imgs[near && n.reactKey ? n.reactKey : n.idleKey];
  }
  // patrol: 걷는 중이면 walk1/walk2 번갈아, 방향전환 순간엔 idle
  const key = n.frame === 0 ? n.walk1Key : n.walk2Key;
  return imgs[key] || imgs[n.idleKey];
}

function nearInfo() {
  // 이름 있는 건물
  for (const b of BUILDINGS) {
    if (!b.name) continue;
    const cx = b.x + b.w / 2;
    if (Math.abs(player.x - cx) < 70 && player.y < GROUND_LINE + 40) return b.name;
  }
  // NPC
  for (const n of NPCS) {
    if (Math.abs(player.x - n.x) < 60 && player.y < GROUND_LINE + 40) return n.name;
  }
  return null;
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(-camera.x, 0);

  // 하늘 (씬1과 동일 에셋 재사용)
  const SKY_H = GROUND_LINE - 40;
  const sky = imgs.sky_day;
  if (sky && sky.complete) ctx.drawImage(sky, 0, 0, MAP_W, SKY_H);
  else { ctx.fillStyle = "#7bb0dd"; ctx.fillRect(0, 0, MAP_W, SKY_H); }

  // 구름 (씬1 CLOUDS 데이터 재사용 대신 간단히 몇 개만 흘려보냄)
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, MAP_W, SKY_H);
  ctx.clip();
  [{ key: "cloud_0", x: 200, y: 12, w: 70 }, { key: "cloud_2", x: 1200, y: 30, w: 100 },
   { key: "cloud_4", x: 2100, y: 16, w: 110 }].forEach(c => {
    const im = imgs[c.key];
    if (!im || !im.complete) return;
    const ch = im.height * (c.w / im.width);
    let cx = c.x + cloudOffset;
    cx = ((cx % (MAP_W + 300)) + (MAP_W + 300)) % (MAP_W + 300) - 150;
    ctx.drawImage(im, cx, c.y, c.w, ch);
  });
  ctx.restore();

  // 바닥 (돌길 타일)
  const stone = imgs.tile_stone_gray;
  if (stone && stone.complete) {
    const sx = Math.floor(camera.x / TILE) * TILE;
    for (let x = sx; x < camera.x + canvas.width + TILE; x += TILE)
      for (let y = GROUND_LINE - 40; y < MAP_H; y += TILE)
        ctx.drawImage(stone, x, y, TILE, TILE);
  }

  // 건물 (배경, 충돌 없음 — 씬1의 담장/지붕과 같은 역할)
  BUILDINGS.forEach(b => {
    const im = imgs[b.key];
    if (im && im.complete) ctx.drawImage(im, b.x, b.y, b.w, b.drawH);
  });

  // 왼쪽 전환 존 (씬1로 복귀)
  ctx.fillStyle = "rgba(255,220,120,0.12)";
  ctx.fillRect(0, GROUND_LINE - 40, 60, MAP_H - (GROUND_LINE - 40));
  // 오른쪽 전환 존 (다음 구역 예정)
  ctx.fillStyle = "rgba(255,220,120,0.15)";
  ctx.fillRect(MAP_W - 130, GROUND_LINE - 40, 130, MAP_H - (GROUND_LINE - 40));
  ctx.fillStyle = "#ffdc78";
  ctx.font = "14px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("→ 시장 (예정)", MAP_W - 65, GROUND_LINE - 55);
  ctx.fillText("← 한서 집 골목", 65, GROUND_LINE - 55);

  // 캐릭터 + NPC를 발 위치 기준 깊이 정렬
  const { w, h } = charDims();
  const sp = getSprite();
  const drawList = [];
  NPCS.forEach(n => {
    drawList.push({ footY: n.footY, draw: () => {
      const im = npcSprite(n);
      if (im && im.complete) ctx.drawImage(im, n.x - n.w / 2, n.y, n.w, n.h);
    }});
  });
  drawList.push({ footY: player.y + h, draw: () => {
    if (sp.img && sp.img.complete) {
      ctx.save();
      if (sp.flip) { ctx.translate(player.x + w, player.y); ctx.scale(-1, 1); ctx.drawImage(sp.img, 0, 0, w, h); }
      else ctx.drawImage(sp.img, player.x, player.y, w, h);
      ctx.restore();
    }
  }});
  drawList.sort((a, b) => a.footY - b.footY);
  drawList.forEach(d => d.draw());

  ctx.restore();

  // UI: 이름 표시
  const info = nearInfo();
  if (info && !transition.active) {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(canvas.width / 2 - 120, 20, 240, 32);
    ctx.fillStyle = "#fff";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(info, canvas.width / 2, 41);
  }
  if (transition.active) {
    ctx.fillStyle = "rgba(0,0,0," + transition.alpha + ")";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (transition.done) {
      ctx.fillStyle = "#fff";
      ctx.font = "18px sans-serif";
      ctx.textAlign = "center";
      if (transition.dir === "back") {
        ctx.fillText("한서 집 골목으로 이동", canvas.width / 2, canvas.height / 2 - 10);
      } else {
        ctx.fillText("시장 (씬 3 연결 예정)", canvas.width / 2, canvas.height / 2 - 10);
      }
      ctx.font = "13px sans-serif";
      ctx.fillStyle = "#aaa";
      ctx.fillText("Enter 키로 이동", canvas.width / 2, canvas.height / 2 + 22);
    }
  }
}

function loop() { update(); draw(); requestAnimationFrame(loop); }
loop();
