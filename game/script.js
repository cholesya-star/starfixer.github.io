// ============================================================
//  STARFIXER: Последний сигнал — main.js v3
//  ИСПРАВЛЕНИЯ v3:
//   - canvas.width/height теперь берётся из window, а не offsetWidth
//     (offsetWidth = 0 пока экран скрыт через display:none)
//   - resizeCanvas вызывается ПОСЛЕ showScreen('game')
//   - gameLoop стартует только один раз; повторный launchLevel
//     просто переключает G.running без нового RAF
//   - убран лишний дублирующий keydown-listener для прыжка
//   - коллизия по Y: герой не «застревает» в стенах при движении вниз
//   - drawBg не использует translateX(cam) — фон рисуется в экранных координатах
//   - все ctx.shadow* сбрасываются после каждого объекта (shadowBlur утечка)
//   - дверь теперь полная ширина тайла (раньше 0.45×TILE — герой проходил сквозь)
//   - switch/teleport позиция смещена вверх от пола на половину тайла
//   - добавлена защита от NaN в cam
// ============================================================

// ============================================================
//  §1  ИЗОБРАЖЕНИЯ — замени PLACEHOLDER на реальные URL
// ============================================================
const IMAGES = {
  hero:      '',
  bgRoom:    '',
  bgSpace:   '',
  bgDamaged: '',
};
const IMG = {};  // сюда попадают успешно загруженные Image-объекты

// ============================================================
//  §2  КОНФИГ
// ============================================================
const CFG = {
  PW: 28,          // ширина игрока px
  PH: 36,          // высота игрока px
  GRAV:    0.5,
  SPEED:   3.6,
  JUMP:   -10,
  COYOTE:  8,      // «прощение» прыжка с края (кадры)
  MAX_EN:  100,
  EN_MOVE: 0.015,
  EN_ACT:  10,
  EN_REGEN:0.01,
  EN_CRIT: 20,
  TILE:    40,
  INTERACT_R: 54,
};

// ============================================================
//  §3  УРОВНИ
//
//  Символы карты:
//   '#' — стена/платформа
//   '.' — воздух
//   'P' — старт игрока
//   'D' — дверь (блокирует; открывается переключателем S)
//   'S' — переключатель (Space рядом)
//   'E' — источник энергии (+40)
//   'M' — ключевой модуль (цель)
//   'T' — телепорт (парные; Space для активации)
//   'Z' — зона нулевой гравитации
//   'X' — опасность (мгновенная смерть)
// ============================================================
const LEVELS = [
  {
    name: 'Акт I — Пробуждение',
    moduleId: 'power', modLabel: 'PWR',
    winMsg: 'Модуль питания найден.\nСтанция получает базовый ток.',
    bgKey: 'bgRoom',
    hint: 'Подойди к переключателю ◎ и нажми SPACE',
    map: [
      '##################',
      '#................#',
      '#.P..............#',
      '#................#',
      '######...#########',
      '#....S...D.......#',
      '#....#...#...M...#',
      '#....#...#...#####',
      '#....E...........#',
      '##################',
    ],
  },
  {
    name: 'Акт I — Энергетическая цепь',
    moduleId: 'engine', modLabel: 'ENG',
    winMsg: 'Двигатель обнаружен.\nТяга — это жизнь.',
    bgKey: 'bgRoom',
    hint: 'Два переключателя — две двери. Порядок важен!',
    map: [
      '##################',
      '#................#',
      '#...P............#',
      '#................#',
      '######...#########',
      '#....S...D.......#',
      '#....#...######..#',
      '#....E...S.....D.#',
      '#................M',
      '##################',
    ],
  },
  {
    name: 'Акт II — Нулевая гравитация',
    moduleId: 'nav', modLabel: 'NAV',
    winMsg: 'Навигационный модуль активирован.\nЗвёзды снова говорят.',
    bgKey: 'bgRoom',
    hint: 'В зоне Z гравитация исчезает — ↑ ↓ для полёта',
    map: [
      '##################',
      '#.P..............#',
      '#................#',
      '#.....ZZZZZZZZ...#',
      '#.....Z......Z...#',
      '#.....Z..M...Z...#',
      '#.....ZZZZZZZZ...#',
      '#................#',
      '#....E.......S...#',
      '##################',
    ],
  },
  {
    name: 'Акт II — Разрывы пространства',
    moduleId: 'hull', modLabel: 'HUL',
    winMsg: 'Корпус восстановлен.\nСтанция не рассыпается.',
    bgKey: 'bgRoom',
    hint: 'Телепорт T — нажми SPACE на портале',
    map: [
      '##################',
      '#.P..............#',
      '#................#',
      '########..########',
      '#.......T........#',
      '#........T.......#',
      '#....S...#...M...#',
      '#....D...#...#####',
      '#....E...........#',
      '##################',
    ],
  },
  {
    name: 'Акт III — Глубины станции',
    moduleId: 'comm', modLabel: 'COM',
    winMsg: 'Связь восстановлена.\nПоследний сигнал готов.',
    bgKey: 'bgRoom',
    hint: 'Шипы X — смертельны. Будь осторожен!',
    map: [
      '##################',
      '#.P..............#',
      '#.####...........#',
      '#....#...XXXXXXX.#',
      '#....#...#.......#',
      '#....S...#...M...#',
      '#....D...#...#####',
      '#....#...........#',
      '#....E...........#',
      '##################',
    ],
  },
  {
    name: 'Акт IV — Сердце станции',
    moduleId: 'core', modLabel: 'CORE',
    winMsg: 'Все системы в сети.\nКси\'Ра делает выбор...',
    bgKey: 'bgSpace',
    hint: 'Финал. Все механики вместе.',
    map: [
      '####################',
      '#.P................#',
      '#.######...........#',
      '#......#...ZZZZZ...#',
      '#..S...#...Z...Z...#',
      '#..D...#...Z.M.Z...#',
      '#..#...#...ZZZZZ...#',
      '#..#...#...........#',
      '#..T...#.......T...#',
      '#..#...#..E....#...#',
      '#..#...S.......S...#',
      '#..####D...####D...#',
      '#......#...#.......#',
      '#......#..XXX..#...#',
      '#......#...#...#...#',
      '####################',
    ],
  },
];

// ============================================================
//  §4  ЗВУК (Web Audio API — без файлов)
// ============================================================
const SFX = (() => {
  let ac = null;
  function init() {
    if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
  }
  function tone(freq, type, dur, vol = 0.15) {
    try {
      init();
      const o = ac.createOscillator(), g = ac.createGain();
      o.connect(g); g.connect(ac.destination);
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
      o.start(); o.stop(ac.currentTime + dur);
    } catch(e) {}
  }
  return {
    mute: false,
    jump:     () => { if (!SFX.mute) tone(300,'sine',0.08,0.1); },
    activate: () => { if (!SFX.mute) { tone(220,'square',0.1,0.12); setTimeout(()=>tone(440,'square',0.1,0.1),80); } },
    energy:   () => { if (!SFX.mute) { tone(660,'sine',0.15,0.18); setTimeout(()=>tone(880,'sine',0.12,0.15),100); } },
    module:   () => { if (!SFX.mute) [440,550,660,880].forEach((f,i)=>setTimeout(()=>tone(f,'sine',0.2,0.18),i*80)); },
    die:      () => { if (!SFX.mute) { tone(180,'sawtooth',0.3,0.2); setTimeout(()=>tone(90,'sawtooth',0.25,0.18),120); } },
    teleport: () => { if (!SFX.mute) { tone(800,'sine',0.08,0.15); setTimeout(()=>tone(1200,'sine',0.07,0.12),60); } },
    noEnergy: () => { if (!SFX.mute) tone(100,'square',0.12,0.12); },
  };
})();

// ============================================================
//  §5  ГЛОБАЛЬНОЕ СОСТОЯНИЕ
// ============================================================
const G = {
  screen: 'splash',
  level:  0,
  modules: [],
  p: {
    x:0, y:0, vx:0, vy:0,
    onGround:false, coyote:0,
    energy: 100,
    facing: 1,
    inZeroG: false,
    dead: false, deathTimer: 0,
  },
  objects: [],
  cam: { x:0, y:0 },
  keys: { left:false, right:false, up:false, down:false, space:false },
  spaceJust: false,
  running: false,
  dialogOpen: false,
  nearInteractable: null,
  _loopStarted: false,
  lastT: 0,
  particles: [],
  ptTimer: 0,
};

// ============================================================
//  §6  ЗАГРУЗКА КАРТИНОК (graceful — игра не ломается без них)
// ============================================================
function preloadImages(cb) {
  const keys = Object.keys(IMAGES).filter(k => IMAGES[k]);
  if (!keys.length) { cb(); return; }
  let done = 0;
  keys.forEach(k => {
    const img = new Image();
    img.onload  = () => { IMG[k] = img; if (++done === keys.length) cb(); };
    img.onerror = () => { IMG[k] = null; if (++done === keys.length) cb(); };
    img.src = IMAGES[k];
  });
}

// ============================================================
//  §7  ЭКРАНЫ
// ============================================================
const ALL_SCREENS = ['splash','menu','controls','cutscene','game','pause','win','final','ending'];

function showScreen(id) {
  ALL_SCREENS.forEach(s => {
    const el = document.getElementById('screen-' + s);
    if (el) el.classList.remove('active');
  });
  const el = document.getElementById('screen-' + id);
  if (el) el.classList.add('active');
  G.screen = id;
  // Фоновые анимации для не-игровых экранов
  if (id !== 'game') {
    const cvMap = {
      splash:'splash-canvas', menu:'menu-canvas',
      cutscene:'cut-canvas', final:'final-canvas', ending:'end-canvas'
    };
    if (cvMap[id]) animBgCanvas(cvMap[id]);
  }
}

// ============================================================
//  §8  ПРОЦЕДУРНЫЙ ФОН (звёздное поле для меню-экранов)
// ============================================================
const _bgRAF = {};
function animBgCanvas(cid) {
  if (_bgRAF[cid]) { cancelAnimationFrame(_bgRAF[cid]); _bgRAF[cid] = null; }
  const cv = document.getElementById(cid);
  if (!cv) return;
  const cx = cv.getContext('2d');
  // Размер — от родителя или от окна
  cv.width  = cv.parentElement.offsetWidth  || window.innerWidth;
  cv.height = cv.parentElement.offsetHeight || window.innerHeight;
  const W = cv.width, H = cv.height;
  const stars = Array.from({length:200}, ()=>({
    x: Math.random()*W, y: Math.random()*H,
    r: Math.random()*1.5+0.2, a: Math.random()*0.7+0.2,
    sp: Math.random()*0.12+0.02,
  }));
  const nebulae = Array.from({length:3},()=>({
    x:Math.random()*W, y:Math.random()*H,
    r:100+Math.random()*120, hue:Math.random()>0.5?200:270,
    a:0.04+Math.random()*0.04,
  }));
  function frame() {
    cx.clearRect(0,0,W,H);
    nebulae.forEach(n=>{
      const g=cx.createRadialGradient(n.x,n.y,0,n.x,n.y,n.r);
      g.addColorStop(0,`hsla(${n.hue},80%,55%,${n.a})`);
      g.addColorStop(1,'transparent');
      cx.fillStyle=g; cx.fillRect(0,0,W,H);
    });
    stars.forEach(s=>{
      s.y+=s.sp; if(s.y>H){s.y=0;s.x=Math.random()*W;}
      cx.beginPath(); cx.arc(s.x,s.y,s.r,0,Math.PI*2);
      cx.fillStyle=`rgba(180,220,255,${s.a})`; cx.fill();
    });
    _bgRAF[cid] = requestAnimationFrame(frame);
  }
  frame();
}

// ============================================================
//  §9  НАВИГАЦИЯ / КНОПКИ
// ============================================================
function bindUI() {
  // Сплэш
  _on('btn-start', () => startCutscene(0));
  _on('btn-menu',  () => showScreen('menu'));
  // Меню
  _on('menu-new',  () => { G.level=0; G.modules=[]; startCutscene(0); });
  _on('menu-cont', () => {
    if (!G._loopStarted) { G.level=0; G.modules=[]; startCutscene(0); }
    else { showScreen('game'); resumeGame(); }
  });
  _on('menu-ctrl', () => showScreen('controls'));
  _on('menu-back', () => showScreen('splash'));
  // Управление
  _on('ctrl-back', () => showScreen('menu'));
  // Катсцена
  _on('btn-skip',  () => launchLevel(G.level));
  // В игре
  _on('btn-pause',      () => pauseGame());
  _on('pause-res',      () => resumeGame());
  _on('pause-restart',  () => { G.running=false; launchLevel(G.level); });
  _on('pause-home',     () => { G.running=false; showScreen('splash'); });
  _on('dialog-ok',      () => closeDialog());
  _on('btn-next',       () => nextLevel());
  // Финал
  _on('final-leave', () => startEnding('leave'));
  _on('final-stay',  () => startEnding('stay'));
  // Концовка
  _on('end-menu', () => { G.running=false; showScreen('splash'); });

  setupVPad();
}
function _on(id, fn) {
  const el = document.getElementById(id);
  if (el) el.onclick = fn;
}

// ============================================================
//  §10 КАТСЦЕНА
// ============================================================
const PROLOGUE = [
  '[ ЖУРНАЛ КРУШЕНИЯ ]',
  '',
  'Системное время: [УТРАЧЕНО]',
  'Орбитальная станция «Ноль-Семь» — критическое состояние.',
  '',
  'Кси\'Ра приходит в сознание среди обломков.',
  'Энергия тела: 12%.',
  '',
  'Корабль разрушен. Модули рассеяны по отсекам.',
  '',
  'Станция молчит.',
  'Но что-то здесь... слушает.',
  '',
  '[ МИССИЯ: восстановить все модули ]',
];
let _cutIv = null;

function startCutscene(idx) {
  G.level = idx;
  showScreen('cutscene');
  const el = document.getElementById('cut-text');
  el.textContent = ''; el.classList.add('typing');
  if (_cutIv) clearInterval(_cutIv);
  let li=0, ci=0, text='';
  _cutIv = setInterval(()=>{
    if (li >= PROLOGUE.length) {
      clearInterval(_cutIv); el.classList.remove('typing');
      setTimeout(()=>launchLevel(G.level), 1200);
      return;
    }
    const line = PROLOGUE[li];
    if (ci < line.length) { text += line[ci++]; el.textContent = text; }
    else { text+='\n'; el.textContent=text; li++; ci=0; }
  }, 35);
}

// ============================================================
//  §11 ИНИЦИАЛИЗАЦИЯ УРОВНЯ
// ============================================================

// CANVAS — главный игровой холст
const canvas = document.getElementById('game-canvas');
const ctx    = canvas.getContext('2d');

// ★ ВАЖНО: размер берём из window, НЕ из offsetWidth
//   (offsetWidth=0 пока экран скрыт через display:none)
function resizeCanvas() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  buildStarBg();
}
window.addEventListener('resize', resizeCanvas);

// Звёздный фон игрового холста (рисуется в мировом простр.)
let starBg = [];
function buildStarBg() {
  const W = canvas.width || 800;
  const H = canvas.height || 600;
  starBg = Array.from({length:160}, ()=>({
    x: Math.random()*W*4,
    y: Math.random()*H*4,
    r: Math.random()*1.5+0.2,
    a: Math.random()*0.6+0.2,
  }));
}

function launchLevel(idx) {
  const lvl = LEVELS[idx];
  if (!lvl) { showScreen('final'); return; }
  if (_cutIv) { clearInterval(_cutIv); _cutIv=null; }

  // ---- Сброс игрока ----
  const p = G.p;
  p.vx=0; p.vy=0; p.onGround=false; p.coyote=0;
  p.inZeroG=false; p.dead=false; p.deathTimer=0;
  p.energy = Math.min(CFG.MAX_EN, (p.energy||CFG.MAX_EN)+30);
  G.particles=[];
  G.spaceJust=false;
  G.dialogOpen=false;

  // ---- Парсим карту ----
  G.objects=[];
  const tps=[], doors=[], sws=[];
  lvl.map.forEach((row,ry)=>{
    [...row].forEach((ch,rx)=>{
      const ox=rx*CFG.TILE, oy=ry*CFG.TILE;
      if (ch==='P') { p.x=ox; p.y=oy; }
      const obj = makeObj(ch,ox,oy);
      if (!obj) return;
      G.objects.push(obj);
      if (ch==='T') tps.push(obj);
      if (ch==='D') doors.push(obj);
      if (ch==='S') sws.push(obj);
    });
  });
  // Связь S→D по порядку
  sws.forEach((sw,i)=>{ sw.linkedDoor = doors[i]||null; });
  // Связь телепортов попарно
  for (let i=0; i<tps.length-1; i+=2) {
    tps[i].partner=tps[i+1]; tps[i+1].partner=tps[i];
  }

  // ---- Переключаем экран ПЕРЕД resizeCanvas ----
  showScreen('game');

  // ---- ★ Размер холста устанавливаем ПОСЛЕ смены экрана ----
  resizeCanvas();

  // ---- Камера (сразу на игрока) ----
  G.cam.x = p.x + CFG.PW/2 - canvas.width/2;
  G.cam.y = p.y + CFG.PH/2 - canvas.height/2;

  // ---- HUD ----
  document.getElementById('hud-level-name').textContent = lvl.name;
  updateModuleHUD();
  updateEnergyHUD();
  document.getElementById('dialog').classList.add('hidden');
  document.getElementById('interact-hint').classList.add('hidden');

  // Подсказка уровня
  if (lvl.hint) setTimeout(()=>showDialog('💡 '+lvl.hint), 800);

  G.running = true;

  // ---- Запускаем RAF только один раз за всю сессию ----
  if (!G._loopStarted) {
    G._loopStarted = true;
    G.lastT = performance.now();
    requestAnimationFrame(gameLoop);
  }
}

// ============================================================
//  §12 СОЗДАНИЕ ОБЪЕКТА
// ============================================================
function makeObj(ch,x,y) {
  const T=CFG.TILE;
  switch(ch) {
    case '#': return {type:'wall',    x,y,w:T,h:T};
    // Дверь — полный тайл по ширине чтобы надёжно блокировать
    case 'D': return {type:'door',    x,y,w:T,h:T,open:false};
    // Переключатель — центрируется внутри тайла при рендере
    case 'S': return {type:'switch',  x,y,w:T,h:T,on:false,linkedDoor:null,cooldown:0};
    case 'E': return {type:'energy',  x,y,w:T,h:T,spent:false};
    case 'M': return {type:'module',  x,y,w:T,h:T,collected:false};
    case 'T': return {type:'teleport',x,y,w:T,h:T,partner:null,cooldown:0};
    case 'Z': return {type:'zerog',   x,y,w:T,h:T};
    case 'X': return {type:'hazard',  x,y,w:T,h:T};
    default:  return null;
  }
}

// ============================================================
//  §13 ИГРОВОЙ ЦИКЛ
// ============================================================
function gameLoop(ts) {
  requestAnimationFrame(gameLoop);
  if (!G.running) return;
  const dt = Math.min(ts - G.lastT, 50);
  G.lastT = ts;
  update(dt);
  render();
}

// ============================================================
//  §14 ОБНОВЛЕНИЕ
// ============================================================
function update(dt) {
  const p = G.p;

  // Анимация смерти
  if (p.dead) {
    if (--p.deathTimer <= 0) respawnPlayer();
    return;
  }

  // Нулевая гравитация
  p.inZeroG = G.objects.some(o=>o.type==='zerog' && overlap(p,o));

  // Горизонталь
  if (G.keys.left)       { p.vx=-CFG.SPEED; p.facing=-1; }
  else if (G.keys.right) { p.vx= CFG.SPEED; p.facing= 1; }
  else p.vx *= 0.7;

  if (Math.abs(p.vx)>0.4) {
    p.energy = Math.max(0, p.energy - CFG.EN_MOVE);
    if (G.ptTimer++%4===0) spawnPt();
  }

  // Вертикаль
  if (p.inZeroG) {
    if (G.keys.up)        p.vy = -CFG.SPEED;
    else if (G.keys.down) p.vy =  CFG.SPEED;
    else                  p.vy *= 0.8;
    p.onGround = false;
  } else {
    p.vy += CFG.GRAV;
    if (p.onGround) p.coyote = CFG.COYOTE;
    else if (p.coyote>0) p.coyote--;
    if (G.spaceJust && p.coyote>0) {
      p.vy = CFG.JUMP; p.coyote=0;
      spawnJumpPts(); SFX.jump();
    }
  }
  G.spaceJust = false;

  // Движение + коллизии
  p.x += p.vx; colX(p);
  p.y += p.vy; p.onGround=false; colY(p);

  // Рег. энергии
  p.energy = Math.min(CFG.MAX_EN, p.energy+CFG.EN_REGEN);

  // Cooldown'ы
  G.objects.forEach(o=>{ if(o.cooldown>0) o.cooldown--; });

  // Касания
  checkTouches();
  checkNear();

  // Камера — плавное следование
  const W=canvas.width, H=canvas.height;
  const tx = p.x + CFG.PW/2 - W/2;
  const ty = p.y + CFG.PH/2 - H/2;
  G.cam.x += (tx - G.cam.x) * 0.12;
  G.cam.y += (ty - G.cam.y) * 0.12;
  // Защита от NaN
  if (isNaN(G.cam.x)) G.cam.x = tx;
  if (isNaN(G.cam.y)) G.cam.y = ty;

  updateEnergyHUD();
}

// ============================================================
//  §15 КОЛЛИЗИИ
// ============================================================
function getSolids() {
  return G.objects.filter(o=>o.type==='wall'||(o.type==='door'&&!o.open));
}

function colX(p) {
  getSolids().forEach(s=>{
    if (!overlap(p,s)) return;
    if (p.vx>0) p.x = s.x - CFG.PW;
    else        p.x = s.x + s.w;
    p.vx=0;
  });
  // Границы карты
  const mapW = LEVELS[G.level].map[0].length * CFG.TILE;
  if (p.x<0) p.x=0;
  if (p.x+CFG.PW>mapW) p.x=mapW-CFG.PW;
}

function colY(p) {
  getSolids().forEach(s=>{
    if (!overlap(p,s)) return;
    if (p.vy>0) { p.y=s.y-CFG.PH; p.onGround=true; }
    else        { p.y=s.y+s.h; }
    p.vy=0;
  });
  // Упал за карту
  const mapH = LEVELS[G.level].map.length * CFG.TILE;
  if (p.y > mapH+CFG.TILE) killPlayer();
}

// ============================================================
//  §16 ВЗАИМОДЕЙСТВИЕ (Space)
// ============================================================
function triggerInteract() {
  if (G.dialogOpen) { closeDialog(); return; }
  const near = G.nearInteractable;
  if (!near) return;
  const p = G.p;

  if (near.type==='switch') {
    if (p.energy < CFG.EN_ACT) { SFX.noEnergy(); showDialog('⚡ Недостаточно энергии!'); return; }
    near.on = !near.on;
    p.energy -= CFG.EN_ACT;
    if (near.linkedDoor) near.linkedDoor.open = near.on;
    SFX.activate();
    burstPts(near.x+CFG.TILE/2, near.y+CFG.TILE/2, '#00d4ff', 14);
  }

  if (near.type==='teleport') {
    const dest = near.partner;
    if (!dest || near.cooldown>0) return;
    p.x = dest.x + CFG.TILE/2 - CFG.PW/2;
    p.y = dest.y;
    near.cooldown = dest.cooldown = 60;
    SFX.teleport();
    burstPts(p.x+CFG.PW/2, p.y+CFG.PH/2, '#7b4fff', 20);
    // Камера прыгает мгновенно
    G.cam.x = p.x+CFG.PW/2-canvas.width/2;
    G.cam.y = p.y+CFG.PH/2-canvas.height/2;
  }
}

// ============================================================
//  §17 КАСАНИЯ ОБЪЕКТОВ
// ============================================================
function checkTouches() {
  const p=G.p;
  G.objects.forEach(o=>{
    if (!overlap(p,o)) return;
    if (o.type==='energy'&&!o.spent) {
      o.spent=true; p.energy=Math.min(CFG.MAX_EN,p.energy+40);
      SFX.energy(); burstPts(o.x+CFG.TILE/2,o.y+CFG.TILE/2,'#00d4ff',12);
      showDialog('⚡ Энергия +40');
    }
    if (o.type==='module'&&!o.collected) {
      o.collected=true;
      G.modules.push(LEVELS[G.level].moduleId);
      updateModuleHUD(); SFX.module();
      setTimeout(()=>showWin(LEVELS[G.level]),400);
    }
    if (o.type==='hazard') killPlayer();
  });
}

function checkNear() {
  const p=G.p, cx=p.x+CFG.PW/2, cy=p.y+CFG.PH/2;
  let best=null, bestD=CFG.INTERACT_R;
  G.objects.forEach(o=>{
    if (o.type!=='switch'&&o.type!=='teleport') return;
    const d=Math.hypot(cx-(o.x+CFG.TILE/2), cy-(o.y+CFG.TILE/2));
    if (d<bestD) { bestD=d; best=o; }
  });
  G.nearInteractable=best;
  const hint=document.getElementById('interact-hint');
  const htxt=document.getElementById('interact-text');
  if (best) {
    hint.classList.remove('hidden');
    htxt.textContent = best.type==='switch'
      ? (best.on?'SPACE — выключить':'SPACE — активировать')
      : 'SPACE — войти в телепорт';
  } else {
    hint.classList.add('hidden');
  }
}

// ============================================================
//  §18 ЧАСТИЦЫ
// ============================================================
function spawnPt() {
  const p=G.p, c=p.energy<CFG.EN_CRIT?'#ff3355':'#00d4ff';
  G.particles.push({x:p.x+CFG.PW/2+(Math.random()-.5)*14, y:p.y+CFG.PH,
    vx:(Math.random()-.5)*1.2, vy:-Math.random()*1.5-.2,
    life:1, sz:Math.random()*2.5+.8, c});
}
function spawnJumpPts() {
  for(let i=0;i<8;i++) G.particles.push({
    x:G.p.x+CFG.PW/2+(Math.random()-.5)*18, y:G.p.y+CFG.PH,
    vx:(Math.random()-.5)*3, vy:Math.random()*1.5+.5,
    life:1, sz:Math.random()*3+1, c:'#00d4ff'});
}
function burstPts(x,y,c,n) {
  for(let i=0;i<n;i++) {
    const a=(i/n)*Math.PI*2;
    G.particles.push({x,y,vx:Math.cos(a)*3*(Math.random()+.5),
      vy:Math.sin(a)*3*(Math.random()+.5),life:1,sz:Math.random()*3+1,c});
  }
}
function tickPts() {
  for(let i=G.particles.length-1;i>=0;i--) {
    const pt=G.particles[i];
    pt.x+=pt.vx; pt.y+=pt.vy; pt.vy+=0.04; pt.life-=0.025;
    if(pt.life<=0) G.particles.splice(i,1);
  }
}

// ============================================================
//  §19 РЕНДЕР
// ============================================================
function render() {
  const W=canvas.width, H=canvas.height;
  if (!W||!H) return; // холст ещё не готов

  // Очищаем
  ctx.fillStyle='#040810';
  ctx.fillRect(0,0,W,H);

  // Фон (в экранных координатах — без трансляции)
  drawBg(W,H);

  // Переводим систему координат на камеру
  ctx.save();
  ctx.translate(-Math.floor(G.cam.x), -Math.floor(G.cam.y));

  drawZeroG();
  G.objects.forEach(o=>drawObj(o));
  if (!G.p.dead) drawPlayer();
  else           drawDeathFX();
  drawPts();

  ctx.restore();

  // Вспышка при смерти (в экранных координатах)
  if (G.p.dead && G.p.deathTimer>30) {
    ctx.fillStyle=`rgba(255,51,85,${Math.min((G.p.deathTimer-30)/20*0.5, 0.45)})`;
    ctx.fillRect(0,0,W,H);
  }

  tickPts();
}

// ---- Фон ----
function drawBg(W,H) {
  const lvl=LEVELS[G.level];
  const bgImg = IMG[lvl.bgKey];

  if (bgImg) {
    // Параллакс: фон движется в 0.15 от скорости камеры
    const ox=(-(G.cam.x*0.15))%W;
    const oy=(-(G.cam.y*0.15))%H;
    ctx.drawImage(bgImg, ox, oy, W, H);
    ctx.drawImage(bgImg, ox+W, oy, W, H);
    ctx.fillStyle='rgba(4,8,16,0.5)';
    ctx.fillRect(0,0,W,H);
    return;
  }

  // Процедурный: градиент + звёзды (параллакс в мировых коорд.)
  const grad=ctx.createLinearGradient(0,0,0,H);
  if (lvl.bgKey==='bgSpace') {
    grad.addColorStop(0,'#010510'); grad.addColorStop(1,'#060c28');
  } else {
    grad.addColorStop(0,'#060c1a'); grad.addColorStop(1,'#0a1428');
  }
  ctx.fillStyle=grad; ctx.fillRect(0,0,W,H);

  // Звёзды с параллаксом (рисуются в экранных координатах)
  const px=G.cam.x*0.08, py=G.cam.y*0.08;
  starBg.forEach(s=>{
    const sx=((s.x-px)%(W*4)+W*4)%(W*4);
    const sy=((s.y-py)%(H*4)+H*4)%(H*4);
    if (sx>W||sy>H) return;
    ctx.beginPath(); ctx.arc(sx,sy,s.r,0,Math.PI*2);
    ctx.fillStyle=`rgba(180,220,255,${s.a})`; ctx.fill();
  });

  // Сетка коридора
  if (lvl.bgKey!=='bgSpace') {
    ctx.strokeStyle='rgba(0,60,100,0.15)'; ctx.lineWidth=1;
    const gs=80;
    const ox2=(-G.cam.x)%gs, oy2=(-G.cam.y)%gs;
    for(let x=ox2;x<W;x+=gs){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
    for(let y=oy2;y<H;y+=gs){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
  }
}

// ---- Зоны нулевой гравитации ----
function drawZeroG() {
  const t=Date.now()*0.001;
  G.objects.filter(o=>o.type==='zerog').forEach(z=>{
    ctx.fillStyle=`rgba(123,79,255,${0.07+0.03*Math.sin(t+z.x*.01)})`;
    ctx.strokeStyle=`rgba(123,79,255,${0.35+0.1*Math.sin(t)})`;
    ctx.lineWidth=1;
    ctx.fillRect(z.x,z.y,z.w,z.h);
    ctx.strokeRect(z.x,z.y,z.w,z.h);
  });
}

// ---- Частицы ----
function drawPts() {
  G.particles.forEach(pt=>{
    ctx.save();
    ctx.globalAlpha=pt.life*0.85;
    ctx.fillStyle=pt.c;
    ctx.shadowColor=pt.c; ctx.shadowBlur=5;
    ctx.beginPath(); ctx.arc(pt.x,pt.y,pt.sz*pt.life,0,Math.PI*2); ctx.fill();
    ctx.restore();
  });
}

// ============================================================
//  §20 ОТРИСОВКА ОБЪЕКТОВ
// ============================================================
function drawObj(o) {
  const T=CFG.TILE, t=Date.now()*.001;
  ctx.save();

  switch(o.type) {

    case 'wall': {
      // Основная плитка
      ctx.fillStyle='#0b1626';
      ctx.fillRect(o.x,o.y,T,T);
      // Верхняя светлая кромка (пол)
      ctx.fillStyle='rgba(0,212,255,0.14)';
      ctx.fillRect(o.x,o.y,T,2);
      // Правая грань
      ctx.fillStyle='rgba(0,212,255,0.05)';
      ctx.fillRect(o.x+T-1,o.y,1,T);
      // Тонкая рамка
      ctx.strokeStyle='rgba(0,212,255,0.07)';
      ctx.lineWidth=1;
      ctx.strokeRect(o.x+.5,o.y+.5,T-1,T-1);
      break;
    }

    case 'door': {
      if (!o.open) {
        const f=0.6+0.4*Math.sin(t*3);
        ctx.fillStyle=`rgba(255,51,85,${0.25*f})`;
        ctx.fillRect(o.x,o.y,T,T);
        // Полосы (энергетический барьер)
        ctx.strokeStyle=`rgba(255,51,85,${0.7*f})`;
        ctx.lineWidth=2;
        for(let i=0;i<4;i++){
          const yy=o.y+T*0.2*i+T*0.1;
          ctx.beginPath(); ctx.moveTo(o.x+2,yy); ctx.lineTo(o.x+T-2,yy); ctx.stroke();
        }
        // Рамка с свечением
        ctx.shadowColor='#ff3355'; ctx.shadowBlur=8*f;
        ctx.strokeStyle=`rgba(255,51,85,${0.9*f})`;
        ctx.lineWidth=2;
        ctx.strokeRect(o.x+1,o.y+1,T-2,T-2);
      } else {
        // Открыта: едва заметный проём
        ctx.fillStyle='rgba(0,212,255,0.04)';
        ctx.fillRect(o.x,o.y,T,T);
      }
      break;
    }

    case 'switch': {
      const c=o.on?'#00d4ff':'#7b4fff';
      const pad=T*0.18;
      const sx=o.x+pad, sy=o.y+pad, sw=T-pad*2, sh=T-pad*2;
      ctx.fillStyle=o.on?'rgba(0,212,255,0.18)':'rgba(123,79,255,0.15)';
      ctx.strokeStyle=c; ctx.lineWidth=2;
      ctx.shadowColor=c; ctx.shadowBlur=o.on?12:5;
      ctx.fillRect(sx,sy,sw,sh);
      ctx.strokeRect(sx,sy,sw,sh);
      // Иконка: круг внутри
      ctx.fillStyle=c;
      ctx.beginPath();
      ctx.arc(o.x+T/2, o.y+T/2, sw*.28, 0, Math.PI*2);
      if(o.on) ctx.fill(); else ctx.stroke();
      // Пунктир к двери
      if(o.linkedDoor&&!o.linkedDoor.open){
        ctx.setLineDash([4,6]); ctx.strokeStyle='rgba(123,79,255,0.22)';
        ctx.lineWidth=1; ctx.shadowBlur=0;
        ctx.beginPath();
        ctx.moveTo(o.x+T/2,o.y+T/2);
        ctx.lineTo(o.linkedDoor.x+T/2,o.linkedDoor.y+T/2);
        ctx.stroke(); ctx.setLineDash([]);
      }
      break;
    }

    case 'energy': {
      if(!o.spent){
        const pulse=0.5+0.5*Math.sin(t*2.5+o.x*.01);
        ctx.shadowColor='#00d4ff'; ctx.shadowBlur=10+pulse*10;
        ctx.strokeStyle=`rgba(0,212,255,${0.6+pulse*.3})`;
        ctx.fillStyle=`rgba(0,212,255,${0.12+pulse*.1})`;
        ctx.lineWidth=2;
        // Круг
        ctx.beginPath(); ctx.arc(o.x+T/2,o.y+T/2,T*.38,0,Math.PI*2);
        ctx.fill(); ctx.stroke();
        // Молния
        ctx.fillStyle=`rgba(0,212,255,${0.8+pulse*.2})`;
        ctx.font=`${T*.45}px serif`;
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText('⚡',o.x+T/2,o.y+T/2+1);
      } else {
        ctx.fillStyle='rgba(40,70,110,0.2)';
        ctx.beginPath(); ctx.arc(o.x+T/2,o.y+T/2,T*.38,0,Math.PI*2); ctx.fill();
      }
      break;
    }

    case 'module': {
      if(!o.collected){
        const rot=t*1.3;
        const glow=8+5*Math.sin(t*2);
        const cx=o.x+T/2, cy=o.y+T/2, r=T*.38;
        // Внешнее кольцо
        ctx.strokeStyle='rgba(0,212,255,0.3)'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.arc(cx,cy,r+7,0,Math.PI*2); ctx.stroke();
        // Вращающийся ромб
        ctx.save(); ctx.translate(cx,cy); ctx.rotate(rot);
        ctx.shadowColor='#00d4ff'; ctx.shadowBlur=glow;
        ctx.fillStyle='rgba(0,212,255,0.22)';
        ctx.strokeStyle='#00d4ff'; ctx.lineWidth=2;
        ctx.beginPath();
        ctx.moveTo(0,-r); ctx.lineTo(r,0); ctx.lineTo(0,r); ctx.lineTo(-r,0);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
        // Метка
        ctx.shadowBlur=0; ctx.fillStyle='#00d4ff';
        ctx.font=`bold 10px Courier New`;
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(LEVELS[G.level].modLabel||'M',cx,cy);
      }
      break;
    }

    case 'teleport': {
      const pulse=0.5+0.5*Math.sin(t*2.8+o.x*.01);
      const cx=o.x+T/2, cy=o.y+T/2;
      ctx.shadowColor='#7b4fff'; ctx.shadowBlur=12+pulse*10;
      ctx.strokeStyle=`rgba(123,79,255,${0.5+pulse*.4})`;
      ctx.fillStyle=`rgba(123,79,255,${0.12+pulse*.1})`;
      ctx.lineWidth=2;
      ctx.beginPath(); ctx.ellipse(cx,cy,T*.45,T*.25,0,0,Math.PI*2);
      ctx.fill(); ctx.stroke();
      // Вращающийся крест
      ctx.save(); ctx.translate(cx,cy); ctx.rotate(t*2);
      ctx.strokeStyle=`rgba(160,120,255,${0.4+pulse*.3})`;
      ctx.lineWidth=1; ctx.shadowBlur=0;
      ctx.beginPath(); ctx.moveTo(0,-T*.25); ctx.lineTo(0,T*.25); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-T*.45,0); ctx.lineTo(T*.45,0); ctx.stroke();
      ctx.restore();
      ctx.shadowBlur=0; ctx.fillStyle=`rgba(160,120,255,${0.7+pulse*.2})`;
      ctx.font='bold 11px Courier New'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('T',cx,cy);
      break;
    }

    case 'hazard': {
      const f=0.6+0.4*Math.sin(t*5);
      const spN=Math.max(1,Math.floor(T/12));
      const spW=T/spN;
      ctx.fillStyle=`rgba(255,51,85,${0.85*f})`;
      ctx.shadowColor='#ff3355'; ctx.shadowBlur=6*f;
      for(let i=0;i<spN;i++){
        ctx.beginPath();
        ctx.moveTo(o.x+i*spW,     o.y+T);
        ctx.lineTo(o.x+i*spW+spW/2, o.y+T*0.35);
        ctx.lineTo(o.x+i*spW+spW,  o.y+T);
        ctx.closePath(); ctx.fill();
      }
      break;
    }
  }

  ctx.shadowBlur=0; // ★ сброс после каждого объекта
  ctx.restore();
}

// ============================================================
//  §21 ГЕРОЙ
// ============================================================
function drawPlayer() {
  const p=G.p, t=Date.now()*.001;
  const cx=p.x+CFG.PW/2, cy=p.y+CFG.PH/2;
  const lowE=p.energy<CFG.EN_CRIT;

  if(IMG.hero){
    ctx.save();
    if(p.facing<0){ ctx.translate(p.x + CFG.PW, 0); ctx.scale(-1, 1); }
    ctx.drawImage(IMG.hero,p.x,p.y,CFG.PW,CFG.PH);
    ctx.restore();
  } else {
    // Процедурный Кси'Ра
    const glow=5+4*Math.sin(t*4);
    const wobble=Math.sin(t*6)*1.5;
    ctx.save();
    ctx.shadowColor=lowE?'#ff3355':'#00d4ff';
    ctx.shadowBlur=glow;

    // Тело
    const rx=CFG.PW*.44, ry=CFG.PH*.47;
    const grad=ctx.createRadialGradient(cx,cy-2,0,cx,cy,rx);
    if(lowE){
      grad.addColorStop(0,'rgba(255,100,100,0.9)');
      grad.addColorStop(.6,'rgba(200,50,80,0.55)');
      grad.addColorStop(1,'rgba(100,0,30,0)');
    } else {
      grad.addColorStop(0,'rgba(0,220,255,0.92)');
      grad.addColorStop(.5,'rgba(0,140,220,0.55)');
      grad.addColorStop(1,'rgba(0,50,150,0)');
    }
    ctx.fillStyle=grad;
    ctx.beginPath();
    ctx.ellipse(cx+wobble*.3, cy, rx+Math.abs(wobble)*.2, ry-Math.abs(wobble)*.15, 0,0,Math.PI*2);
    ctx.fill();

    // Ядро
    ctx.fillStyle='#fff'; ctx.shadowBlur=14;
    ctx.beginPath(); ctx.arc(cx+p.facing*3,cy-3,4,0,Math.PI*2); ctx.fill();

    // Щупальца
    const tc=lowE?'rgba(255,100,100,0.5)':'rgba(0,220,255,0.6)';
    ctx.strokeStyle=tc; ctx.lineWidth=1.5; ctx.shadowBlur=3;
    for(let i=0;i<5;i++){
      const a=(i/5)*Math.PI*2+t*1.5;
      const len=(CFG.PW*.5)*(0.7+0.3*Math.sin(t*3+i));
      const ang=a+Math.sin(t*2.5+i)*.4;
      ctx.beginPath(); ctx.moveTo(cx,cy);
      ctx.bezierCurveTo(
        cx+Math.cos(ang)*len*.5, cy+Math.sin(ang)*len*.5,
        cx+Math.cos(ang+.3)*len*.8, cy+Math.sin(ang+.3)*len*.8,
        cx+Math.cos(ang)*len, cy+Math.sin(ang)*len
      );
      ctx.stroke();
    }
    // Крылья невесомости
    if(p.inZeroG){
      ctx.strokeStyle='rgba(123,79,255,0.5)'; ctx.lineWidth=2;
      for(const s of[-1,1]){
        ctx.beginPath(); ctx.moveTo(cx,cy);
        ctx.lineTo(cx+s*CFG.PW*.9, cy-4+Math.sin(t*4)*5); ctx.stroke();
      }
    }
    ctx.restore();
  }

  // Мини-полоска энергии под героем
  const bPct=p.energy/CFG.MAX_EN;
  const bc=bPct>.3?'#00d4ff':'#ff3355';
  ctx.fillStyle='rgba(20,40,80,0.6)';
  ctx.fillRect(p.x,p.y+CFG.PH+3,CFG.PW,3);
  ctx.fillStyle=bc; ctx.shadowColor=bc; ctx.shadowBlur=4;
  ctx.fillRect(p.x,p.y+CFG.PH+3,CFG.PW*bPct,3);
  ctx.shadowBlur=0;
}

function drawDeathFX() {
  const p=G.p, prog=1-p.deathTimer/60;
  ctx.save();
  ctx.globalAlpha=1-prog;
  ctx.shadowColor='#ff3355'; ctx.shadowBlur=20; ctx.fillStyle='#ff3355';
  ctx.beginPath();
  ctx.arc(p.x+CFG.PW/2, p.y+CFG.PH/2, CFG.PW*(.5+prog*.5),0,Math.PI*2);
  ctx.fill();
  ctx.restore();
}

// ============================================================
//  §22 HUD
// ============================================================
function updateEnergyHUD() {
  const pct=G.p.energy/CFG.MAX_EN;
  const bar=document.getElementById('energy-bar');
  if(bar){
    bar.style.width=(pct*100)+'%';
    bar.style.background=pct>.5?'#00d4ff':pct>.2?'#7b4fff':'#ff3355';
  }
  const val=document.getElementById('energy-val');
  if(val) val.textContent=Math.round(G.p.energy);
}

function updateModuleHUD() {
  const wrap=document.getElementById('module-icons');
  if(!wrap) return;
  wrap.innerHTML='';
  LEVELS.forEach(lvl=>{
    const el=document.createElement('div');
    el.className='mod-ic'+(G.modules.includes(lvl.moduleId)?' found':'');
    el.textContent=lvl.modLabel; el.title=lvl.name;
    wrap.appendChild(el);
  });
}

function showDialog(txt) {
  if(G.p.dead) return;
  const el=document.getElementById('dialog-text');
  if(el) el.textContent=txt;
  const dlg=document.getElementById('dialog');
  if(dlg) dlg.classList.remove('hidden');
  G.dialogOpen=true;
}
function closeDialog() {
  const dlg=document.getElementById('dialog');
  if(dlg) dlg.classList.add('hidden');
  G.dialogOpen=false;
}

// ============================================================
//  §23 СМЕРТЬ / ПОБЕДА / ФИНАЛ
// ============================================================
function killPlayer() {
  if(G.p.dead) return;
  G.p.dead=true; G.p.deathTimer=60;
  G.p.vy=CFG.JUMP*.5;
  SFX.die();
  burstPts(G.p.x+CFG.PW/2,G.p.y+CFG.PH/2,'#ff3355',24);
}
function respawnPlayer() {
  G.p.energy=Math.max(20,G.p.energy-15);
  launchLevel(G.level);
}

function showWin(lvl) {
  G.running=false;
  document.getElementById('win-title').textContent=`✦ ${lvl.modLabel} — НАЙДЕН ✦`;
  document.getElementById('win-desc').textContent=lvl.winMsg;
  const wm=document.getElementById('win-modules');
  if(wm){
    wm.innerHTML='';
    G.modules.forEach(id=>{
      const el=document.createElement('div');
      el.className='mod-ic found';
      const lv=LEVELS.find(l=>l.moduleId===id);
      el.textContent=lv?lv.modLabel:id;
      wm.appendChild(el);
    });
  }
  showScreen('win');
}

function nextLevel() {
  G.level++;
  if(G.level>=LEVELS.length){ showScreen('final'); return; }
  launchLevel(G.level);
}

function pauseGame()  { G.running=false; showScreen('pause'); }
function resumeGame() { G.running=true;  showScreen('game'); }

// Концовки
const ENDINGS = {
  leave:[
    '[ ЖУРНАЛ — ИСХОД ]','',
    'Кси\'Ра запускает двигатели.','Станция медленно уходит за горизонт.',
    '','В дисплее — тысячи звёзд. Где-то там — дом.',
    '','Энергия пульсирует в проводах позади. Она не просит остаться.',
    'Она просто... светит.','',
    '[ КОНЕЦ ]',
  ],
  stay:[
    '[ ЖУРНАЛ — ВЫБОР ]','',
    'Кси\'Ра отключает двигатели. Шлюз закрывается.',
    '','Станция вздыхает.',
    '','По проводам течёт что-то живое. Оно ждало.','',
    'Теперь их двое.','Два одиночества — в одном сигнале.',
    '','[ КОНЕЦ ]',
  ],
};
function startEnding(ch) {
  showScreen('ending');
  const lines=ENDINGS[ch], el=document.getElementById('ending-text');
  el.textContent='';
  let li=0,ci=0,text='';
  const iv=setInterval(()=>{
    if(li>=lines.length){clearInterval(iv);return;}
    const line=lines[li];
    if(ci<line.length){text+=line[ci++];el.textContent=text;}
    else{text+='\n';el.textContent=text;li++;ci=0;}
  },38);
}

// ============================================================
//  §24 КЛАВИАТУРА И ВИРТУАЛЬНЫЕ КНОПКИ
// ============================================================
window.addEventListener('keydown', e=>{
  if(e.key==='ArrowLeft' ||e.key==='a') G.keys.left =true;
  if(e.key==='ArrowRight'||e.key==='d') G.keys.right=true;
  if(e.key==='ArrowUp'   ||e.key==='w'||e.key==='z'){
    G.keys.up=true;
    // Прыжок через up-клавишу
    if(!G.keys._upHeld){ G.spaceJust=true; G.keys._upHeld=true; }
  }
  if(e.key==='ArrowDown' ||e.key==='s') G.keys.down=true;
  if(e.key===' '||e.key==='f'){
    e.preventDefault();
    if(!G.keys.space){ G.spaceJust=true; triggerInteract(); }
    G.keys.space=true;
  }
  if(e.key==='Escape'){
    if(G.screen==='game') pauseGame();
    else if(G.screen==='pause') resumeGame();
  }
  if((e.key==='r'||e.key==='R')&&G.screen==='game') launchLevel(G.level);
});
window.addEventListener('keyup', e=>{
  if(e.key==='ArrowLeft' ||e.key==='a') G.keys.left =false;
  if(e.key==='ArrowRight'||e.key==='d') G.keys.right=false;
  if(e.key==='ArrowUp'   ||e.key==='w'||e.key==='z'){G.keys.up=false;G.keys._upHeld=false;}
  if(e.key==='ArrowDown' ||e.key==='s') G.keys.down=false;
  if(e.key===' '||e.key==='f') G.keys.space=false;
});

function setupVPad() {
  if('ontouchstart' in window||navigator.maxTouchPoints>0){
    const vp=document.getElementById('vpad');
    if(vp) vp.classList.add('visible');
    const kb=document.getElementById('kb-hint');
    if(kb) kb.style.display='none';
  }
  const map={
    'vb-left': {dn:()=>{G.keys.left=true;},  up:()=>{G.keys.left=false;}},
    'vb-right':{dn:()=>{G.keys.right=true;}, up:()=>{G.keys.right=false;}},
    'vb-up':   {dn:()=>{G.keys.up=true;G.spaceJust=true;},up:()=>{G.keys.up=false;}},
    'vb-act':  {dn:()=>{G.spaceJust=true;triggerInteract();},up:()=>{}},
  };
  Object.entries(map).forEach(([id,{dn,up}])=>{
    const btn=document.getElementById(id); if(!btn) return;
    btn.addEventListener('touchstart',e=>{e.preventDefault();dn();},{passive:false});
    btn.addEventListener('touchend',  e=>{e.preventDefault();up();},{passive:false});
    btn.addEventListener('mousedown', dn);
    btn.addEventListener('mouseup',   up);
    btn.addEventListener('mouseleave',up);
  });
}

// ============================================================
//  §25 УТИЛИТЫ
// ============================================================
// AABB перекрытие. Размеры a: CFG.PW/PH если не указаны.
function overlap(a,b){
  const aw=a.w??CFG.PW, ah=a.h??CFG.PH;
  return a.x<b.x+b.w && a.x+aw>b.x && a.y<b.y+b.h && a.y+ah>b.y;
}

// ============================================================
//  §26 СТАРТ
// ============================================================
preloadImages(()=>{
  bindUI();
  showScreen('splash');
});
