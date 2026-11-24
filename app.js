const STORAGE_KEY = 'dpa_calculator_state_v1';

const els = {
  weekNum: document.getElementById('weekNum'),
  phaseMode: document.getElementById('phaseMode'),
  phaseBadge: document.getElementById('phaseBadge'),
  phase2Controls: document.getElementById('phase2Controls'),
  contractDemand: document.getElementById('contractDemand'),
  tau: document.getElementById('tau'),
  flexPlus: document.getElementById('flexPlus'),
  flexType: document.getElementById('flexType'),
  levelPrev: document.getElementById('levelPrev'),
  alpha: document.getElementById('alpha'),
  trendPrev: document.getElementById('trendPrev'),
  seasonality: document.getElementById('seasonality'),
  beta: document.getElementById('beta'),
  kFactor: document.getElementById('kFactor'),
  sigmaError: document.getElementById('sigmaError'),
  leadTime: document.getElementById('leadTime'),
  dpaOutput: document.getElementById('dpaOutput'),
  floorOutput: document.getElementById('floorOutput'),
  statFlexOutput: document.getElementById('statFlexOutput'),
  ssOutput: document.getElementById('ssOutput'),
  driverNote: document.getElementById('driverNote'),
  actualDemand: document.getElementById('actualDemand'),
  btnRecordWeek: document.getElementById('btnRecordWeek'),
  btnClearHistory: document.getElementById('btnClearHistory'),
  historyBody: document.getElementById('historyBody')
};

let historyData = [];

function getActivePhase() {
  const mode = els.phaseMode.value;
  if (mode === '1') return 1;
  if (mode === '2') return 2;
  const week = parseInt(els.weekNum.value, 10) || 1;
  return week <= 8 ? 1 : 2;
}

function calculateDPA() {
  const phase = getActivePhase();

  // Actualizar UI según fase
  if (phase === 1) {
    els.phaseBadge.textContent = 'Fase 1: Arranque (Sem 1-8)';
    els.phaseBadge.className = 'badge phase-1';
    els.phase2Controls.classList.add('hidden');
  } else {
    els.phaseBadge.textContent = 'Fase 2: Consolidación (Sem 9+)';
    els.phaseBadge.className = 'badge phase-2';
    els.phase2Controls.classList.remove('hidden');
  }

  const Ct = parseFloat(els.contractDemand.value) || 0;
  const tau = (parseFloat(els.tau.value) || 0) / 100;
  const flexRaw = parseFloat(els.flexPlus.value) || 0;
  const Ft = els.flexType.value === 'percent' ? Ct * (flexRaw / 100) : flexRaw;

  const L_prev = parseFloat(els.levelPrev.value) || 0;
  const b_prev = parseFloat(els.trendPrev.value) || 0;
  const S_tm = parseFloat(els.seasonality.value) || 1.0;

  // Pronóstico Estadístico D_estd,t
  let dEstd = 0;
  if (phase === 1) {
    // Suavización Exponencial Simple, S = 1.0 desactivada
    dEstd = L_prev;
  } else {
    // Holt-Winters Multiplicativo: (L_t-1 + b_t-1) * S_t-m
    dEstd = (L_prev + b_prev) * S_tm;
  }

  // Piso contractual: C_t * (1 - tau)
  const floorVal = Ct * (1 - tau);

  // Estadístico + Flexibilidad: D_estd,t + F_t
  const statPlusFlex = dEstd + Ft;

  // Máximo entre piso contractual y pronóstico + flexibilidad
  const baseDemand = Math.max(floorVal, statPlusFlex);

  // Stock de Seguridad: SS_t = k * sigma * sqrt(LT)
  const k = parseFloat(els.kFactor.value) || 1.65;
  const sigma = parseFloat(els.sigmaError.value) || 0;
  const lt = parseFloat(els.leadTime.value) || 1;
  const ssVal = k * sigma * Math.sqrt(lt);

  const dpaTotal = baseDemand + ssVal;

  // Renderizar valores
  els.dpaOutput.textContent = Math.ceil(dpaTotal).toLocaleString('es-ES');
  els.floorOutput.textContent = floorVal.toFixed(1);
  els.statFlexOutput.textContent = statPlusFlex.toFixed(1);
  els.ssOutput.textContent = ssVal.toFixed(1);

  if (floorVal >= statPlusFlex) {
    els.driverNote.textContent = 'Guía activa: Piso Contractual C_t(1-τ) domina el cálculo.';
  } else {
    els.driverNote.textContent = phase === 1
      ? 'Guía activa: Suavización Simple + Flexibilidad superan el piso.'
      : 'Guía activa: Holt-Winters (Tendencia/Estacionalidad) + Flexibilidad.';
  }

  saveState();
  return { phase, Ct, dEstd, baseDemand, ssVal, dpaTotal };
}

function recordWeek() {
  const actual = parseFloat(els.actualDemand.value);
  if (isNaN(actual) || actual < 0) {
    alert('Introduce una demanda real válida (número >= 0).');
    return;
  }

  const current = calculateDPA();
  const week = parseInt(els.weekNum.value, 10) || 1;
  const alpha = parseFloat(els.alpha.value) || 0.35;
  const beta = parseFloat(els.beta.value) || 0.15;
  const L_prev = parseFloat(els.levelPrev.value) || 0;
  const b_prev = parseFloat(els.trendPrev.value) || 0;
  const S_tm = current.phase === 1 ? 1.0 : (parseFloat(els.seasonality.value) || 1.0);

  // Error de pronóstico estadístico
  const error = actual - current.dEstd;

  historyData.push({
    week,
    phase: current.phase,
    contract: current.Ct,
    dpa: Math.ceil(current.dpaTotal),
    actual,
    error: parseFloat(error.toFixed(1))
  });

  // Actualizar Nivel L_t y Tendencia b_t
  let L_new = L_prev;
  let b_new = b_prev;

  if (current.phase === 1) {
    L_new = alpha * actual + (1 - alpha) * L_prev;
  } else {
    L_new = alpha * (actual / S_tm) + (1 - alpha) * (L_prev + b_prev);
    b_new = beta * (L_new - L_prev) + (1 - beta) * b_prev;
  }

  els.levelPrev.value = L_new.toFixed(2);
  els.trendPrev.value = b_new.toFixed(2);

  // Recalcular desviación estándar real de errores (sigma_L) si hay >= 2 registros
  if (historyData.length >= 2) {
    const errors = historyData.map(h => h.error);
    const meanErr = errors.reduce((a, b) => a + b, 0) / errors.length;
    const variance = errors.reduce((acc, val) => acc + Math.pow(val - meanErr, 2), 0) / (errors.length - 1);
    const stdDev = Math.sqrt(variance);
    els.sigmaError.value = stdDev.toFixed(2);
  }

  // Avanzar semana y ajustar alfa sugerido al entrar en Semana 9
  const nextWeek = week + 1;
  els.weekNum.value = nextWeek;
  if (nextWeek === 9 && els.phaseMode.value === 'auto') {
    els.alpha.value = '0.20';
  }

  els.actualDemand.value = '';
  renderHistory();
  calculateDPA();
}

function renderHistory() {
  if (historyData.length === 0) {
    els.historyBody.innerHTML = '<tr><td colspan="6" class="empty-row">Sin semanas registradas aún</td></tr>';
    return;
  }

  els.historyBody.innerHTML = historyData
    .slice()
    .reverse()
    .map(row => `
      <tr>
        <td>S${row.week}</td>
        <td>F${row.phase}</td>
        <td>${row.contract}</td>
        <td><strong>${row.dpa}</strong></td>
        <td>${row.actual}</td>
        <td>${row.error > 0 ? '+' + row.error : row.error}</td>
      </tr>
    `).join('');
}

function saveState() {
  const state = {
    weekNum: els.weekNum.value,
    phaseMode: els.phaseMode.value,
    contractDemand: els.contractDemand.value,
    tau: els.tau.value,
    flexPlus: els.flexPlus.value,
    flexType: els.flexType.value,
    levelPrev: els.levelPrev.value,
    alpha: els.alpha.value,
    trendPrev: els.trendPrev.value,
    seasonality: els.seasonality.value,
    beta: els.beta.value,
    kFactor: els.kFactor.value,
    sigmaError: els.sigmaError.value,
    leadTime: els.leadTime.value,
    historyData
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const s = JSON.parse(raw);
    if (s.weekNum) els.weekNum.value = s.weekNum;
    if (s.phaseMode) els.phaseMode.value = s.phaseMode;
    if (s.contractDemand) els.contractDemand.value = s.contractDemand;
    if (s.tau) els.tau.value = s.tau;
    if (s.flexPlus) els.flexPlus.value = s.flexPlus;
    if (s.flexType) els.flexType.value = s.flexType;
    if (s.levelPrev) els.levelPrev.value = s.levelPrev;
    if (s.alpha) els.alpha.value = s.alpha;
    if (s.trendPrev) els.trendPrev.value = s.trendPrev;
    if (s.seasonality) els.seasonality.value = s.seasonality;
    if (s.beta) els.beta.value = s.beta;
    if (s.kFactor) els.kFactor.value = s.kFactor;
    if (s.sigmaError) els.sigmaError.value = s.sigmaError;
    if (s.leadTime) els.leadTime.value = s.leadTime;
    if (Array.isArray(s.historyData)) historyData = s.historyData;
  } catch (e) {
    console.error('Error cargando estado:', e);
  }
}

function clearHistory() {
  if (!confirm('¿Reiniciar todo el historial y volver a la Semana 1?')) return;
  historyData = [];
  els.weekNum.value = 1;
  els.alpha.value = '0.35';
  els.levelPrev.value = els.contractDemand.value || 100;
  els.trendPrev.value = 0;
  els.seasonality.value = '1.0';
  localStorage.removeItem(STORAGE_KEY);
  renderHistory();
  calculateDPA();
}

// Eventos
document.querySelectorAll('input, select').forEach(el => {
  if (el.id !== 'actualDemand') {
    el.addEventListener('input', calculateDPA);
    el.addEventListener('change', calculateDPA);
  }
});

els.btnRecordWeek.addEventListener('click', recordWeek);
els.btnClearHistory.addEventListener('click', clearHistory);

// Registro del Service Worker para funcionamiento Offline (PWA)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW error:', err));
  });
}

loadState();
renderHistory();
calculateDPA();
