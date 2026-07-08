// scatter.js — 식물 자동 배치 규칙 엔진
// 담장 구조(WALL_RUNS)와 파라미터를 주면 PLANTS 배열을 규칙에 따라 생성.
// 골목마다 담장만 바꾸면 식물이 알아서 그 구조에 맞춰 배치됨.

// 식물 원본 크기 (비율 유지용) — assets와 동일
const PLANT_SIZES = {
  tree_big1:[139,131], tree_big2:[195,233], tree_pine:[216,164], tree_will:[156,193], tree_pine2:[181,185],
  bush1:[96,77], bush2:[105,90], bush3:[95,74], bush4:[116,67],
  grass1:[67,63], grass2:[85,86], grass3:[58,45], grass_tall:[85,76], weed1:[99,59], sprout:[56,78],
  reed:[82,180], flower_y:[99,67], flower_p:[102,63], flower_w:[78,60], flower_mix:[77,66],
};

// 시드 기반 난수 (seed 같으면 배치 재현 가능)
function makeRng(seed) {
  let s = seed >>> 0;
  return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// 카테고리별 후보 (파라미터에서 종류 지정 가능)
const PLANT_SETS = {
  trees: ["tree_big1", "tree_big2", "tree_pine", "tree_will", "tree_pine2"],
  bushes: ["bush1", "bush2", "bush3", "bush4"],
  grasses: ["grass1", "grass2", "grass3", "grass_tall", "weed1", "sprout"],
  flowers: ["flower_y", "flower_p", "flower_w", "flower_mix"],
};

// 규칙 엔진 본체.
// wallRuns: [{x,to,gate?}] 담장 구간 배열
// opts: {
//   groundLine, seed,
//   treeSet, bushSet, grassSet, flowerSet,   // 쓸 종류 (기본 전체)
//   treeDensity, bushDensity, grassDensity, flowerDensity,  // 0~1
//   mapW,
// }
function scatterPlants(wallRuns, opts = {}) {
  const GL = opts.groundLine ?? 250;
  const mapW = opts.mapW ?? 2000;
  const rng = makeRng(opts.seed ?? 12345);
  const pick = arr => arr[Math.floor(rng() * arr.length)];

  const treeSet   = opts.treeSet   ?? PLANT_SETS.trees;
  const bushSet   = opts.bushSet   ?? PLANT_SETS.bushes;
  const grassSet  = opts.grassSet  ?? PLANT_SETS.grasses;
  const flowerSet = opts.flowerSet ?? PLANT_SETS.flowers;

  const treeD   = opts.treeDensity   ?? 1.0;   // 틈마다 나무 놓을 확률
  const bushD   = opts.bushDensity   ?? 0.8;   // 대문/틈 옆 덤불 확률
  const grassD  = opts.grassDensity  ?? 1.0;   // 바닥 풀 양(계수)
  const flowerD = opts.flowerDensity ?? 0.5;   // 꽃 확률

  const out = [];
  const add = (key, x, baseY, h, layer) => {
    const sz = PLANT_SIZES[key];
    out.push({ key, x: Math.round(x), baseY: Math.round(baseY), h: Math.round(h),
               srcW: sz[0], srcH: sz[1], layer });
  };

  // 담장 구간을 x순 정렬하고, 구간 사이 '틈' 계산
  const runs = [...wallRuns].sort((a, b) => a.x - b.x);
  const gaps = [];
  for (let i = 0; i < runs.length - 1; i++) {
    const gStart = runs[i].to, gEnd = runs[i + 1].x;
    if (gEnd - gStart > 40) gaps.push({ x: gStart, to: gEnd, mid: (gStart + gEnd) / 2 });
  }
  // 맵 양끝 여백도 틈으로 (왼쪽 끝, 오른쪽 끝)
  if (runs.length && runs[0].x > 60) gaps.unshift({ x: 0, to: runs[0].x, mid: runs[0].x / 2 });

  // 규칙 1: 틈마다 담장 뒤 큰 나무 (treeD 확률)
  gaps.forEach(g => {
    if (rng() < treeD) {
      const key = pick(treeSet);
      const h = 190 + rng() * 70;         // 190~260
      add(key, g.mid - 40 + rng() * 20, GL + 8, h, "back");
    }
  });

  // 규칙 2: 대문 양옆에 덤불 (bushD 확률)
  runs.forEach(r => {
    if (r.gate === undefined) return;
    const gateW = 200 * (150 / 229);      // 대략적 대문 폭
    const gateX = r.x + (r.to - r.x - gateW) * r.gate;
    [gateX - 30, gateX + gateW - 20].forEach(bx => {
      if (rng() < bushD) {
        const key = pick(bushSet);
        const h = 68 + rng() * 20;
        add(key, bx, GL + 16 + rng() * 8, h, "front");
      }
    });
  });

  // 규칙 3: 틈에 덤불 하나씩 (담장 끊긴 곳 자연스럽게 메움)
  gaps.forEach(g => {
    if (rng() < bushD * 0.7) {
      const key = pick(bushSet);
      const h = 66 + rng() * 18;
      add(key, g.mid + 20 + rng() * 30, GL + 18, h, "front");
    }
  });

  // 규칙 4: 담장 밑동 따라 풀 흩뿌림 (grassD 계수로 양 조절)
  runs.forEach(r => {
    const spacing = 260 / Math.max(grassD, 0.1);   // 밀도 높을수록 촘촘
    for (let x = r.x + 40; x < r.to - 40; x += spacing) {
      if (rng() < 0.7) {
        const key = pick(grassSet);
        const h = 38 + rng() * 20;
        add(key, x + rng() * 40, GL + 6 + rng() * 14, h, "front");
      }
    }
  });

  // 규칙 5: 바닥 여기저기 풀 (담장 앞 넓은 바닥)
  const nBottom = Math.floor((mapW / 500) * grassD * 2);
  for (let i = 0; i < nBottom; i++) {
    const key = pick(grassSet);
    const h = 40 + rng() * 16;
    add(key, rng() * (mapW - 100) + 40, GL + 80 + rng() * 120, h, "front");
  }

  // 규칙 6: 꽃 포인트 (flowerD 확률로 군데군데)
  const nFlower = Math.floor(gaps.length * flowerD * 2);
  for (let i = 0; i < nFlower; i++) {
    const key = pick(flowerSet);
    const h = 48 + rng() * 12;
    add(key, rng() * (mapW - 200) + 100, GL + 10 + rng() * 40, h, "front");
  }

  // 계산 필드 채우기 (game.js와 동일 방식)
  out.forEach(p => { p.w = p.srcW * (p.h / p.srcH); p.y = p.baseY - p.h; });
  return out;
}

// 브라우저/노드 양쪽에서 쓸 수 있게
if (typeof module !== "undefined") module.exports = { scatterPlants, PLANT_SIZES, PLANT_SETS };
