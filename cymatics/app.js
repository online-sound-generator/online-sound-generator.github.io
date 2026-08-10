(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const canvas = $('glCanvas');
  const guideCanvas = $('guideCanvas');
  const stage = $('stage');
  const guideCtx = guideCanvas.getContext('2d');
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, preserveDrawingBuffer: true });
  if (!gl) {
    $('message').textContent = 'WebGL2 is not available in this browser.';
    throw new Error('WebGL2 unavailable');
  }

  const ui = {
    modeTone: $('modeTone'), modeFile: $('modeFile'), toneControls: $('toneControls'), fileControls: $('fileControls'),
    toneFreqLog: $('toneFreqLog'), toneFreq: $('toneFreq'), toneFreqOut: $('toneFreqOut'), freqPresets: $('freqPresets'),
    audioFile: $('audioFile'), fileName: $('fileName'), fileMeta: $('fileMeta'),
    startBtn: $('startBtn'), stopBtn: $('stopBtn'), resetBtn: $('resetBtn'), volume: $('volume'), volumeOut: $('volumeOut'),
    boundary: $('boundary'), fundamental: $('fundamental'), fundamentalOut: $('fundamentalOut'), quality: $('quality'), qualityOut: $('qualityOut'),
    strength: $('strength'), strengthOut: $('strengthOut'), sensitivity: $('sensitivity'), sensitivityOut: $('sensitivityOut'),
    particleCount: $('particleCount'), particleCountOut: $('particleCountOut'), mobility: $('mobility'), mobilityOut: $('mobilityOut'),
    friction: $('friction'), frictionOut: $('frictionOut'), collisions: $('collisions'), collisionsOut: $('collisionsOut'),
    restitution: $('restitution'), restitutionOut: $('restitutionOut'), bgColor: $('bgColor'), sandColor: $('sandColor'),
    grainSize: $('grainSize'), grainSizeOut: $('grainSizeOut'), showGuide: $('showGuide'), showEmitter: $('showEmitter'),
    emitterXInput: $('emitterXInput'), emitterYInput: $('emitterYInput'), centerEmitterBtn: $('centerEmitterBtn'),
    motionType: $('motionType'), motionControls: $('motionControls'), restartMotionBtn: $('restartMotionBtn'),
    motionCenterX: $('motionCenterX'), motionCenterY: $('motionCenterY'), motionAmpX: $('motionAmpX'), motionAmpY: $('motionAmpY'),
    motionRate: $('motionRate'), motionRateOut: $('motionRateOut'), motionPhase: $('motionPhase'), motionPhaseOut: $('motionPhaseOut'),
    lineOptions: $('lineOptions'), lineAngle: $('lineAngle'), lineAngleOut: $('lineAngleOut'),
    sineOptions: $('sineOptions'), sineCycles: $('sineCycles'), sineCyclesOut: $('sineCyclesOut'),
    lissajousOptions: $('lissajousOptions'), lissajousA: $('lissajousA'), lissajousB: $('lissajousB'),
    motionCenterFromCurrentBtn: $('motionCenterFromCurrentBtn'), motionFormula: $('motionFormula'),
    exportConfigBtn: $('exportConfigBtn'), exportSnapshotBtn: $('exportSnapshotBtn'), importPatternFile: $('importPatternFile'), shareStatus: $('shareStatus'),
    shotBtn: $('shotBtn'), recordBtn: $('recordBtn'), fpsBadge: $('fpsBadge'), driveHud: $('driveHud'), freqHud: $('freqHud'),
    modeHud: $('modeHud'), speedHud: $('speedHud'), activeHud: $('activeHud'), collisionHud: $('collisionHud'), message: $('message'),
    helpModal: $('helpModal'), helpTitle: $('helpTitle'), helpBody: $('helpBody'), closeHelpBtn: $('closeHelpBtn')
  };

  const audioEl = $('audioEl');
  let sourceMode = 'tone';
  let running = false;
  let audioCtx = null, analyser = null, monitorGain = null, recordDest = null, mediaNode = null, oscillator = null, oscGain = null;
  let freqData = null, currentObjectUrl = null;
  let dominantFrequency = 345, audioDrive = 0;
  let driveComponents = [{ f: 345, amp: 1 }];
  let pendingImportedAudio = null;

  // Point renderer. Physics stays on CPU typed arrays so state changes are explicit and easy to debug.
  const vs = `#version 300 es
  precision highp float;
  layout(location=0) in vec2 aPosition;
  uniform vec2 uScale;
  uniform float uPointSize;
  void main(){
    gl_Position = vec4(aPosition * uScale, 0.0, 1.0);
    gl_PointSize = uPointSize;
  }`;
  const fs = `#version 300 es
  precision highp float;
  uniform vec3 uColor;
  out vec4 outColor;
  void main(){
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(p,p);
    if(r2 > 1.0) discard;
    float a = 1.0 - smoothstep(0.50, 1.0, r2);
    outColor = vec4(uColor, a);
  }`;

  function compile(type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
    return sh;
  }

  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, vs));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  const uScale = gl.getUniformLocation(program, 'uScale');
  const uPointSize = gl.getUniformLocation(program, 'uPointSize');
  const uColor = gl.getUniformLocation(program, 'uColor');
  const posBuffer = gl.createBuffer();
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  function hexRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  // -------------------- Plate modal model --------------------
  // The simulation resolves the time-averaged vibration energy of a forced thin plate.
  // Square: simply-supported analytic modes sin(m*pi*x)sin(n*pi*y), f_mn proportional to m^2+n^2.
  // Circle: Bessel-like J_m(alpha_mn*r) angular modes, f_mn proportional to alpha_mn^2.

  const FIELD = 112;
  const FIELD_N = FIELD * FIELD;
  const fieldEnergy = new Float32Array(FIELD_N);
  const fieldGradX = new Float32Array(FIELD_N);
  const fieldGradY = new Float32Array(FIELD_N);
  const tempRe = new Float32Array(FIELD_N);
  const tempIm = new Float32Array(FIELD_N);
  const fieldR = new Float32Array(FIELD_N);
  const fieldTheta = new Float32Array(FIELD_N);
  const fieldCos = Array.from({ length: 17 }, () => new Float32Array(FIELD_N));
  const fieldSin = Array.from({ length: 17 }, () => new Float32Array(FIELD_N));
  const sinAxis = Array.from({ length: 37 }, () => new Float32Array(FIELD));
  const circleRadialCache = new Map();

  for (let iy = 0; iy < FIELD; iy++) {
    const y = -1 + 2 * iy / (FIELD - 1);
    for (let ix = 0; ix < FIELD; ix++) {
      const x = -1 + 2 * ix / (FIELD - 1);
      const k = iy * FIELD + ix;
      const r = Math.hypot(x, y);
      const th = Math.atan2(y, x);
      fieldR[k] = r;
      fieldTheta[k] = th;
      for (let m = 0; m <= 16; m++) {
        fieldCos[m][k] = Math.cos(m * th);
        fieldSin[m][k] = Math.sin(m * th);
      }
    }
  }
  for (let m = 1; m <= 36; m++) {
    for (let i = 0; i < FIELD; i++) {
      const u = i / (FIELD - 1);
      sinAxis[m][i] = Math.sin(m * Math.PI * u);
    }
  }

  const lowBesselZeros = [
    [2.4048,5.5201,8.6537,11.7915,14.9309,18.0711,21.2116,24.3525],
    [3.8317,7.0156,10.1735,13.3237,16.4706,19.6159,22.7601,25.9037],
    [5.1356,8.4172,11.6198,14.7960,17.9598,21.1170,24.2701,27.4206],
    [6.3802,9.7610,13.0152,16.2235,19.4094,22.5827,25.7482,28.9084],
    [7.5883,11.0647,14.3725,17.6160,20.8269,24.0190,27.1991,30.3710],
    [8.7715,12.3386,15.7002,18.9801,22.2178,25.4303,28.6266,31.8117],
    [9.9361,13.5893,17.0038,20.3208,23.5861,26.8202,30.0337,33.2330],
    [11.0864,14.8213,18.2876,21.6415,24.9349,28.1912,31.4228,34.6371],
    [12.2251,16.0378,19.5545,22.9452,26.2668,29.5457,32.7958,36.0195]
  ];

  function besselZero(m, n) {
    if (m < lowBesselZeros.length && n <= lowBesselZeros[m].length) return lowBesselZeros[m][n - 1];
    const beta = Math.PI * (n + m * 0.5 - 0.25);
    return beta - (4 * m * m - 1) / (8 * beta);
  }

  function factorial(n) {
    let v = 1;
    for (let i = 2; i <= n; i++) v *= i;
    return v;
  }

  function besselJ(m, x) {
    const ax = Math.abs(x);
    if (ax < 14) {
      let term = Math.pow(x * 0.5, m) / factorial(m);
      let sum = term;
      for (let k = 1; k < 42; k++) {
        term *= -(x * x * 0.25) / (k * (m + k));
        sum += term;
        if (Math.abs(term) < Math.abs(sum) * 1e-12 + 1e-14) break;
      }
      return sum;
    }
    const mu = 4 * m * m;
    const chi = ax - m * Math.PI * 0.5 - Math.PI * 0.25;
    const inv8x = 1 / (8 * ax);
    const root = Math.sqrt(2 / (Math.PI * ax));
    const c = Math.cos(chi), s = Math.sin(chi);
    return root * (c - (mu - 1) * inv8x * s - ((mu - 1) * (mu - 9) * inv8x * inv8x * 0.5) * c);
  }

  function circleRadial(mode) {
    const key = `${mode.m}:${mode.n}`;
    let arr = circleRadialCache.get(key);
    if (arr) return arr;
    arr = new Float32Array(256);
    for (let i = 0; i < arr.length; i++) arr[i] = besselJ(mode.m, mode.alpha * i / (arr.length - 1));
    circleRadialCache.set(key, arr);
    return arr;
  }

  function squareModes() {
    const base = parseFloat(ui.fundamental.value);
    const modes = [];
    for (let m = 1; m <= 36; m++) for (let n = 1; n <= 36; n++) {
      modes.push({ type: 'square', m, n, f0: base * (m * m + n * n) / 2 });
    }
    return modes;
  }

  function circleModes() {
    const base = parseFloat(ui.fundamental.value);
    const a01 = besselZero(0, 1);
    const modes = [];
    for (let m = 0; m <= 16; m++) for (let n = 1; n <= 28; n++) {
      const alpha = besselZero(m, n);
      modes.push({ type: 'circle', m, n, alpha, f0: base * (alpha * alpha) / (a01 * a01) });
    }
    return modes;
  }

  let modeLibrary = circleModes();
  let activeModes = [];
  let dominantModeLabel = '—';
  let plateResponse = 0;
  let emitterX = 0, emitterY = 0;
  const EMITTER_LIMIT = 0.985;
  let sourceMotionTime = 0;
  let fieldDirty = true;
  let fieldUpdateTimer = 0;

  function constrainEmitter(px, py) {
    px = Number.isFinite(px) ? px : 0;
    py = Number.isFinite(py) ? py : 0;
    if (ui.boundary.value === 'circle') {
      const r = Math.hypot(px, py);
      if (r > EMITTER_LIMIT) {
        const k = EMITTER_LIMIT / Math.max(r, 1e-9);
        px *= k;
        py *= k;
      }
    } else {
      px = Math.max(-EMITTER_LIMIT, Math.min(EMITTER_LIMIT, px));
      py = Math.max(-EMITTER_LIMIT, Math.min(EMITTER_LIMIT, py));
    }
    return [px, py];
  }

  function syncEmitterInputs() {
    if (!ui.emitterXInput || !ui.emitterYInput) return;
    ui.emitterXInput.value = emitterX.toFixed(3);
    ui.emitterYInput.value = emitterY.toFixed(3);
  }

  function setEmitterPosition(px, py, syncInputs = true) {
    [emitterX, emitterY] = constrainEmitter(px, py);
    if (syncInputs) syncEmitterInputs();
    fieldDirty = true;
  }

  function readMotionNumber(el, fallback = 0) {
    const n = Number(el && el.value);
    return Number.isFinite(n) ? n : fallback;
  }

  function clampMotionCenter() {
    let cx = readMotionNumber(ui.motionCenterX, 0);
    let cy = readMotionNumber(ui.motionCenterY, 0);
    [cx, cy] = constrainEmitter(cx, cy);
    ui.motionCenterX.value = cx.toFixed(3);
    ui.motionCenterY.value = cy.toFixed(3);
    return [cx, cy];
  }

  function triangleWave(theta) {
    // Period 2π, range [-1, 1], with constant horizontal speed between turnarounds.
    const p = ((theta / (Math.PI * 2)) % 1 + 1) % 1;
    return 1 - 4 * Math.abs(p - 0.5);
  }

  function motionPositionAt(timeSeconds) {
    const type = ui.motionType.value;
    if (type === 'manual') return [emitterX, emitterY];
    const [cx, cy] = constrainEmitter(readMotionNumber(ui.motionCenterX, 0), readMotionNumber(ui.motionCenterY, 0));
    const axm = Math.max(0, Math.min(1.95, readMotionNumber(ui.motionAmpX, 0.5)));
    const aym = Math.max(0, Math.min(1.95, readMotionNumber(ui.motionAmpY, 0.5)));
    const rate = Math.max(0, readMotionNumber(ui.motionRate, 0.1));
    const phase = readMotionNumber(ui.motionPhase, 0) * Math.PI / 180;
    const theta = Math.PI * 2 * rate * timeSeconds + phase;
    let px = cx, py = cy;

    if (type === 'circle') {
      px = cx + axm * Math.cos(theta);
      py = cy + aym * Math.sin(theta);
    } else if (type === 'line') {
      const angle = readMotionNumber(ui.lineAngle, 0) * Math.PI / 180;
      const travel = Math.sin(theta);
      px = cx + axm * Math.cos(angle) * travel;
      py = cy + axm * Math.sin(angle) * travel;
    } else if (type === 'sine') {
      const sweep = triangleWave(theta);
      const cycles = Math.max(0.5, readMotionNumber(ui.sineCycles, 2));
      px = cx + axm * sweep;
      py = cy + aym * Math.sin(Math.PI * cycles * sweep);
    } else if (type === 'figure8') {
      px = cx + axm * Math.sin(theta);
      py = cy + aym * Math.sin(theta * 2);
    } else if (type === 'lissajous') {
      const a = Math.max(1, Math.min(12, Math.round(readMotionNumber(ui.lissajousA, 3))));
      const b = Math.max(1, Math.min(12, Math.round(readMotionNumber(ui.lissajousB, 2))));
      px = cx + axm * Math.sin(a * theta + Math.PI * 0.5);
      py = cy + aym * Math.sin(b * theta);
    }
    return constrainEmitter(px, py);
  }

  function updateMotionFormula() {
    const type = ui.motionType.value;
    const rate = readMotionNumber(ui.motionRate, 0.1);
    const phase = readMotionNumber(ui.motionPhase, 0);
    const labels = {
      manual: 'x(t) = constant, y(t) = constant',
      circle: `x(t)=cx+Ax·cos(2π·${rate.toFixed(3)}·t+${phase}°)   y(t)=cy+Ay·sin(2π·${rate.toFixed(3)}·t+${phase}°)`,
      line: `p(t)=sin(2π·${rate.toFixed(3)}·t+${phase}°); source moves along the selected line angle`,
      sine: `x(t)=cx+Ax·triangle(2πft); y(t)=cy+Ay·sin(π·cycles·x̂(t))`,
      figure8: `x(t)=cx+Ax·sin(2πft+φ); y(t)=cy+Ay·sin(4πft+2φ)`,
      lissajous: `x(t)=cx+Ax·sin(a·2πft+π/2); y(t)=cy+Ay·sin(b·2πft)`
    };
    ui.motionFormula.textContent = labels[type] || labels.manual;
  }

  function syncMotionUi() {
    const type = ui.motionType.value;
    ui.motionControls.hidden = type === 'manual';
    ui.lineOptions.hidden = type !== 'line';
    ui.sineOptions.hidden = type !== 'sine';
    ui.lissajousOptions.hidden = type !== 'lissajous';
    ui.restartMotionBtn.disabled = type === 'manual';
    updateMotionFormula();
  }

  function setMotionType(type, keepCurrentAsCenter = true) {
    const allowed = new Set(['manual', 'circle', 'line', 'sine', 'figure8', 'lissajous']);
    ui.motionType.value = allowed.has(type) ? type : 'manual';
    if (ui.motionType.value !== 'manual' && keepCurrentAsCenter) {
      ui.motionCenterX.value = emitterX.toFixed(3);
      ui.motionCenterY.value = emitterY.toFixed(3);
    }
    sourceMotionTime = 0;
    syncMotionUi();
    if (ui.motionType.value !== 'manual') {
      const [px, py] = motionPositionAt(0);
      setEmitterPosition(px, py);
    }
  }

  function updateAutomatedEmitter(dt) {
    if (!running || ui.motionType.value === 'manual') return;
    sourceMotionTime += dt;
    const [px, py] = motionPositionAt(sourceMotionTime);
    setEmitterPosition(px, py);
  }

  function rebuildModeLibrary() {
    modeLibrary = ui.boundary.value === 'circle' ? circleModes() : squareModes();
    fieldDirty = true;
  }

  function modeAtEmitter(mode) {
    if (mode.type === 'square') {
      const u = (emitterX + 1) * 0.5;
      const v = (emitterY + 1) * 0.5;
      return Math.sin(mode.m * Math.PI * u) * Math.sin(mode.n * Math.PI * v);
    }
    const r = Math.min(0.999, Math.hypot(emitterX, emitterY));
    if (r < 1e-7 && mode.m > 0) return 0;
    return besselJ(mode.m, mode.alpha * r);
  }

  function complexResponse(f, f0, q) {
    const r = Math.max(1e-6, f / Math.max(1e-6, f0));
    const a = 1 - r * r;
    const b = r / q;
    const d = a * a + b * b + 1e-12;
    return { re: a / d, im: -b / d, mag: 1 / Math.sqrt(d) };
  }

  function selectActiveModes(component) {
    const q = parseFloat(ui.quality.value);
    const scored = [];
    const thetaE = Math.atan2(emitterY, emitterX);
    for (let i = 0; i < modeLibrary.length; i++) {
      const mode = modeLibrary[i];
      const coupling = modeAtEmitter(mode);
      const h = complexResponse(component.f, mode.f0, q);
      const mag = Math.abs(coupling) * h.mag * component.amp;
      if (mag < 1e-5) continue;
      scored.push({ mode, coupling, h, mag, thetaE });
    }
    scored.sort((a, b) => b.mag - a.mag);
    return scored.slice(0, 7);
  }

  function evalModeAtField(entry, ix, iy, k) {
    const mode = entry.mode;
    if (mode.type === 'square') return sinAxis[mode.m][ix] * sinAxis[mode.n][iy];
    const r = fieldR[k];
    if (r > 1) return 0;
    const radial = circleRadial(mode);
    const ri = Math.min(255, (r * 255) | 0);
    if (mode.m === 0) return radial[ri];
    const ce = Math.cos(mode.m * entry.thetaE);
    const se = Math.sin(mode.m * entry.thetaE);
    const angular = fieldCos[mode.m][k] * ce + fieldSin[mode.m][k] * se;
    return radial[ri] * angular;
  }

  function updatePlateField() {
    fieldEnergy.fill(0);
    activeModes = [];
    let strongest = null;
    let strongestMag = 0;
    let rawResponse = 0;

    const components = driveComponents.length ? driveComponents : [{ f: dominantFrequency, amp: audioDrive }];
    for (const component of components.slice(0, 5)) {
      if (component.amp < 0.01 || component.f <= 0) continue;
      const selected = selectActiveModes(component);
      if (!selected.length) continue;
      activeModes.push(...selected);
      tempRe.fill(0);
      tempIm.fill(0);

      let scale = 0;
      for (const entry of selected) scale = Math.max(scale, entry.mag);
      scale = Math.max(scale, 1e-6);

      for (const entry of selected) {
        if (entry.mag > strongestMag) { strongestMag = entry.mag; strongest = entry; }
        rawResponse = Math.max(rawResponse, entry.mag);
        // Normalize within this spectral component to avoid numerical explosions exactly at resonance.
        entry.wRe = component.amp * entry.coupling * entry.h.re / scale;
        entry.wIm = component.amp * entry.coupling * entry.h.im / scale;
      }

      for (let iy = 0; iy < FIELD; iy++) {
        for (let ix = 0; ix < FIELD; ix++) {
          const k = iy * FIELD + ix;
          if (ui.boundary.value === 'circle' && fieldR[k] > 1) continue;
          let re = 0, im = 0;
          for (const entry of selected) {
            const phi = evalModeAtField(entry, ix, iy, k);
            re += entry.wRe * phi;
            im += entry.wIm * phi;
          }
          tempRe[k] = re;
          tempIm[k] = im;
          fieldEnergy[k] += re * re + im * im;
        }
      }
    }

    let maxE = 1e-8;
    for (let k = 0; k < FIELD_N; k++) if (fieldEnergy[k] > maxE) maxE = fieldEnergy[k];
    const invMax = 1 / maxE;
    for (let k = 0; k < FIELD_N; k++) fieldEnergy[k] = Math.sqrt(fieldEnergy[k] * invMax);

    const invDx = (FIELD - 1) * 0.25; // central difference / world-space dx
    for (let iy = 0; iy < FIELD; iy++) {
      const y0 = Math.max(0, iy - 1), y1 = Math.min(FIELD - 1, iy + 1);
      for (let ix = 0; ix < FIELD; ix++) {
        const x0 = Math.max(0, ix - 1), x1 = Math.min(FIELD - 1, ix + 1);
        const k = iy * FIELD + ix;
        fieldGradX[k] = (fieldEnergy[iy * FIELD + x1] - fieldEnergy[iy * FIELD + x0]) * invDx;
        fieldGradY[k] = (fieldEnergy[y1 * FIELD + ix] - fieldEnergy[y0 * FIELD + ix]) * invDx;
      }
    }

    // Soft-compressed resonant gain: still stronger near resonance, never singular.
    plateResponse = Math.min(2.5, Math.log1p(rawResponse) / Math.log(10));
    if (strongest) {
      const m = strongest.mode;
      dominantModeLabel = m.type === 'circle' ? `J${m.m},${m.n} · ${Math.round(m.f0)} Hz` : `${m.m}×${m.n} · ${Math.round(m.f0)} Hz`;
    } else dominantModeLabel = '—';
    fieldDirty = false;
  }

  function sampleField(arr, px, py) {
    const gx = Math.max(0, Math.min(FIELD - 1.001, (px + 1) * 0.5 * (FIELD - 1)));
    const gy = Math.max(0, Math.min(FIELD - 1.001, (py + 1) * 0.5 * (FIELD - 1)));
    const x0 = gx | 0, y0 = gy | 0, x1 = Math.min(FIELD - 1, x0 + 1), y1 = Math.min(FIELD - 1, y0 + 1);
    const tx = gx - x0, ty = gy - y0;
    const a = arr[y0 * FIELD + x0] * (1 - tx) + arr[y0 * FIELD + x1] * tx;
    const b = arr[y1 * FIELD + x0] * (1 - tx) + arr[y1 * FIELD + x1] * tx;
    return a * (1 - ty) + b * ty;
  }

  // -------------------- Granular model --------------------
  let N = 0;
  let x, y, vx, vy, phase, positions, ax, ay, next;
  const COLL_GRID = 128;
  const heads = new Int32Array(COLL_GRID * COLL_GRID);
  let grainDiameter = 0.0065;
  let collisionCounter = 0;
  let collisionsPerSecond = 0;
  let meanSpeed = 0;

  function randomPointInDomain() {
    if (ui.boundary.value === 'circle') {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * 0.965;
      return [Math.cos(a) * r, Math.sin(a) * r];
    }
    return [Math.random() * 1.93 - 0.965, Math.random() * 1.93 - 0.965];
  }

  function resetParticles() {
    N = parseInt(ui.particleCount.value, 10);
    x = new Float32Array(N); y = new Float32Array(N); vx = new Float32Array(N); vy = new Float32Array(N);
    phase = new Float32Array(N); positions = new Float32Array(N * 2); ax = new Float32Array(N); ay = new Float32Array(N);
    next = new Int32Array(N);
    grainDiameter = 0.0062 * Math.sqrt(25000 / N);
    grainDiameter = Math.max(0.0044, Math.min(0.011, grainDiameter));
    for (let i = 0; i < N; i++) {
      const p = randomPointInDomain();
      x[i] = p[0]; y[i] = p[1];
      vx[i] = 0; vy[i] = 0;
      phase[i] = Math.random() * Math.PI * 2;
      positions[i * 2] = x[i]; positions[i * 2 + 1] = y[i];
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions.byteLength, gl.DYNAMIC_DRAW);
    ui.particleCountOut.value = N.toLocaleString();
    ui.message.textContent = 'Sand reset. Press Start; grains now collide locally and respond to plate modes.';
  }

  function buildCollisionGrid() {
    heads.fill(-1);
    for (let i = 0; i < N; i++) {
      const ix = Math.max(0, Math.min(COLL_GRID - 1, ((x[i] + 1) * 0.5 * COLL_GRID) | 0));
      const iy = Math.max(0, Math.min(COLL_GRID - 1, ((y[i] + 1) * 0.5 * COLL_GRID) | 0));
      const c = iy * COLL_GRID + ix;
      next[i] = heads[c];
      heads[c] = i;
    }
  }

  function applyGrainCollisions(dt) {
    const collisionScale = parseFloat(ui.collisions.value);
    if (collisionScale <= 0) return;
    const d0 = grainDiameter;
    const d02 = d0 * d0;
    const stiffness = 135 * collisionScale;
    const normalDamping = 1.7 * collisionScale;
    const tangentDamping = 0.12 * collisionScale;
    const cellSpan = Math.max(1, Math.ceil(d0 / (2 / COLL_GRID)));

    for (let i = 0; i < N; i++) {
      const ix = Math.max(0, Math.min(COLL_GRID - 1, ((x[i] + 1) * 0.5 * COLL_GRID) | 0));
      const iy = Math.max(0, Math.min(COLL_GRID - 1, ((y[i] + 1) * 0.5 * COLL_GRID) | 0));
      for (let cy = Math.max(0, iy - cellSpan); cy <= Math.min(COLL_GRID - 1, iy + cellSpan); cy++) {
        for (let cx = Math.max(0, ix - cellSpan); cx <= Math.min(COLL_GRID - 1, ix + cellSpan); cx++) {
          let j = heads[cy * COLL_GRID + cx];
          while (j !== -1) {
            if (j > i) {
              const dx = x[j] - x[i], dy = y[j] - y[i];
              const d2 = dx * dx + dy * dy;
              if (d2 > 1e-10 && d2 < d02) {
                const d = Math.sqrt(d2);
                const nx = dx / d, ny = dy / d;
                const overlap = (d0 - d) / d0;
                const rvx = vx[j] - vx[i], rvy = vy[j] - vy[i];
                const vn = rvx * nx + rvy * ny;
                let fn = stiffness * overlap;
                if (vn < 0) fn += -vn * normalDamping;
                const fx = fn * nx, fy = fn * ny;
                ax[i] -= fx; ay[i] -= fy; ax[j] += fx; ay[j] += fy;

                const tx = -ny, ty = nx;
                const vt = rvx * tx + rvy * ty;
                const ft = vt * tangentDamping;
                ax[i] += ft * tx; ay[i] += ft * ty;
                ax[j] -= ft * tx; ay[j] -= ft * ty;
                collisionCounter++;
              }
            }
            j = next[j];
          }
        }
      }
    }
  }

  let simTime = 0;
  const PHYSICS_DT = 1 / 45;
  let physicsAccumulator = 0;

  function physicsStep(dt) {
    if (!running || audioDrive < 0.001) return;
    if (fieldDirty) updatePlateField();
    ax.fill(0); ay.fill(0);

    const strength = parseFloat(ui.strength.value);
    const mobility = parseFloat(ui.mobility.value);
    const friction = parseFloat(ui.friction.value);
    const drive = Math.min(2.2, audioDrive * (0.45 + plateResponse));
    const dominant = Math.max(0.1, dominantFrequency);
    // Acceleration increases with frequency for a given displacement, but compress it heavily for browser-scale dynamics.
    const frequencyAccel = Math.pow(Math.max(0.05, Math.min(300, dominant / 345)), 0.18);

    for (let i = 0; i < N; i++) {
      const px = x[i], py = y[i];
      const e = sampleField(fieldEnergy, px, py);
      const gx = sampleField(fieldGradX, px, py);
      const gy = sampleField(fieldGradY, px, py);

      // Cycle-averaged nodal migration: grains are most mobile where local plate acceleration is high.
      const localAcceleration = drive * frequencyAccel * e;
      const fluidized = Math.max(0, Math.min(1, (localAcceleration - 0.08) / 0.65));
      const waveForce = strength * mobility * (0.15 + 0.85 * fluidized);
      ax[i] += -gx * waveForce;
      ay[i] += -gy * waveForce;

      // Deterministic micro-hopping approximates repeated detach/impact events unresolved at 60 Hz.
      const agitation = fluidized * drive * 1.35;
      ax[i] += Math.sin(phase[i] + simTime * 23.1 + i * 0.011) * agitation;
      ay[i] += Math.cos(phase[i] * 1.41 + simTime * 19.7 + i * 0.013) * agitation;
    }

    buildCollisionGrid();
    applyGrainCollisions(dt);

    let speedSum = 0;
    const restitution = parseFloat(ui.restitution.value);
    for (let i = 0; i < N; i++) {
      const e = sampleField(fieldEnergy, x[i], y[i]);
      const localAcceleration = drive * frequencyAccel * e;
      const fluidized = Math.max(0, Math.min(1, (localAcceleration - 0.08) / 0.65));
      // Static-like friction in nodes, lower kinetic friction on strongly vibrating areas.
      const localFriction = friction * (1.7 - 1.1 * fluidized) + (1 - fluidized) * 4.2;
      const damping = Math.exp(-localFriction * dt);
      let nvx = (vx[i] + ax[i] * dt) * damping;
      let nvy = (vy[i] + ay[i] * dt) * damping;
      let nx = x[i] + nvx * dt;
      let ny = y[i] + nvy * dt;

      if (ui.boundary.value === 'circle') {
        const edge = 0.982;
        const rr = Math.hypot(nx, ny);
        if (rr > edge) {
          const qx = nx / rr, qy = ny / rr;
          nx = qx * edge; ny = qy * edge;
          const vn = nvx * qx + nvy * qy;
          if (vn > 0) {
            nvx -= (1 + restitution) * vn * qx;
            nvy -= (1 + restitution) * vn * qy;
          }
          nvx *= 0.86; nvy *= 0.86;
        }
      } else {
        const edge = 0.982;
        if (nx < -edge) { nx = -edge; nvx = Math.abs(nvx) * restitution; }
        else if (nx > edge) { nx = edge; nvx = -Math.abs(nvx) * restitution; }
        if (ny < -edge) { ny = -edge; nvy = Math.abs(nvy) * restitution; }
        else if (ny > edge) { ny = edge; nvy = -Math.abs(nvy) * restitution; }
      }

      x[i] = nx; y[i] = ny; vx[i] = nvx; vy[i] = nvy;
      speedSum += Math.hypot(nvx, nvy);
    }
    meanSpeed = speedSum / Math.max(1, N);
    simTime += dt;
  }

  // -------------------- Audio --------------------
  async function ensureAudio() {
    if (audioCtx) {
      if (audioCtx.state === 'suspended') await audioCtx.resume();
      return;
    }
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 8192;
    analyser.smoothingTimeConstant = 0.68;
    monitorGain = audioCtx.createGain();
    monitorGain.gain.value = parseFloat(ui.volume.value);
    recordDest = audioCtx.createMediaStreamDestination();
    analyser.connect(monitorGain);
    monitorGain.connect(audioCtx.destination);
    monitorGain.connect(recordDest);
    freqData = new Uint8Array(analyser.frequencyBinCount);
  }

  function toneIsAudible(f) {
    if (!audioCtx) return false;
    return f >= 20 && f <= Math.min(20000, audioCtx.sampleRate * 0.45);
  }

  function startToneOscillator(f) {
    if (!audioCtx || !toneIsAudible(f)) return;
    stopOscillator();
    oscillator = audioCtx.createOscillator();
    oscGain = audioCtx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = f;
    oscGain.gain.value = 0.20;
    oscillator.connect(oscGain);
    oscGain.connect(analyser);
    oscillator.start();
  }

  async function startSound() {
    await ensureAudio();
    if (sourceMode === 'tone') {
      stopOscillator();
      const f = clampFrequency(parseFloat(ui.toneFreq.value));
      if (toneIsAudible(f)) startToneOscillator(f);
      return true;
    }
    if (!audioEl.src) {
      ui.message.textContent = 'Choose an audio file first.';
      return false;
    }
    if (!mediaNode) {
      mediaNode = audioCtx.createMediaElementSource(audioEl);
      mediaNode.connect(analyser);
    }
    if (audioEl.ended) audioEl.currentTime = 0;
    await audioEl.play();
    return true;
  }

  function stopOscillator() {
    if (oscillator) {
      try { oscillator.stop(); } catch (_) {}
      try { oscillator.disconnect(); } catch (_) {}
      oscillator = null;
    }
    if (oscGain) {
      try { oscGain.disconnect(); } catch (_) {}
      oscGain = null;
    }
  }

  function stopSound() {
    if (sourceMode === 'tone') stopOscillator();
    else audioEl.pause();
  }

  function analyseAudio() {
    const sensitivity = parseFloat(ui.sensitivity.value);
    if (sourceMode === 'tone') {
      const f = clampFrequency(parseFloat(ui.toneFreq.value));
      dominantFrequency = f;
      audioDrive = Math.min(1.8, 0.95 * sensitivity / 1.8);
      driveComponents = [{ f, amp: audioDrive }];
      fieldDirty = true;
      return;
    }
    if (!analyser || !freqData) {
      audioDrive = 0;
      driveComponents = [];
      return;
    }
    analyser.getByteFrequencyData(freqData);
    const binHz = audioCtx.sampleRate / analyser.fftSize;
    const candidates = [];
    let sum = 0, maxV = 0, maxI = 1;
    for (let i = 1; i < freqData.length - 1; i++) {
      const v = freqData[i];
      sum += v * v;
      if (v > maxV) { maxV = v; maxI = i; }
      if (v > 16 && v >= freqData[i - 1] && v >= freqData[i + 1]) candidates.push({ i, v });
    }
    candidates.sort((a, b) => b.v - a.v);
    const peaks = [];
    for (const c of candidates) {
      if (peaks.some(p => Math.abs(p.i - c.i) < 4)) continue;
      peaks.push(c);
      if (peaks.length === 5) break;
    }
    dominantFrequency = maxI * binHz;
    audioDrive = Math.min(1.8, Math.sqrt(sum / Math.max(1, freqData.length)) / 255 * sensitivity * 2.5);
    driveComponents = peaks.map(p => ({ f: p.i * binHz, amp: Math.pow(p.v / 255, 1.35) * sensitivity / 1.8 }));
    fieldDirty = true;
  }

  // -------------------- UI / interaction --------------------
  function clampFrequency(f) { return Math.max(0.1, Math.min(100000, Number.isFinite(f) ? f : 345)); }
  function formatHz(f) {
    if (f >= 1000) return `${(f / 1000).toFixed(f >= 10000 ? 1 : 2)} kHz`;
    if (f >= 10) return `${Math.round(f)} Hz`;
    return `${Number(f.toFixed(2))} Hz`;
  }
  function frequencyToSlider(f) { return Math.log10(clampFrequency(f)); }
  function sliderToFrequency(v) { return Math.pow(10, parseFloat(v)); }

  function setToneFrequency(f, updateSlider = true) {
    f = clampFrequency(f);
    ui.toneFreq.value = String(Number(f.toPrecision(7)));
    ui.toneFreqOut.value = formatHz(f);
    if (updateSlider) ui.toneFreqLog.value = String(frequencyToSlider(f));
    if (running && sourceMode === 'tone' && audioCtx) {
      if (toneIsAudible(f)) {
        if (oscillator) oscillator.frequency.setTargetAtTime(f, audioCtx.currentTime, 0.015);
        else startToneOscillator(f);
      } else if (oscillator) {
        stopOscillator();
      }
    }
    if (sourceMode === 'tone') {
      dominantFrequency = f;
      driveComponents = [{ f, amp: Math.max(0.2, audioDrive) }];
      fieldDirty = true;
    }
  }

  function setMode(mode) {
    sourceMode = mode;
    ui.modeTone.classList.toggle('active', mode === 'tone');
    ui.modeFile.classList.toggle('active', mode === 'file');
    ui.toneControls.hidden = mode !== 'tone';
    ui.fileControls.hidden = mode !== 'file';
    stopSound(); running = false; audioDrive = 0;
    fieldDirty = true;
    ui.message.textContent = mode === 'tone' ? 'Pure tone mode. Press Start.' : 'Load a file, then press Start.';
  }

  ui.modeTone.addEventListener('click', () => setMode('tone'));
  ui.modeFile.addEventListener('click', () => setMode('file'));
  ui.toneFreqLog.addEventListener('input', () => setToneFrequency(sliderToFrequency(ui.toneFreqLog.value), false));
  ui.toneFreq.addEventListener('input', () => setToneFrequency(parseFloat(ui.toneFreq.value), true));
  ui.freqPresets.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-f]');
    if (b) setToneFrequency(parseFloat(b.dataset.f), true);
  });

  ui.audioFile.addEventListener('change', () => {
    const file = ui.audioFile.files && ui.audioFile.files[0];
    if (!file) return;
    if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = URL.createObjectURL(file);
    audioEl.src = currentObjectUrl;
    ui.fileName.textContent = file.name;
    ui.fileMeta.textContent = `${(file.size / 1024 / 1024).toFixed(2)} MB · FFT peak excitation`;

    if (pendingImportedAudio) {
      const expected = pendingImportedAudio.meta;
      const matches = !expected || (file.name === expected.name && (!expected.size || file.size === expected.size));
      if (matches && Number.isFinite(pendingImportedAudio.time) && pendingImportedAudio.time > 0) {
        const seekTime = pendingImportedAudio.time;
        const applySeek = () => {
          if (Number.isFinite(audioEl.duration) && audioEl.duration > 0) audioEl.currentTime = Math.min(seekTime, Math.max(0, audioEl.duration - 0.01));
        };
        if (audioEl.readyState >= 1) applySeek();
        else audioEl.addEventListener('loadedmetadata', applySeek, { once: true });
      }
      ui.message.textContent = matches
        ? 'Matching audio loaded for imported setup. Press Start.'
        : `Audio loaded, but imported setup expected ${expected ? expected.name : 'a different file'}.`;
      pendingImportedAudio = null;
    } else {
      ui.message.textContent = 'Audio loaded. Press Start.';
    }
  });

  ui.startBtn.addEventListener('click', async () => {
    try {
      const ok = await startSound();
      if (ok === false) return;
      running = true;
      physicsAccumulator = 0;
      fieldDirty = true;
      ui.message.textContent = 'Running. Sand positions and velocities are changing physically.';
    } catch (err) {
      console.error(err);
      ui.message.textContent = `Audio start failed: ${err.message}`;
    }
  });
  ui.stopBtn.addEventListener('click', () => {
    running = false;
    stopSound();
    ui.message.textContent = 'Stopped. Grain positions are preserved.';
  });
  ui.resetBtn.addEventListener('click', resetParticles);

  ui.volume.addEventListener('input', () => {
    ui.volumeOut.value = `${Math.round(parseFloat(ui.volume.value) * 100)}%`;
    if (monitorGain && audioCtx) monitorGain.gain.setTargetAtTime(parseFloat(ui.volume.value), audioCtx.currentTime, 0.01);
  });

  const bindOut = (el, out, fmt) => el.addEventListener('input', () => out.value = fmt(el.value));
  bindOut(ui.fundamental, ui.fundamentalOut, v => `${Math.round(Number(v))} Hz`);
  bindOut(ui.quality, ui.qualityOut, v => `${Math.round(Number(v))}`);
  bindOut(ui.strength, ui.strengthOut, v => Number(v).toFixed(1));
  bindOut(ui.sensitivity, ui.sensitivityOut, v => `${Number(v).toFixed(1)}×`);
  bindOut(ui.particleCount, ui.particleCountOut, v => parseInt(v, 10).toLocaleString());
  bindOut(ui.mobility, ui.mobilityOut, v => `${Number(v).toFixed(2)}×`);
  bindOut(ui.friction, ui.frictionOut, v => Number(v).toFixed(1));
  bindOut(ui.collisions, ui.collisionsOut, v => `${Number(v).toFixed(2)}×`);
  bindOut(ui.restitution, ui.restitutionOut, v => Number(v).toFixed(2));
  bindOut(ui.grainSize, ui.grainSizeOut, v => `${Number(v).toFixed(2)} px`);

  ui.particleCount.addEventListener('change', resetParticles);
  ui.boundary.addEventListener('change', () => {
    rebuildModeLibrary();
    // Keep both the current source and any automated path center inside the newly selected wall.
    setEmitterPosition(emitterX, emitterY);
    clampMotionCenter();
    resetParticles();
  });
  ui.fundamental.addEventListener('input', rebuildModeLibrary);
  ui.quality.addEventListener('input', () => { fieldDirty = true; });
  ui.showGuide.addEventListener('change', () => { fieldDirty = true; });

  function applyEmitterInputs() {
    if (ui.motionType.value !== 'manual') setMotionType('manual', false);
    const px = parseFloat(ui.emitterXInput.value);
    const py = parseFloat(ui.emitterYInput.value);
    setEmitterPosition(px, py);
  }
  ui.emitterXInput.addEventListener('input', applyEmitterInputs);
  ui.emitterYInput.addEventListener('input', applyEmitterInputs);
  ui.emitterXInput.addEventListener('change', syncEmitterInputs);
  ui.emitterYInput.addEventListener('change', syncEmitterInputs);
  ui.centerEmitterBtn.addEventListener('click', () => {
    if (ui.motionType.value === 'manual') {
      setEmitterPosition(0, 0);
    } else {
      ui.motionCenterX.value = '0.000';
      ui.motionCenterY.value = '0.000';
      sourceMotionTime = 0;
      const [px, py] = motionPositionAt(0);
      setEmitterPosition(px, py);
    }
    ui.message.textContent = ui.motionType.value === 'manual'
      ? 'Sound source centered at (0.000, 0.000).'
      : 'Motion path centered on the plate and restarted.';
  });

  ui.motionType.addEventListener('change', () => setMotionType(ui.motionType.value, true));
  ui.restartMotionBtn.addEventListener('click', () => {
    sourceMotionTime = 0;
    if (ui.motionType.value !== 'manual') {
      const [px, py] = motionPositionAt(0);
      setEmitterPosition(px, py);
      ui.message.textContent = 'Source motion path restarted from t = 0.';
    }
  });
  ui.motionCenterFromCurrentBtn.addEventListener('click', () => {
    ui.motionCenterX.value = emitterX.toFixed(3);
    ui.motionCenterY.value = emitterY.toFixed(3);
    sourceMotionTime = 0;
    updateMotionFormula();
    ui.message.textContent = `Path center set to (${emitterX.toFixed(3)}, ${emitterY.toFixed(3)}).`;
  });
  ui.motionRate.addEventListener('input', () => { ui.motionRateOut.value = `${Number(ui.motionRate.value).toFixed(3)} Hz`; updateMotionFormula(); });
  ui.motionPhase.addEventListener('input', () => { ui.motionPhaseOut.value = `${Math.round(Number(ui.motionPhase.value))}°`; updateMotionFormula(); });
  ui.lineAngle.addEventListener('input', () => { ui.lineAngleOut.value = `${Math.round(Number(ui.lineAngle.value))}°`; updateMotionFormula(); });
  ui.sineCycles.addEventListener('input', () => { ui.sineCyclesOut.value = Number(ui.sineCycles.value).toFixed(1); updateMotionFormula(); });
  [ui.motionCenterX, ui.motionCenterY, ui.motionAmpX, ui.motionAmpY, ui.lissajousA, ui.lissajousB].forEach(el => {
    el.addEventListener('input', () => {
      if (el === ui.motionCenterX || el === ui.motionCenterY) clampMotionCenter();
      updateMotionFormula();
      if (ui.motionType.value !== 'manual' && !running) {
        const [px, py] = motionPositionAt(sourceMotionTime);
        setEmitterPosition(px, py);
      }
    });
  });

  function pointerToWorld(e) {
    const rect = stage.getBoundingClientRect();
    const size = Math.min(rect.width, rect.height);
    const left = (rect.width - size) * 0.5;
    const top = (rect.height - size) * 0.5;
    const px = ((e.clientX - rect.left - left) / size) * 2 - 1;
    const py = 1 - ((e.clientY - rect.top - top) / size) * 2;
    return constrainEmitter(px, py);
  }
  let draggingEmitter = false;
  stage.addEventListener('pointerdown', (e) => {
    if (ui.motionType.value !== 'manual') setMotionType('manual', false);
    draggingEmitter = true;
    stage.setPointerCapture(e.pointerId);
    const [px, py] = pointerToWorld(e);
    setEmitterPosition(px, py);
  });
  stage.addEventListener('pointermove', (e) => {
    if (!draggingEmitter) return;
    const [px, py] = pointerToWorld(e);
    setEmitterPosition(px, py);
  });
  stage.addEventListener('pointerup', (e) => {
    draggingEmitter = false;
    try { stage.releasePointerCapture(e.pointerId); } catch (_) {}
  });
  stage.addEventListener('pointercancel', () => { draggingEmitter = false; });

  // -------------------- Portable config / snapshot --------------------
  const PATTERN_FORMAT = 'resonant-sand-physics';
  const PATTERN_VERSION = 2;

  function currentAudioMeta() {
    const file = ui.audioFile.files && ui.audioFile.files[0];
    if (!file) return null;
    return { name: file.name, size: file.size, type: file.type || '', lastModified: file.lastModified || 0 };
  }

  function collectConfig() {
    return {
      source: {
        mode: sourceMode,
        toneFrequencyHz: clampFrequency(parseFloat(ui.toneFreq.value)),
        monitorVolume: parseFloat(ui.volume.value),
        audioFile: sourceMode === 'file' ? currentAudioMeta() : null,
        audioPositionSeconds: sourceMode === 'file' && Number.isFinite(audioEl.currentTime) ? audioEl.currentTime : 0
      },
      plate: {
        boundary: ui.boundary.value,
        fundamentalHz: parseFloat(ui.fundamental.value),
        resonanceQ: parseFloat(ui.quality.value),
        vibrationForce: parseFloat(ui.strength.value),
        audioSensitivity: parseFloat(ui.sensitivity.value),
        emitter: { x: emitterX, y: emitterY },
        emitterMotion: {
          type: ui.motionType.value,
          centerX: readMotionNumber(ui.motionCenterX, 0),
          centerY: readMotionNumber(ui.motionCenterY, 0),
          sizeX: readMotionNumber(ui.motionAmpX, 0.5),
          sizeY: readMotionNumber(ui.motionAmpY, 0.5),
          rateHz: readMotionNumber(ui.motionRate, 0.1),
          phaseDeg: readMotionNumber(ui.motionPhase, 0),
          lineAngleDeg: readMotionNumber(ui.lineAngle, 0),
          sineCycles: readMotionNumber(ui.sineCycles, 2),
          lissajousA: Math.round(readMotionNumber(ui.lissajousA, 3)),
          lissajousB: Math.round(readMotionNumber(ui.lissajousB, 2))
        }
      },
      granular: {
        particleCount: N,
        mobility: parseFloat(ui.mobility.value),
        surfaceFriction: parseFloat(ui.friction.value),
        collisionStrength: parseFloat(ui.collisions.value),
        wallRestitution: parseFloat(ui.restitution.value)
      },
      appearance: {
        background: ui.bgColor.value,
        sand: ui.sandColor.value,
        grainSizePx: parseFloat(ui.grainSize.value),
        showModalGuide: ui.showGuide.checked,
        showEmitter: ui.showEmitter.checked
      }
    };
  }

  function bytesToBase64(bytes) {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(bytes.length, i + chunk)));
    }
    return btoa(binary);
  }

  function base64ToFloat32(text, expectedLength, name) {
    const binary = atob(text);
    if (binary.length % 4 !== 0) throw new Error(`${name} has invalid byte length.`);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const values = new Float32Array(bytes.buffer);
    if (values.length !== expectedLength) throw new Error(`${name} length mismatch.`);
    return values;
  }

  function encodeFloat32(values) {
    return bytesToBase64(new Uint8Array(values.buffer, values.byteOffset, values.byteLength));
  }

  function downloadJson(data, filename) {
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  }

  function exportPattern(kind) {
    const config = collectConfig();
    const payload = {
      format: PATTERN_FORMAT,
      version: PATTERN_VERSION,
      kind,
      exportedAt: new Date().toISOString(),
      config
    };
    if (kind === 'snapshot') {
      payload.state = {
        encoding: 'float32-base64-native-endian',
        particleCount: N,
        simulationTimeSeconds: simTime,
        sourceMotionTimeSeconds: sourceMotionTime,
        x: encodeFloat32(x),
        y: encodeFloat32(y),
        vx: encodeFloat32(vx),
        vy: encodeFloat32(vy),
        phase: encodeFloat32(phase)
      };
    }
    const f = Math.round(config.source.toneFrequencyHz || dominantFrequency || 0);
    const suffix = kind === 'snapshot' ? 'snapshot' : 'config';
    downloadJson(payload, `resonant-sand-${config.plate.boundary}-${f}Hz-${suffix}.cymatics.json`);
    ui.shareStatus.textContent = kind === 'snapshot'
      ? `Snapshot exported: ${N.toLocaleString()} grain coordinates + all settings.`
      : 'Configuration exported: plate, sound, emitter, granular physics, and appearance settings.';
  }

  function finiteOr(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function clampNumber(value, min, max, fallback) {
    return Math.max(min, Math.min(max, finiteOr(value, fallback)));
  }

  function refreshImportedOutputs() {
    ui.volumeOut.value = `${Math.round(parseFloat(ui.volume.value) * 100)}%`;
    ui.fundamentalOut.value = `${Math.round(Number(ui.fundamental.value))} Hz`;
    ui.qualityOut.value = `${Math.round(Number(ui.quality.value))}`;
    ui.strengthOut.value = Number(ui.strength.value).toFixed(1);
    ui.sensitivityOut.value = `${Number(ui.sensitivity.value).toFixed(1)}×`;
    ui.particleCountOut.value = parseInt(ui.particleCount.value, 10).toLocaleString();
    ui.mobilityOut.value = `${Number(ui.mobility.value).toFixed(2)}×`;
    ui.frictionOut.value = Number(ui.friction.value).toFixed(1);
    ui.collisionsOut.value = `${Number(ui.collisions.value).toFixed(2)}×`;
    ui.restitutionOut.value = Number(ui.restitution.value).toFixed(2);
    ui.grainSizeOut.value = `${Number(ui.grainSize.value).toFixed(2)} px`;
    ui.motionRateOut.value = `${Number(ui.motionRate.value).toFixed(3)} Hz`;
    ui.motionPhaseOut.value = `${Math.round(Number(ui.motionPhase.value))}°`;
    ui.lineAngleOut.value = `${Math.round(Number(ui.lineAngle.value))}°`;
    ui.sineCyclesOut.value = Number(ui.sineCycles.value).toFixed(1);
    syncMotionUi();
  }

  function applyImportedConfig(config) {
    if (!config || typeof config !== 'object') throw new Error('Missing config object.');
    running = false;
    stopSound();
    audioDrive = 0;

    const source = config.source || {};
    const plate = config.plate || {};
    const granular = config.granular || {};
    const appearance = config.appearance || {};

    ui.volume.value = String(clampNumber(source.monitorVolume, 0, 0.3, 0.08));
    ui.boundary.value = plate.boundary === 'square' ? 'square' : 'circle';
    ui.fundamental.value = String(clampNumber(plate.fundamentalHz, 20, 800, 90));
    ui.quality.value = String(clampNumber(plate.resonanceQ, 3, 80, 24));
    ui.strength.value = String(clampNumber(plate.vibrationForce, 0, 12, 5.5));
    ui.sensitivity.value = String(clampNumber(plate.audioSensitivity, 0.2, 4, 1.8));

    ui.particleCount.value = String(Math.round(clampNumber(granular.particleCount, 5000, 50000, 25000) / 1000) * 1000);
    ui.mobility.value = String(clampNumber(granular.mobility, 0.2, 3, 1));
    ui.friction.value = String(clampNumber(granular.surfaceFriction, 0.5, 9, 3));
    ui.collisions.value = String(clampNumber(granular.collisionStrength, 0, 2.5, 1));
    ui.restitution.value = String(clampNumber(granular.wallRestitution, 0, 0.8, 0.18));

    if (typeof appearance.background === 'string' && /^#[0-9a-fA-F]{6}$/.test(appearance.background)) ui.bgColor.value = appearance.background;
    if (typeof appearance.sand === 'string' && /^#[0-9a-fA-F]{6}$/.test(appearance.sand)) ui.sandColor.value = appearance.sand;
    ui.grainSize.value = String(clampNumber(appearance.grainSizePx, 0.5, 3.5, 1.35));
    ui.showGuide.checked = Boolean(appearance.showModalGuide);
    ui.showEmitter.checked = appearance.showEmitter !== false;

    rebuildModeLibrary();
    const e = plate.emitter || {};
    setEmitterPosition(finiteOr(e.x, 0), finiteOr(e.y, 0));
    const motion = plate.emitterMotion || {};
    ui.motionCenterX.value = String(clampNumber(motion.centerX, -0.985, 0.985, finiteOr(e.x, 0)));
    ui.motionCenterY.value = String(clampNumber(motion.centerY, -0.985, 0.985, finiteOr(e.y, 0)));
    ui.motionAmpX.value = String(clampNumber(motion.sizeX, 0, 1.95, 0.5));
    ui.motionAmpY.value = String(clampNumber(motion.sizeY, 0, 1.95, 0.5));
    ui.motionRate.value = String(clampNumber(motion.rateHz, 0.005, 2, 0.1));
    ui.motionPhase.value = String(clampNumber(motion.phaseDeg, 0, 360, 0));
    ui.lineAngle.value = String(clampNumber(motion.lineAngleDeg, 0, 360, 0));
    ui.sineCycles.value = String(clampNumber(motion.sineCycles, 0.5, 8, 2));
    ui.lissajousA.value = String(Math.round(clampNumber(motion.lissajousA, 1, 12, 3)));
    ui.lissajousB.value = String(Math.round(clampNumber(motion.lissajousB, 1, 12, 2)));
    sourceMotionTime = 0;
    setMotionType(typeof motion.type === 'string' ? motion.type : 'manual', false);
    setToneFrequency(clampFrequency(finiteOr(source.toneFrequencyHz, 345)), true);
    setMode(source.mode === 'file' ? 'file' : 'tone');

    if (monitorGain && audioCtx) monitorGain.gain.setTargetAtTime(parseFloat(ui.volume.value), audioCtx.currentTime, 0.01);
    refreshImportedOutputs();

    pendingImportedAudio = null;
    if (source.mode === 'file') {
      const expected = source.audioFile && typeof source.audioFile === 'object' ? source.audioFile : null;
      const time = Math.max(0, finiteOr(source.audioPositionSeconds, 0));
      pendingImportedAudio = { meta: expected, time };
      const current = ui.audioFile.files && ui.audioFile.files[0];
      const currentMatches = current && expected && current.name === expected.name && (!expected.size || current.size === expected.size);
      if (!currentMatches) {
        if (currentObjectUrl) { URL.revokeObjectURL(currentObjectUrl); currentObjectUrl = null; }
        audioEl.pause();
        audioEl.removeAttribute('src');
        ui.audioFile.value = '';
        ui.fileName.textContent = expected ? `Select matching file: ${expected.name}` : 'Choose MP3 / WAV / OGG';
        ui.fileMeta.textContent = expected
          ? `Imported setup expects ${(expected.size / 1024 / 1024).toFixed(2)} MB · audio file is not embedded in the config.`
          : 'Imported file-mode setup. Select the original audio file.';
      } else {
        if (Number.isFinite(time) && time > 0 && audioEl.readyState >= 1 && Number.isFinite(audioEl.duration)) {
          audioEl.currentTime = Math.min(time, Math.max(0, audioEl.duration - 0.01));
        }
        pendingImportedAudio = null;
      }
    }
    fieldDirty = true;
  }

  function restoreSnapshot(state) {
    if (!state || typeof state !== 'object') throw new Error('Snapshot state is missing.');
    const count = Math.round(finiteOr(state.particleCount, 0));
    if (count < 5000 || count > 50000) throw new Error('Snapshot particle count is outside the supported range.');
    ui.particleCount.value = String(count);
    resetParticles();
    const sx = base64ToFloat32(state.x, count, 'x');
    const sy = base64ToFloat32(state.y, count, 'y');
    const svx = base64ToFloat32(state.vx, count, 'vx');
    const svy = base64ToFloat32(state.vy, count, 'vy');
    const sph = base64ToFloat32(state.phase, count, 'phase');
    x.set(sx); y.set(sy); vx.set(svx); vy.set(svy); phase.set(sph);
    simTime = Math.max(0, finiteOr(state.simulationTimeSeconds, 0));
    sourceMotionTime = Math.max(0, finiteOr(state.sourceMotionTimeSeconds, 0));
    if (ui.motionType.value !== 'manual') {
      const [mx, my] = motionPositionAt(sourceMotionTime);
      setEmitterPosition(mx, my);
    }
    for (let i = 0; i < N; i++) {
      positions[i * 2] = x[i];
      positions[i * 2 + 1] = y[i];
    }
    meanSpeed = 0;
    refreshImportedOutputs();
    fieldDirty = true;
  }

  async function importPatternFile(file) {
    const text = await file.text();
    let payload;
    try { payload = JSON.parse(text); }
    catch (_) { throw new Error('The selected file is not valid JSON.'); }
    if (!payload || payload.format !== PATTERN_FORMAT) throw new Error('This is not a Resonant Sand Physics pattern file.');
    if (![1, PATTERN_VERSION].includes(payload.version)) throw new Error(`Unsupported pattern version ${payload.version}.`);
    if (payload.kind !== 'config' && payload.kind !== 'snapshot') throw new Error('Unknown pattern file kind.');

    applyImportedConfig(payload.config);
    if (payload.kind === 'snapshot') restoreSnapshot(payload.state);
    else resetParticles();

    ui.shareStatus.textContent = payload.kind === 'snapshot'
      ? `Imported exact snapshot with ${N.toLocaleString()} grains.`
      : 'Imported experimental configuration. Sand was reset under those conditions.';
    ui.message.textContent = payload.kind === 'snapshot'
      ? 'Exact sand snapshot imported. Press Start to continue from this state.'
      : 'Configuration imported. Press Start to reproduce the experiment.';
  }

  ui.exportConfigBtn.addEventListener('click', () => exportPattern('config'));
  ui.exportSnapshotBtn.addEventListener('click', () => exportPattern('snapshot'));
  ui.importPatternFile.addEventListener('change', async () => {
    const file = ui.importPatternFile.files && ui.importPatternFile.files[0];
    if (!file) return;
    try {
      await importPatternFile(file);
    } catch (err) {
      console.error(err);
      ui.shareStatus.textContent = `Import failed: ${err.message}`;
      ui.message.textContent = `Import failed: ${err.message}`;
    } finally {
      ui.importPatternFile.value = '';
    }
  });

  // -------------------- Configuration help --------------------
  const HELP_SECTIONS = {
    sound: {
      title: 'Sound source',
      intro: 'These settings define the signal that excites the plate. Pure tone is best for repeatable resonance tests; audio-file mode lets several FFT peaks excite modes at once.',
      items: [
        ['Pure tone / Audio file', 'Pure tone uses one exact simulation frequency. Audio file analyzes the uploaded signal and uses up to five strong spectral peaks at the same time.'],
        ['Simulation frequency', 'The excitation frequency used by the physics model, from 0.1 Hz to 100 kHz. Frequencies outside the safe audible range are simulated without being sent to the speakers.'],
        ['Monitor volume', 'Only controls what you hear from the browser. It does not change the simulated vibration force.'],
        ['Start / Stop', 'Start advances sound, particle physics, and automated source motion. Stop freezes the current grain arrangement and source path time.']
      ]
    },
    plate: {
      title: 'Plate physics & source motion',
      intro: 'The plate response is a modal resonance approximation. The source position changes modal coupling: a mode is weakly excited when the actuator sits close to one of that mode’s nodes.',
      items: [
        ['Plate / wall', 'Circular uses radial/angular Bessel-like modes and a circular collision wall. Square uses sine plate modes and straight walls.'],
        ['Fundamental resonance', 'Scales the entire modal frequency library. Raising it moves all resonances upward in frequency.'],
        ['Resonance Q', 'Controls how narrow and strong resonances are. Higher Q produces sharper frequency selectivity and stronger response near exact resonance.'],
        ['Vibration force', 'Scales the plate-derived force that transports grains away from highly vibrating regions and toward lower-energy nodal regions.'],
        ['Audio sensitivity', 'Scales how strongly the analyzed signal drives the plate. It affects simulation drive, unlike Monitor volume.'],
        ['Sound source X / Y', 'Exact normalized actuator coordinates. (0,0) is the center. Dragging or typing coordinates switches automated motion back to Manual.'],
        ['Center source', 'In Manual mode it sets the source to (0,0). With automated motion it centers the whole motion path and restarts it.'],
        ['Motion equation', 'Moves the source deterministically while the simulation runs. Circle/ellipse, line, sine sweep, figure-eight and Lissajous paths are available.'],
        ['Path center', 'The center around which the parametric motion is evaluated. “Use current as path center” copies the current emitter position here.'],
        ['Size X / Size Y', 'Normalized path extents. For circles they are ellipse radii; for figure-eight/Lissajous they independently control horizontal and vertical amplitude.'],
        ['Path rate', 'Cycles per second of the source path. 0.10 Hz means one full motion cycle every 10 seconds.'],
        ['Phase', 'Starting phase of the equation. Useful for making repeatable recordings that begin at a chosen point on the path.'],
        ['Line angle', 'Direction of line oscillation in degrees. 0° is horizontal; 90° is vertical.'],
        ['Sine cycles', 'Number of sine oscillations across one left-to-right sweep.'],
        ['Lissajous multipliers', 'Integer X/Y frequency ratios that set the Lissajous geometry, e.g. 3:2 or 5:4.'],
        ['Restart path', 'Sets path time back to zero without resetting the sand. This is useful just before starting a video recording.']
      ]
    },
    granular: {
      title: 'Granular physics',
      intro: 'These settings control the visible grain dynamics after the plate field has been computed.',
      items: [
        ['Sand grains', 'Number of simulated particles. More grains produce denser nodal lines but increase collision cost.'],
        ['Mobility', 'Scales how quickly vibration-generated forces translate into lateral grain motion.'],
        ['Surface friction', 'Damps horizontal velocity. High friction makes grains settle quickly; low friction lets them travel farther before stopping.'],
        ['Grain collisions', 'Strength of local grain-grain contact forces computed through the spatial collision grid. Set to 0 to disable inter-particle collisions.'],
        ['Wall restitution', 'How much normal velocity survives a wall impact. 0 is nearly inelastic; higher values bounce more.']
      ]
    },
    appearance: {
      title: 'Appearance',
      intro: 'Appearance does not alter the plate or granular physics.',
      items: [
        ['Background', 'Color behind the simulated plate.'],
        ['Sand', 'Rendered grain color.'],
        ['Grain size', 'Point size used by WebGL. It changes visibility only, not physical grain diameter in the collision model.'],
        ['Modal-energy guide', 'Debug overlay showing the current vibration-energy field. Keep this off when you want to judge only the sand pattern.'],
        ['Show emitter', 'Displays the actuator marker on the plate. This is visual only.']
      ]
    },
    share: {
      title: 'Share / reproduce',
      intro: 'Portable files make experiments reproducible between browsers or people.',
      items: [
        ['Export config', 'Saves sound settings, plate physics, exact source coordinates, automated motion equation and path parameters, granular settings, and appearance. Sand is regenerated on import.'],
        ['Export snapshot', 'Also stores every grain position/velocity plus simulation time and source-path time, so the exact visible state can be continued.'],
        ['Import', 'Loads a config or snapshot. Audio binaries are not embedded; audio-file experiments require the same source file separately.']
      ]
    },
    capture: {
      title: 'Capture',
      intro: 'Use Restart path before recording when you need deterministic, repeatable camera-ready motion.',
      items: [
        ['PNG image', 'Captures the WebGL sand rendering at the current instant.'],
        ['Record video', 'Records the WebGL canvas in real time. MP4 is used when the browser supports it; otherwise the recorder falls back to WebM. Automated source motion continues during recording.']
      ]
    }
  };

  function openHelp(sectionKey) {
    const section = HELP_SECTIONS[sectionKey];
    if (!section) return;
    ui.helpTitle.textContent = section.title;
    ui.helpBody.replaceChildren();
    const intro = document.createElement('p');
    intro.className = 'help-intro';
    intro.textContent = section.intro;
    ui.helpBody.appendChild(intro);
    const dl = document.createElement('dl');
    dl.className = 'help-list';
    for (const [term, desc] of section.items) {
      const dt = document.createElement('dt'); dt.textContent = term;
      const dd = document.createElement('dd'); dd.textContent = desc;
      dl.append(dt, dd);
    }
    ui.helpBody.appendChild(dl);
    ui.helpModal.hidden = false;
    ui.closeHelpBtn.focus();
  }

  function closeHelp() { ui.helpModal.hidden = true; }
  document.querySelectorAll('[data-help-section]').forEach(btn => btn.addEventListener('click', () => openHelp(btn.dataset.helpSection)));
  ui.closeHelpBtn.addEventListener('click', closeHelp);
  ui.helpModal.addEventListener('click', e => { if (e.target.matches('[data-close-help]')) closeHelp(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !ui.helpModal.hidden) closeHelp(); });

  const CONTROL_TOOLTIPS = {
    toneFreq: 'Exact simulated excitation frequency. The logarithmic slider above controls the same value.',
    volume: 'Listening volume only; does not change simulated vibration force.',
    boundary: 'Physical plate geometry and wall shape.', fundamental: 'Base frequency scale for the mode library.', quality: 'Resonance sharpness (Q factor).',
    strength: 'Overall vibration-driven transport force.', sensitivity: 'How strongly sound energy drives the simulation.',
    emitterXInput: 'Exact normalized X coordinate of the actuator.', emitterYInput: 'Exact normalized Y coordinate of the actuator.',
    motionType: 'Choose the parametric equation used to move the source while running.', motionRate: 'Motion cycles per second.', motionPhase: 'Starting phase of the source-motion equation.',
    particleCount: 'Number of independently simulated grains.', mobility: 'Lateral grain response to vibration.', friction: 'Surface damping of grain velocity.',
    collisions: 'Strength of grain-grain contact forces.', restitution: 'Bounce retained after wall impacts.', grainSize: 'Visual point size only.'
  };
  for (const [id, tip] of Object.entries(CONTROL_TOOLTIPS)) { const el = $(id); if (el) el.title = tip; }

  // -------------------- Drawing / capture --------------------
  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    if (guideCanvas.width !== w || guideCanvas.height !== h) { guideCanvas.width = w; guideCanvas.height = h; }
    gl.viewport(0, 0, w, h);
  }

  function render() {
    resize();
    const [br, bg, bb] = hexRgb(ui.bgColor.value);
    gl.clearColor(br, bg, bb, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    for (let i = 0; i < N; i++) { positions[i * 2] = x[i]; positions[i * 2 + 1] = y[i]; }
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, positions);
    gl.useProgram(program);
    const w = canvas.width, h = canvas.height;
    const sx = Math.min(1, h / w), sy = Math.min(1, w / h);
    gl.uniform2f(uScale, sx, sy);
    gl.uniform1f(uPointSize, parseFloat(ui.grainSize.value) * Math.min(2, window.devicePixelRatio || 1));
    gl.uniform3fv(uColor, hexRgb(ui.sandColor.value));
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.POINTS, 0, N);
    gl.bindVertexArray(null);
    drawOverlay();
  }

  function worldToCanvas(px, py) {
    const w = guideCanvas.width, h = guideCanvas.height, size = Math.min(w, h);
    return [(w - size) * 0.5 + (px + 1) * 0.5 * size, (h - size) * 0.5 + (1 - py) * 0.5 * size];
  }

  function drawOverlay() {
    const ctx = guideCtx, w = guideCanvas.width, h = guideCanvas.height;
    ctx.clearRect(0, 0, w, h);
    const size = Math.min(w, h), left = (w - size) / 2, top = (h - size) / 2;

    if (ui.showGuide.checked) {
      const iw = 112, ih = 112;
      const img = ctx.createImageData(iw, ih);
      for (let yy = 0; yy < ih; yy++) for (let xx = 0; xx < iw; xx++) {
        const kf = yy * iw + xx;
        const srcY = ih - 1 - yy;
        const e = fieldEnergy[srcY * FIELD + xx];
        const a = Math.round(Math.pow(e, 0.65) * 105);
        const k = kf * 4;
        img.data[k] = 80; img.data[k + 1] = 175; img.data[k + 2] = 255; img.data[k + 3] = a;
      }
      const tmp = document.createElement('canvas');
      tmp.width = iw; tmp.height = ih;
      tmp.getContext('2d').putImageData(img, 0, 0);
      ctx.drawImage(tmp, left, top, size, size);
    }

    ctx.save();
    ctx.lineWidth = Math.max(1, Math.round((window.devicePixelRatio || 1)));
    ctx.strokeStyle = 'rgba(185,205,220,.36)';
    if (ui.boundary.value === 'circle') {
      ctx.beginPath(); ctx.arc(w / 2, h / 2, size * 0.491, 0, Math.PI * 2); ctx.stroke();
    } else {
      ctx.strokeRect(left + size * 0.009, top + size * 0.009, size * 0.982, size * 0.982);
    }
    if (ui.showEmitter.checked) {
      const p = worldToCanvas(emitterX, emitterY);
      ctx.strokeStyle = 'rgba(255,220,145,.92)';
      ctx.fillStyle = 'rgba(255,220,145,.18)';
      ctx.lineWidth = Math.max(1.5, 1.5 * (window.devicePixelRatio || 1));
      ctx.beginPath(); ctx.arc(p[0], p[1], 8 * (window.devicePixelRatio || 1), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(p[0] - 12, p[1]); ctx.lineTo(p[0] + 12, p[1]); ctx.moveTo(p[0], p[1] - 12); ctx.lineTo(p[0], p[1] + 12); ctx.stroke();
    }
    ctx.restore();
  }

  ui.shotBtn.addEventListener('click', () => {
    render();
    canvas.toBlob(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `resonant-sand-${Date.now()}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }, 'image/png');
  });

  let recorder = null, chunks = [];
  ui.recordBtn.addEventListener('click', async () => {
    if (recorder && recorder.state === 'recording') { recorder.stop(); return; }
    await ensureAudio();
    const videoStream = canvas.captureStream(60);
    const tracks = [...videoStream.getVideoTracks()];
    if (recordDest && recordDest.stream.getAudioTracks().length) tracks.push(...recordDest.stream.getAudioTracks());
    const stream = new MediaStream(tracks);
    const candidates = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    const mime = candidates.find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
    try {
      chunks = [];
      recorder = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 10_000_000 } : { videoBitsPerSecond: 10_000_000 });
      recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      recorder.onstop = () => {
        const type = recorder.mimeType || mime || 'video/webm';
        const ext = type.includes('mp4') ? 'mp4' : 'webm';
        const blob = new Blob(chunks, { type });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `resonant-sand-${Date.now()}.${ext}`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        ui.recordBtn.textContent = 'Record video';
      };
      recorder.start(1000);
      ui.recordBtn.textContent = 'Stop recording';
    } catch (err) {
      console.error(err);
      ui.message.textContent = `Recording failed: ${err.message}`;
    }
  });

  let last = performance.now(), fpsSmooth = 60, hudTimer = 0, collisionHudTimer = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    fpsSmooth += ((1 / Math.max(dt, 0.001)) - fpsSmooth) * 0.08;

    if (running) analyseAudio(); else audioDrive *= 0.93;
    updateAutomatedEmitter(dt);
    fieldUpdateTimer += dt;
    if ((fieldDirty && fieldUpdateTimer > 0.045) || fieldUpdateTimer > 0.15) {
      updatePlateField();
      fieldUpdateTimer = 0;
    }

    physicsAccumulator += dt;
    let steps = 0;
    while (physicsAccumulator >= PHYSICS_DT && steps < 3) {
      physicsStep(PHYSICS_DT);
      physicsAccumulator -= PHYSICS_DT;
      steps++;
    }
    if (steps === 3 && physicsAccumulator > PHYSICS_DT * 3) physicsAccumulator = 0;

    render();
    hudTimer += dt;
    collisionHudTimer += dt;
    if (collisionHudTimer >= 1) {
      collisionsPerSecond = Math.round(collisionCounter / collisionHudTimer);
      collisionCounter = 0;
      collisionHudTimer = 0;
    }
    if (hudTimer > 0.12) {
      hudTimer = 0;
      ui.fpsBadge.textContent = `${Math.round(fpsSmooth)} FPS`;
      ui.driveHud.textContent = audioDrive.toFixed(2);
      ui.freqHud.textContent = formatHz(dominantFrequency);
      ui.modeHud.textContent = dominantModeLabel;
      ui.speedHud.textContent = meanSpeed.toFixed(4);
      ui.activeHud.textContent = String(activeModes.length);
      ui.collisionHud.textContent = collisionsPerSecond.toLocaleString();
    }
    requestAnimationFrame(frame);
  }

  rebuildModeLibrary();
  setEmitterPosition(0, 0);
  syncMotionUi();
  resetParticles();
  setToneFrequency(345, true);
  updatePlateField();
  requestAnimationFrame(frame);
})();
