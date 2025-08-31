// 🔨🤖🔧 Transition Diet – fixed & modular

const $ = (id) => document.getElementById(id);
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const round5 = (v) => Math.round(v / 5) * 5;

/* ---------- テーマ ---------- */
function updateThemeBtn() {
  $('themeToggle').textContent = document.body.classList.contains('light') ? '☀︎/🌙' : '🌙/☀︎';
}
function applyThemeFromStorage() {
  const t = localStorage.getItem('theme');
  if (t === 'light') document.body.classList.add('light'); else document.body.classList.remove('light');
  updateThemeBtn();
  if (window._chartArgs) drawCarbChart(window._chartArgs);
}
function toggleTheme() {
  document.body.classList.toggle('light');
  localStorage.setItem('theme', document.body.classList.contains('light') ? 'light' : 'dark');
  updateThemeBtn();
  if (window._chartArgs) drawCarbChart(window._chartArgs);
}

/* ---------- 週/日（グラフ側） ---------- */
let selectedWeek = null;   // 1..6
let selectedDayAbs = null; // 1..42

function ensureDaySelectionForCalc(planWeeks) {
  if (!selectedWeek) selectedWeek = 1;
  selectedWeek = clamp(selectedWeek, 1, planWeeks);
  const maxAbs = planWeeks * 7;
  if (!selectedDayAbs) selectedDayAbs = (selectedWeek - 1) * 7 + 1;
  selectedDayAbs = clamp(selectedDayAbs, 1, maxAbs);
}
function buildChartDayTabsForWeek(week) {
  const start = (week - 1) * 7 + 1;
  const end = start + 6;
  const cont = $('chartDayTabs');
  cont.innerHTML = '';
  for (let d = start; d <= end; d++) {
    const btn = document.createElement('button');
    btn.dataset.day = String(d);
    btn.textContent = `${d}日目`;
    if (selectedDayAbs === d) btn.classList.add('active');
    cont.appendChild(btn);
  }
  cont.style.display = 'grid';
  cont.onclick = (e) => {
    const btn = e.target.closest('button[data-day]');
    if (!btn) return;
    selectedDayAbs = +btn.dataset.day;
    calc();
  };
}
function renderChartTabs(planWeeks) {
  const wCont = $('chartWeekTabs');
  wCont.innerHTML = '';
  for (let w = 1; w <= planWeeks; w++) {
    const b = document.createElement('button');
    b.dataset.week = String(w);
    b.textContent = `${w}週間目`;
    if (selectedWeek === w) b.classList.add('active');
    wCont.appendChild(b);
  }
  wCont.style.display = 'grid';
  wCont.onclick = (e) => {
    const btn = e.target.closest('button[data-week]');
    if (!btn) return;
    selectedWeek = +btn.dataset.week;
    selectedDayAbs = (selectedWeek - 1) * 7 + 1;
    calc();
  };
  buildChartDayTabsForWeek(selectedWeek);
}

/* ---------- タブ切替（食材/グラフ） ---------- */
function setupTabs() {
  ['tab-food', 'tab-chart'].forEach((id) => {
    $(id).addEventListener('click', (e) => {
      ['tab-food', 'tab-chart'].forEach((i) => $(i).classList.remove('active'));
      e.currentTarget.classList.add('active');
      const target = e.currentTarget.dataset.target;
      $('foodSection').style.display = target === 'foodSection' ? 'block' : 'none';
      $('chartSection').style.display = target === 'chartSection' ? 'block' : 'none';
      if (target === 'chartSection' && window._chartArgs) drawCarbChart(window._chartArgs);
    });
  });
}

/* ---------- 運動習慣制御 ---------- */
['habit', 'fitnessType', 'onoff'].forEach((id) => {
  // 後でinit時に存在すればリスナーを張る
});
function setNoneOptionVisible(selectId, visible) {
  const sel = $(selectId);
  if (!sel) return;
  const opt = Array.from(sel.options).find((o) => o.value === 'none');
  if (!opt) return;
  opt.hidden = !visible; opt.disabled = !visible;
}
function enforceHabitRules() {
  const habit = $('habit').value;
  const isNone = (habit === '1.2' || !habit);
  if (isNone) {
    setNoneOptionVisible('fitnessType', true);
    setNoneOptionVisible('onoff', true);
    $('fitnessType').disabled = true;
    $('onoff').disabled = true;
    $('fitnessType').value = 'none';
    $('onoff').value = 'none';
  } else {
    setNoneOptionVisible('fitnessType', false);
    setNoneOptionVisible('onoff', false);
    $('fitnessType').disabled = false;
    $('onoff').disabled = false;
    if ($('fitnessType').value === 'none') $('fitnessType').value = '';
    if ($('onoff').value === 'none') $('onoff').value = '';
  }
}

/* ---------- 代表値（kcal/100g） ---------- */
const KCAL_PER_100G_BASE = { meat: 280, fish: 150, eggs: 150, dairy: 160, fruit: 60 };
function vegGrainKcal100By(riceBowlsMidpoint, rootFistsMidpoint) {
  const rice_g = (riceBowlsMidpoint || 0) * 150; // 茶碗1杯=150g
  const root_g = (rootFistsMidpoint || 0) * 100; // 拳1個=約100g
  const total = rice_g + root_g || 1;
  const kcal = (rice_g * 130 + root_g * 45) / total; // 米130, 根菜45
  return Math.round(kcal);
}

/* ---------- 週カーブ ---------- */
function startCarbFromIntake(sex, riceBowlsMid, breadUnitsMid, rootFistsMid) {
  const riceC = (riceBowlsMid || 0) * 55;
  const breadC = (breadUnitsMid || 0) * 28;
  const rootC = (rootFistsMid || 0) * 15;
  const base = (sex === 'M') ? 90 : 80;
  return clamp(riceC + breadC + rootC + base, 150, 420);
}
function decideWeeks(initialCarb) {
  if (initialCarb >= 300) return 6;
  if (initialCarb >= 230) return 5;
  return 4;
}
function weeklyTargets(initial, weeks) {
  const arr = [];
  for (let i = 1; i <= weeks; i++) {
    const t = (i - 1) / ((weeks - 1) || 1);
    const lin = initial - (initial - 100) * t;
    const wiggle = Math.sin(i * 1.7) * 4 + Math.sin(i * 0.53) * 3;
    arr.push(round5(lin + wiggle));
  }
  return arr;
}
function dayBandAdjustFromAbsDay(absDay) {
  const band = ((absDay - 1) % 7) + 1; // 1..7
  const map = [0, +6, +4, +2, -2, -4, -6, -8];
  return map[band] || 0;
}

/* ---------- 電解質 & 日別補正 ---------- */
const SPORT_FACTORS = {
  strength: { on: 1.10, off: 0.94 }, run: { on: 1.12, off: 0.92 }, cycle: { on: 1.11, off: 0.93 },
  club: { on: 1.12, off: 0.92 }, martial: { on: 1.12, off: 0.92 }, aerobic: { on: 1.10, off: 0.94 }, anaerobic: { on: 1.08, off: 0.96 },
  none: { on: 1.00, off: 1.00 }
};
function dailyAdjustment(habit, fitnessType, onoff) {
  if (!habit || habit === '1.2') return 1.00;
  const map = SPORT_FACTORS[fitnessType || 'none'] || SPORT_FACTORS.none;
  const raw = map[onoff || 'off'] ?? 1.00;
  return clamp(raw, 0.88, 1.12);
}
function electrolyteSchedule({ w, habit, fitnessType, onoff, carb_g, kcal, tdee }) {
  let na = 3000, k = 3000, mg = 300; // mg
  const mapAF = { '1.2': 0, '1.375': 400, '1.55': 600, '1.725': 800, '1.9': 1000 };
  na += mapAF[habit] || 0;
  if (onoff === 'on') {
    if (['run', 'cycle', 'aerobic', 'club'].includes(fitnessType)) na += 600;
    else if (['strength', 'anaerobic', 'martial'].includes(fitnessType)) na += 400;
    k += 200;
  }
  if (w >= 85) { na += 200; k += 100; }
  if (w <= 50) { na -= 100; }
  if (carb_g < 50) na += 300;
  if (kcal < tdee * 0.9) na += 200;
  na = clamp(na, 2000, 5500);
  k = clamp(k, 2500, 4000);
  mg = clamp(mg, 250, 500);
  return { na_g: +(na / 1000).toFixed(2), k_g: +(k / 1000).toFixed(2), mg_mg: Math.round(mg), salt_g: +(na / 1000 * 2.54).toFixed(1) };
}

/* ---------- 入力検証 ---------- */
function requireFilled() {
  const miss = [];
  if (!$('sex').value) miss.push('性別');
  if (!$('age').value) miss.push('年齢');
  if (!$('height').value) miss.push('身長');
  if (!$('weight').value) miss.push('体重');
  if (!$('rice').value) miss.push('1日にお米を食べる量');
  if (!$('bread').value) miss.push('1日にパンを食べる量');
  if (!$('rootveg').value) miss.push('1日に根菜を食べる量');
  if (!$('habit').value) miss.push('運動習慣');
  if ($('habit').value && $('habit').value !== '1.2') {
    if (!$('fitnessType').value) miss.push('フィットネス');
    if (!$('onoff').value) miss.push('オン/オフ');
  }
  if (miss.length) { alert('未入力があります：\n・' + miss.join('\n・')); return false; }
  return true;
}

/* ---------- BMI表記 ---------- */
function classText(bmi) {
  if (bmi < 18.5) return '低体重(<18.5)';
  if (bmi < 25) return '普通(18.5–24.9)';
  if (bmi < 30) return '前肥満(25–29.9)';
  if (bmi < 35) return '肥満I(30–34.9)';
  if (bmi < 40) return '肥満II(35–39.9)';
  return '肥満III(≥40)';
}

/* ---------- 棒グラフ ---------- */
function updateBars(pk, fk, ck, total) {
  const p = total ? Math.min(100, Math.round(pk / total * 100)) : 0;
  const f = total ? Math.min(100, Math.round(fk / total * 100)) : 0;
  const c = total ? Math.min(100, Math.round(ck / total * 100)) : 0;
  $('pbar').style.width = p + '%'; $('fbar').style.width = f + '%'; $('cbar').style.width = c + '%';
}
function updateFoodBars(parts, total) {
  const bars = { meat: 'meatbar', fish: 'fishbar', eggs: 'eggsbar', dairy: 'dairybar', veggrain: 'veggrainbar', fruit: 'fruitbar' };
  Object.keys(bars).forEach(k => {
    const v = total ? Math.min(100, Math.round((parts[k] / total) * 100)) : 0;
    $(bars[k]).style.width = v + '%';
  });
}

/* ---------- キャンバス ---------- */
function fitCanvasDPR(canvas) {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(360, Math.round(rect.width * dpr));
  const h = Math.max(240, Math.round(rect.height * dpr));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
}

/* ---------- グラフ描画 ---------- */
function drawCarbChart({ sex, weeks, series }) {
  const cvs = $('wtChart'); if (!cvs) return;
  fitCanvasDPR(cvs);
  const ctx = cvs.getContext('2d'); const W = cvs.width, H = cvs.height;
  ctx.clearRect(0, 0, W, H);
  const xs = [...Array(weeks)].map((_, i) => i + 1);
  const ys = series;

  const minY = Math.min(90, ...ys) - 10;
  const maxY = Math.max(...ys) + 20;

  const padL = 70, padR = 22, padT = 36, padB = 52;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const xTo = (w) => padL + ((w - 1) / ((weeks - 1) || 1)) * plotW;
  const yTo = (g) => padT + (1 - (g - minY) / (maxY - minY)) * plotH;

  const styles = getComputedStyle(document.body);
  ctx.strokeStyle = styles.getPropertyValue('--grid').trim(); ctx.lineWidth = 1;
  for (let i = 0; i <= 3; i++) { const gy = minY + (maxY - minY) / 3 * i, yy = yTo(gy); ctx.beginPath(); ctx.moveTo(padL, yy); ctx.lineTo(W - padR, yy); ctx.stroke(); }
  ctx.strokeStyle = styles.getPropertyValue('--axisLine').trim(); ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(padL, yTo(minY)); ctx.lineTo(W - padR, yTo(minY)); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(padL, yTo(minY)); ctx.lineTo(padL, padT); ctx.stroke();

  ctx.fillStyle = styles.getPropertyValue('--axis').trim();
  ctx.font = `${Math.round(W / 60) + 11}px system-ui`;
  xs.forEach((w) => { const label = `${w}週`; const tw = ctx.measureText(label).width; const xx = xTo(w); const xSafe = Math.min(Math.max(xx - tw / 2, padL), W - padR - tw); ctx.fillText(label, xSafe, H - 16); });
  [minY, (minY + maxY) / 2, maxY].forEach(val => { const label = `${Math.round(val)}g`; const tw = ctx.measureText(label).width; const yy = yTo(val); const yClamped = Math.min(Math.max(yy - 4, padT + 14), H - padB - 8); ctx.fillText(label, Math.max(padL - tw - 10, 6), yClamped); });

  ctx.save(); ctx.beginPath(); ctx.rect(padL, padT, plotW, plotH); ctx.clip();
  ctx.strokeStyle = '#48d1b5'; ctx.lineWidth = 3; ctx.beginPath();
  xs.forEach((w, i) => { const xx = xTo(w), yy = yTo(ys[i]); if (i === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy); }); ctx.stroke();
  ctx.fillStyle = '#48d1b5';
  xs.forEach((w, i) => { const xx = xTo(w), yy = yTo(ys[i]); ctx.beginPath(); ctx.arc(xx, yy, 3, 0, Math.PI * 2); ctx.fill(); });
  ctx.restore();

  window._chartArgs = { sex, weeks, series };
}

/* ---------- 計算本体 ---------- */
function calc() {
  const sex = $('sex').value;
  const age = parseFloat($('age').value) || 0;
  const h = parseFloat($('height').value) || 0;
  const w = parseFloat($('weight').value) || 0;
  const af = parseFloat($('habit').value) || 1.2;

  const fitnessType = ($('habit').value && $('habit').value !== '1.2') ? ($('fitnessType').value || 'none') : 'none';
  const onoff = ($('habit').value && $('habit').value !== '1.2') ? ($('onoff').value || 'none') : 'none';

  const riceMid = +($('rice').value || 0);
  const breadMid = +($('bread').value || 0);
  const rootMid = +($('rootveg').value || 0);

  const bmi = w / Math.pow(h / 100, 2);
  const bmr = (sex === 'M') ? (10 * w + 6.25 * h - 5 * age + 5) : (10 * w + 6.25 * h - 5 * age - 161);
  const dayF = dailyAdjustment($('habit').value, fitnessType, onoff);
  const tdee = bmr * af * dayF;

  const initialCarb = startCarbFromIntake(sex, riceMid, breadMid, rootMid);
  const planWeeks = decideWeeks(initialCarb);
  const weeklyCarb = weeklyTargets(initialCarb, planWeeks);

  ensureDaySelectionForCalc(planWeeks);
  const weekIdx = clamp(selectedWeek, 1, planWeeks);
  const dayAdj = dayBandAdjustFromAbsDay(selectedDayAbs);
  const carb_g = clamp(weeklyCarb[weekIdx - 1] + dayAdj, 100, initialCarb + 20);

  const VEG_GRAIN_100 = vegGrainKcal100By(riceMid, rootMid);
  $('kcal100Note').innerHTML = `※100gあたり代表値（目安）：肉 280kcal / 魚介類 150kcal / 卵 150kcal / 乳製品 160kcal / 野菜・穀物 ${VEG_GRAIN_100}kcal / 果物 60kcal`;

  const P_FACTOR = 1.6;
  let protein_g = w * P_FACTOR;
  let fat_g = (tdee - 4 * protein_g - 4 * carb_g) / 9;

  let pk = protein_g * 4, ck = carb_g * 4, fk, kcal;
  let warnMsg = '';

  function enforceFatFloor(protein_g, carb_g, fat_g, body_w) {
    const FAT_MIN_G_PER_KG = 0.6;
    const fatMin = FAT_MIN_G_PER_KG * body_w;
    if (fat_g >= fatMin) return { protein_g, carb_g, fat_g, adjusted: false, reason: '' };
    let needFatG = fatMin - fat_g;
    let needKcal = needFatG * 9;
    const carbKcal = Math.max(0, carb_g * 4);
    const cutFromCarb = Math.min(carbKcal, needKcal);
    carb_g = Math.max(0, carb_g - cutFromCarb / 4);
    needKcal -= cutFromCarb;
    if (needKcal > 0) {
      const protKcal = Math.max(0, protein_g * 4);
      const cutFromProt = Math.min(protKcal, needKcal);
      protein_g = Math.max(0, protein_g - cutFromProt / 4);
      needKcal -= cutFromProt;
    }
    const addedFatG = (needFatG - (needKcal / 9));
    fat_g += Math.max(0, addedFatG);
    return { protein_g, carb_g, fat_g, adjusted: true, reason: '※脂質下限（0.6g/kg）を確保するため糖質→タンパク質の順で自動調整しました。' };
  }

  if (fat_g < 0) {
    const pcK = pk + ck, s = Math.max(0, tdee / (pcK || 1));
    protein_g *= s; carb_g *= s; fat_g = 0; pk = protein_g * 4; ck = carb_g * 4; fk = 0; kcal = tdee;
    warnMsg = '※脂質が負になったため、TDEEを優先しP/Cを自動調整しました（脂質=0）。';
  } else {
    const adj = enforceFatFloor(protein_g, carb_g, fat_g, w);
    protein_g = adj.protein_g; carb_g = adj.carb_g; fat_g = adj.fat_g;
    pk = protein_g * 4; ck = carb_g * 4; fk = fat_g * 9; kcal = pk + ck + fk;
    if (adj.adjusted) warnMsg = adj.reason;
  }
  if (!kcal) { fk = fat_g * 9; kcal = pk + ck + fk; }

  const elec = electrolyteSchedule({ w, habit: $('habit').value, fitnessType, onoff, carb_g, kcal, tdee });

  // 表示（基礎）
  $('bmi').textContent = isFinite(bmi) ? bmi.toFixed(2) : '–';
  $('bmr').textContent = isFinite(bmr) ? Math.round(bmr).toLocaleString() : '–';
  $('tdee').textContent = isFinite(tdee) ? Math.round(tdee).toLocaleString() : '–';
  $('bmiClassTxt').textContent = `BMI区分：${isFinite(bmi) ? classText(bmi) : '—'}｜日別補正 ×${dayF.toFixed(2)}（±12%内）`;

  // 表示（あなたの目安）
  $('kcal').textContent = Math.round(kcal).toLocaleString();
  $('p').textContent = Math.round(protein_g);
  $('f').textContent = Math.round(fat_g);
  $('c').textContent = Math.round(carb_g);
  $('pkcal').textContent = Math.round(pk).toLocaleString();
  $('fkcal').textContent = Math.round(fk).toLocaleString();
  $('ckcal').textContent = Math.round(ck).toLocaleString();

  const fitnessLabelMap = { none: '該当なし', strength: '筋トレ', run: 'ランニング', cycle: 'サイクリング', club: '部活動', martial: '格闘技', aerobic: 'その他（有酸素運動）', anaerobic: 'その他（無酸素運動）' };
  const fitTxt = fitnessLabelMap[fitnessType] || '該当なし';
  const onoffTxt = (!onoff || onoff === 'none') ? '該当なし' : (onoff === 'on' ? '運動日' : '休息日');
  $('macroNote').textContent = `フィットネス：${fitTxt}｜ オン/オフ：${onoffTxt} ｜ 糖質摂取量（目安）：${Math.round(carb_g)}g ｜ 活動係数AF×日別補正＝TDEE｜日別補正±12%内`;
  $('elecLine').textContent = `電解質目安：Na ${elec.na_g}g（食塩 ${elec.salt_g}g） / K ${elec.k_g}g / Mg ${elec.mg_mg}mg`;
  if (warnMsg) { $('fatWarn').textContent = warnMsg; $('fatWarn').style.display = 'block'; }
  else { $('fatWarn').style.display = 'none'; }

  $('baseCard').style.display = 'block';
  $('macroCard').style.display = 'block';
  $('mixCard').style.display = 'block';

  // 食材配分
  const KCAL_PER_100G = { meat: KCAL_PER_100G_BASE.meat, fish: KCAL_PER_100G_BASE.fish, eggs: KCAL_PER_100G_BASE.eggs, dairy: KCAL_PER_100G_BASE.dairy, veggrain: VEG_GRAIN_100, fruit: KCAL_PER_100G_BASE.fruit };
  const plantKcalBase = (carb_g * 4);
  const vgShare = 0.6, frShare = 0.4;
  let kVegGrain = plantKcalBase * vgShare;
  let kFruit = plantKcalBase * frShare;

  let meatShare = 0.60, fishShare = 0.12, eggsShare = 0.12, dairyShare = 0.16;
  if (onoff === 'on') {
    if (['run', 'cycle', 'aerobic', 'club'].includes(fitnessType)) { fishShare += 0.02; meatShare -= 0.02; }
    if (['strength', 'anaerobic', 'martial'].includes(fitnessType)) { eggsShare += 0.02; meatShare += 0.01; dairyShare += 0.01; }
  } else if (onoff === 'off') { dairyShare += 0.02; meatShare -= 0.02; }
  const sumAnimal = meatShare + fishShare + eggsShare + dairyShare;
  meatShare /= sumAnimal; fishShare /= sumAnimal; eggsShare /= sumAnimal; dairyShare /= sumAnimal;

  const remainKcal = Math.max(0, (protein_g * 4 + fat_g * 9 + plantKcalBase) - (kVegGrain + kFruit));
  let kMeat = remainKcal * meatShare;
  let kFish = remainKcal * fishShare;
  let kEggs = remainKcal * eggsShare;
  let kDairy = remainKcal * dairyShare;

  const shift = Math.min(kDairy * 0.25, remainKcal * 0.20);
  kDairy -= shift; kVegGrain += shift * 0.6; kFruit += shift * 0.4;

  $('gMeat').textContent = Math.round((kMeat / KCAL_PER_100G.meat * 100) / 10) * 10; $('kMeat').textContent = Math.round(kMeat);
  $('gFish').textContent = Math.round((kFish / KCAL_PER_100G.fish * 100) / 10) * 10; $('kFish').textContent = Math.round(kFish);
  $('gEggs').textContent = Math.round((kEggs / KCAL_PER_100G.eggs * 100) / 10) * 10; $('kEggs').textContent = Math.round(kEggs);
  $('gDairy').textContent = Math.round((kDairy / KCAL_PER_100G.dairy * 100) / 10) * 10; $('kDairy').textContent = Math.round(kDairy);
  $('gVegGrain').textContent = Math.round((kVegGrain / KCAL_PER_100G.veggrain * 100) / 10) * 10; $('kVegGrain').textContent = Math.round(kVegGrain);
  $('gFruit').textContent = Math.round((kFruit / KCAL_PER_100G.fruit * 100) / 10) * 10; $('kFruit').textContent = Math.round(kFruit);

  updateFoodBars({ meat: kMeat, fish: kFish, eggs: kEggs, dairy: kDairy, veggrain: kVegGrain, fruit: kFruit }, (protein_g * 4 + fat_g * 9 + plantKcalBase));
  updateBars(protein_g * 4, fat_g * 9, plantKcalBase, (protein_g * 4 + fat_g * 9 + plantKcalBase));

  // グラフ＆週日タブ
  $('chartTitle').textContent = `${planWeeks}週間で移行する場合（現在：${selectedWeek}週目／${selectedDayAbs}日目）`;
  drawCarbChart({ sex, weeks: planWeeks, series: weeklyCarb });
  renderChartTabs(planWeeks);

  // 修正案用
  window._plan = { protein_g, fat_g, carb_g, kcal, tdee, w };
}

/* ---------- 修正案 ---------- */
function setupFixer() {
  $('fixBtn').addEventListener('click', () => {
    if (!window._plan) { alert('まずは上の「計算」を押してください。'); return; }
    const actK = parseFloat($('actK').value || '0');
    const actP = parseFloat($('actP').value || '0');
    const actF = parseFloat($('actF').value || '0');
    const actC = parseFloat($('actC').value || '0');
    const { protein_g, fat_g, carb_g, kcal } = window._plan;

    if (!(actK || actP || actF || actC)) { $('fixSuggest').textContent = '実績（kcal / P / F / C）を1つ以上入力すると具体的な修正案を提示します。'; return; }

    const dK = Math.round(kcal - (actK || 0));
    const dP = Math.round(protein_g - (actP || 0));
    const dF = Math.round(fat_g - (actF || 0));
    const dC = Math.round(carb_g - (actC || 0));

    const lines = [];
    if (dK > 50) { const addFat = Math.max(0, Math.round(dK / 9)); lines.push(`▶ きょう中に不足：脂質 +${addFat}g（牛脂/バター目安）、または卵 ${Math.ceil(addFat / 5)}個。`); }
    else if (dK < -50) { lines.push(`▶ 摂り過ぎ：明日は脂質を −${Math.round(Math.abs(dK) / 9)}g 調整。`); }
    if (dP > 5) { lines.push(`▶ たんぱく不足：赤身肉 約 ${Math.round(dP * 100 / 20)}g（P${dP}g）追加。`); }
    if (dF > 5) { lines.push(`▶ 脂質不足：オリーブオイル大さじ ${Math.ceil(dF / 14)} or バター ${dF}g 追加。`); }
    if (dC > 5) { lines.push(`▶ 糖質不足は無理に埋めなくてOK（移行設計）。`); }
    if (dC < -5) { lines.push(`▶ 糖質過多：明日は糖質 −${Math.abs(dC)}g 調整。`); }

    $('fixSuggest').innerHTML = lines.length
      ? lines.map(s => `<div>・${s}</div>`).join('')
      : '入力された実績に対する修正は特に必要ありません。';
  });
}

/* ---------- セッション保存/復元 ---------- */
function saveFormToSession() {
  const data = {
    sex: $('sex').value, age: $('age').value, height: $('height').value, weight: $('weight').value,
    rice: $('rice').value, bread: $('bread').value, rootveg: $('rootveg').value,
    habit: $('habit').value, fitnessType: $('fitnessType').value, onoff: $('onoff').value,
    selectedWeek, selectedDayAbs
  };
  sessionStorage.setItem('plannerAutoForm', JSON.stringify(data));
}
function restoreFromSession() {
  const raw = sessionStorage.getItem('plannerAutoForm');
  if (!raw) return false;
  try {
    const d = JSON.parse(raw);
    if (d.sex) $('sex').value = d.sex;
    if (d.age) $('age').value = d.age;
    if (d.height) $('height').value = d.height;
    if (d.weight) $('weight').value = d.weight;
    if (d.rice) $('rice').value = d.rice;
    if (d.bread) $('bread').value = d.bread;
    if (d.rootveg) $('rootveg').value = d.rootveg;
    if (d.habit) $('habit').value = d.habit;

    enforceHabitRules();
    if (d.fitnessType) $('fitnessType').value = d.fitnessType;
    if (d.onoff) $('onoff').value = d.onoff;

    if (d.selectedWeek) selectedWeek = +d.selectedWeek;
    if (d.selectedDayAbs) selectedDayAbs = +d.selectedDayAbs;
  } catch { /* ignore */ }
  return true;
}

/* ---------- 初期化 ---------- */
function init() {
  // イベント
  $('themeToggle').addEventListener('click', toggleTheme);
  applyThemeFromStorage();

  // 入力系
  ['habit'].forEach(id => $(id).addEventListener('change', enforceHabitRules));

  // 計算ボタン（1箇所だけでハンドリング）
  $('calcBtn').addEventListener('click', (e) => {
    e.preventDefault();
    if (requireFilled()) {
      enforceHabitRules();
      saveFormToSession();
      selectedWeek = selectedWeek || 1;
      selectedDayAbs = selectedDayAbs || 1;
      calc();
    } else {
      const pressed = $('calcBtn').getAttribute('aria-pressed') === 'true';
      $('calcBtn').setAttribute('aria-pressed', pressed ? 'false' : 'true');
    }
  });

  // 修正案
  setupFixer();

  // 初期表示は空（計算押下で表示）
  ['baseCard', 'macroCard', 'mixCard'].forEach(id => $(id).style.display = 'none');
  $('fitnessType').disabled = true; $('onoff').disabled = true;

  // 復元（任意）
  restoreFromSession();

  // リサイズ時にグラフを再描画
  window.addEventListener('resize', () => { if (window._chartArgs) drawCarbChart(window._chartArgs); });
}

// DOM ready
document.addEventListener('DOMContentLoaded', init);

// デバッグ用フック（任意）
window.NeoDiet = Object.assign(window.NeoDiet || {}, { calc, enforceHabitRules });
