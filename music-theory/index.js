const { NOTE_NAMES, analyzeInterval, getCanonicalIntervalName } = window.IntervalEngine;
const {
  getAllScales,
  getScaleById,
  parseCustomScaleInput,
  getScaleNoteIndices,
  getScaleConnections,
} = window.ScaleEngine;
const {
  HARMONY_RELATIONSHIPS,
  createDefaultHarmonyToggles,
  getActiveHarmonyConnections,
  getProgressionSuggestions,
  isRelationshipAvailableForMode,
  getEmotionProfiles,
  getEmotionChordSuggestions,
} = window.HarmonyEngine;
const { buildChord, getChordConnections, getChordTypeOptions } = window.ChordEngine;
const { createCircleRenderer } = window.CircleRenderer;

const elements = {
  svg: document.getElementById("circleSvg"),
  tooltip: document.getElementById("noteTooltip"),
  scalePreset: document.getElementById("scalePreset"),
  scaleMeta: document.getElementById("scaleMeta"),
  scaleCustomWrap: document.getElementById("scaleCustomWrap"),
  scaleCustomIntervals: document.getElementById("scaleCustomIntervals"),
  showScaleLines: document.getElementById("showScaleLines"),
  showHarmonyLines: document.getElementById("showHarmonyLines"),
  showIntervalLine: document.getElementById("showIntervalLine"),
  showChordLines: document.getElementById("showChordLines"),
  harmonyToggleList: document.getElementById("harmonyToggleList"),
  intervalFrom: document.getElementById("intervalFrom"),
  intervalTo: document.getElementById("intervalTo"),
  intervalResult: document.getElementById("intervalResult"),
  chordType: document.getElementById("chordType"),
  lockChordToTonic: document.getElementById("lockChordToTonic"),
  chordRoot: document.getElementById("chordRoot"),
  emotionTarget: document.getElementById("emotionTarget"),
  emotionChordList: document.getElementById("emotionChordList"),
  progressionList: document.getElementById("progressionList"),
  exportProgressions: document.getElementById("exportProgressions"),
  tonicLabel: document.getElementById("tonicLabel"),
  scaleLabel: document.getElementById("scaleLabel"),
  chordLabel: document.getElementById("chordLabel"),
  audioEnabled: document.getElementById("audioEnabled"),
  audioPlaybackMode: document.getElementById("audioPlaybackMode"),
};

const state = {
  tonicIndex: 0,
  scaleId: "major-ionian",
  scaleCustomIntervals: [0, 2, 4, 5, 7, 9, 11],
  scaleCustomInputError: false,
  tonalMode: "major",
  harmonyToggles: createDefaultHarmonyToggles(),
  intervalFromIndex: 0,
  intervalToIndex: 7,
  chordType: "",
  lockChordToTonic: true,
  chordRootIndex: 0,
  showScaleLines: true,
  showHarmonyLines: true,
  showIntervalLine: true,
  showChordLines: true,
  emotionTarget: "balanced",
  audioEnabled: true,
  audioPlaybackMode: "single",
  audioContext: null,
  activeVoices: [],
  progressionCache: [],
};

function createNoteOption(index) {
  const option = document.createElement("option");
  option.value = String(index);
  option.textContent = NOTE_NAMES[index];
  return option;
}

function populateNoteSelect(selectElement) {
  NOTE_NAMES.forEach((_, index) => {
    selectElement.appendChild(createNoteOption(index));
  });
}

function groupByFamily(items) {
  return items.reduce((accumulator, item) => {
    if (!accumulator.has(item.family)) {
      accumulator.set(item.family, []);
    }
    accumulator.get(item.family).push(item);
    return accumulator;
  }, new Map());
}

function setupScalePresetSelect() {
  const scales = getAllScales();
  const groupedScales = groupByFamily(scales);
  const fragment = document.createDocumentFragment();

  groupedScales.forEach((familyScales, familyName) => {
    const group = document.createElement("optgroup");
    group.label = familyName;
    familyScales.forEach((scale) => {
      const option = document.createElement("option");
      option.value = scale.id;
      option.textContent = scale.name;
      group.appendChild(option);
    });
    fragment.appendChild(group);
  });

  elements.scalePreset.innerHTML = "";
  elements.scalePreset.appendChild(fragment);
  elements.scalePreset.value = state.scaleId;
}

function setupChordTypeSelect() {
  const chordOptions = getChordTypeOptions();
  const fragment = document.createDocumentFragment();

  chordOptions.forEach((chordOption) => {
    const option = document.createElement("option");
    option.value = chordOption.id;
    option.textContent = chordOption.label;
    fragment.appendChild(option);
  });

  elements.chordType.innerHTML = "";
  elements.chordType.appendChild(fragment);

  const defaultChord = chordOptions.find((option) => option.token === "") ?? chordOptions[0];
  state.chordType = defaultChord.id;
  elements.chordType.value = state.chordType;
}

function setupEmotionSelect() {
  const emotionProfiles = getEmotionProfiles();
  elements.emotionTarget.innerHTML = "";

  emotionProfiles.forEach((profile) => {
    const option = document.createElement("option");
    option.value = profile.id;
    option.textContent = profile.label;
    elements.emotionTarget.appendChild(option);
  });

  if (![...elements.emotionTarget.options].some((option) => option.value === state.emotionTarget)) {
    state.emotionTarget = emotionProfiles[0]?.id ?? "balanced";
  }
  elements.emotionTarget.value = state.emotionTarget;
}

function setupSelects() {
  populateNoteSelect(elements.intervalFrom);
  populateNoteSelect(elements.intervalTo);
  populateNoteSelect(elements.chordRoot);

  elements.intervalFrom.value = String(state.intervalFromIndex);
  elements.intervalTo.value = String(state.intervalToIndex);
  elements.chordRoot.value = String(state.chordRootIndex);
  elements.scaleCustomIntervals.value = state.scaleCustomIntervals.join(",");

  setupScalePresetSelect();
  setupChordTypeSelect();
  setupEmotionSelect();
}

function setupHarmonyToggles() {
  const fragment = document.createDocumentFragment();

  HARMONY_RELATIONSHIPS.forEach((relationship) => {
    const row = document.createElement("div");
    row.className = "toggle-item";
    row.dataset.relationshipId = relationship.id;

    const label = document.createElement("label");
    label.className = "toggle-label";

    const dot = document.createElement("span");
    dot.className = "color-dot";
    dot.style.color = relationship.color;
    dot.style.background = relationship.color;

    const text = document.createElement("span");
    text.textContent = `${relationship.label} (${relationship.semitones}H)`;

    label.append(dot, text);

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = Boolean(state.harmonyToggles[relationship.id]);
    checkbox.dataset.relationshipId = relationship.id;
    checkbox.addEventListener("change", () => {
      state.harmonyToggles[relationship.id] = checkbox.checked;
      renderApp();
    });

    row.append(label, checkbox);
    fragment.appendChild(row);
  });

  elements.harmonyToggleList.innerHTML = "";
  elements.harmonyToggleList.appendChild(fragment);
}

function refreshHarmonyToggleAvailability() {
  const rows = elements.harmonyToggleList.querySelectorAll(".toggle-item");

  rows.forEach((row) => {
    const relationshipId = row.dataset.relationshipId;
    const relationship = HARMONY_RELATIONSHIPS.find((entry) => entry.id === relationshipId);
    const checkbox = row.querySelector("input[type='checkbox']");
    const available = isRelationshipAvailableForMode(relationship, state.tonalMode);
    const enabled = available && state.showHarmonyLines;

    checkbox.disabled = !enabled;
    row.classList.toggle("is-disabled", !enabled);
  });

  elements.harmonyToggleList.classList.toggle("is-disabled", !state.showHarmonyLines);
}

function getAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return null;
  }

  if (!state.audioContext) {
    state.audioContext = new AudioContextClass();
  }

  if (state.audioContext.state === "suspended") {
    state.audioContext.resume();
  }

  return state.audioContext;
}

function stopActiveVoices() {
  if (!state.audioContext) {
    state.activeVoices = [];
    return;
  }

  state.activeVoices.forEach(({ oscillator, gainNode }) => {
    try {
      gainNode.gain.cancelScheduledValues(0);
      gainNode.gain.setValueAtTime(0.0001, state.audioContext.currentTime);
      oscillator.stop();
    } catch (_error) {
      // Voice may already be stopped.
    }
  });
  state.activeVoices = [];
}

function scheduleNote(context, semitoneOffsetFromC4, startTime, duration, peakGain) {
  const frequency = 261.6256 * Math.pow(2, semitoneOffsetFromC4 / 12);
  const clampedDuration = Math.max(0.12, duration);
  const safePeakGain = Math.max(0.03, peakGain);

  const oscillator = context.createOscillator();
  const gainNode = context.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, startTime);

  gainNode.gain.setValueAtTime(0.0001, startTime);
  gainNode.gain.exponentialRampToValueAtTime(safePeakGain, startTime + 0.03);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + clampedDuration);

  oscillator.connect(gainNode).connect(context.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + clampedDuration + 0.03);

  state.activeVoices.push({ oscillator, gainNode });
}

function getCurrentChordRoot() {
  return state.lockChordToTonic ? state.tonicIndex : state.chordRootIndex;
}

function getCurrentChord() {
  return buildChord(getCurrentChordRoot(), state.chordType);
}

function playNote(index) {
  if (!state.audioEnabled) {
    return;
  }

  const context = getAudioContext();
  if (!context) {
    return;
  }

  stopActiveVoices();
  const startTime = context.currentTime + 0.01;

  if (state.audioPlaybackMode === "single") {
    scheduleNote(context, index, startTime, 0.36, 0.22);
    return;
  }

  const chord = getCurrentChord();
  const absoluteChordSemitones = chord.intervalSemitones.map((interval) => chord.rootIndex + interval);

  if (state.audioPlaybackMode === "together") {
    absoluteChordSemitones.forEach((absoluteSemitone) => {
      scheduleNote(context, absoluteSemitone, startTime, 0.54, 0.13);
    });
    return;
  }

  absoluteChordSemitones.forEach((absoluteSemitone, step) => {
    scheduleNote(context, absoluteSemitone, startTime + step * 0.22, 0.34, 0.18);
  });
}

const renderer = createCircleRenderer({
  svgElement: elements.svg,
  tooltipElement: elements.tooltip,
  noteNames: NOTE_NAMES,
  onNoteSelect: (index) => {
    state.tonicIndex = index;
    if (state.lockChordToTonic) {
      state.chordRootIndex = index;
      elements.chordRoot.value = String(index);
    }
    renderApp();
  },
  onNotePlay: playNote,
  getTooltipContent: (index) => {
    const tonicName = NOTE_NAMES[state.tonicIndex];
    const noteName = NOTE_NAMES[index];
    const interval = analyzeInterval(state.tonicIndex, index);

    if (index === state.tonicIndex) {
      return `<strong>${noteName}</strong><br>Tonic reference: 0H (P1).<br>Tonic octave target: 12H (P8).`;
    }

    return [
      `<strong>${noteName}</strong>`,
      `${tonicName} -> ${noteName}: ${interval.semitones}H (${interval.canonicalName})`,
      `Inversion: ${interval.inversionSemitones}H (${interval.inversionCanonicalName})`,
    ].join("<br>");
  },
});

function getActiveScaleInfo() {
  return getScaleById(state.scaleId);
}

function getActiveScaleNotes() {
  return getScaleNoteIndices(state.tonicIndex, state.scaleId, state.scaleCustomIntervals);
}

function updateLabels(chordName, scaleInfo) {
  elements.tonicLabel.textContent = `Tonic: ${NOTE_NAMES[state.tonicIndex]}`;
  elements.scaleLabel.textContent = `Scale: ${scaleInfo.name}`;
  elements.chordLabel.textContent = `Chord: ${chordName}`;
}

function updateScaleMeta(scaleInfo, scaleNotes) {
  const details = [
    scaleInfo.family,
    `${scaleNotes.length} notes`,
  ];

  if (scaleInfo.temperament === "approx") {
    details.push("12-TET approximation");
  }

  if (state.scaleCustomInputError && scaleInfo.id === "artificial-custom") {
    details.push("Custom input invalid; using previous valid set.");
  } else if (scaleInfo.note) {
    details.push(scaleInfo.note);
  }

  elements.scaleMeta.textContent = details.join(" | ");
}

function renderIntervalInfo(intervalData) {
  const fromName = NOTE_NAMES[state.intervalFromIndex];
  const toName = NOTE_NAMES[state.intervalToIndex];

  elements.intervalResult.innerHTML = [
    `<strong>${fromName} -> ${toName}</strong>`,
    `Semitone distance: ${intervalData.semitones}H`,
    `Interval: ${intervalData.name}`,
    `Inversion (12H - ${intervalData.semitones}H): ${intervalData.inversionSemitones}H (${intervalData.inversionName})`,
  ].join("<br>");
}

function renderEmotionGuide() {
  const emotionGuide = getEmotionChordSuggestions(
    state.tonicIndex,
    state.tonalMode,
    state.emotionTarget,
  );

  elements.emotionChordList.innerHTML = "";
  const item = document.createElement("div");
  item.className = "progression-item";
  item.innerHTML = [
    `<strong>${emotionGuide.label}</strong>`,
    `<span>${emotionGuide.description}</span>`,
    `<span>Roman: ${emotionGuide.romanLine}</span>`,
    `<span>Chords: ${emotionGuide.chordLine}</span>`,
  ].join("");
  elements.emotionChordList.appendChild(item);
}

function renderProgressions() {
  const suggestions = getProgressionSuggestions(state.tonicIndex, state.tonalMode);
  const filtered = suggestions.filter((suggestion) => suggestion.tags.includes(state.emotionTarget));
  const visibleSuggestions = filtered.length ? filtered : suggestions;
  state.progressionCache = visibleSuggestions;

  elements.progressionList.innerHTML = "";
  visibleSuggestions.forEach((suggestion) => {
    const item = document.createElement("div");
    item.className = "progression-item";
    item.innerHTML = [
      `<strong>${suggestion.romanProgression}</strong>`,
      `<span>Chords: ${suggestion.chordsProgression}</span>`,
      `<span>Roots: ${suggestion.notesProgression}</span>`,
      `<span>${suggestion.emotion}</span>`,
    ].join("");
    elements.progressionList.appendChild(item);
  });
}

function exportProgressionsAsText() {
  if (!state.progressionCache.length) {
    return;
  }

  const tonicName = NOTE_NAMES[state.tonicIndex];
  const body = [
    `Tonic: ${tonicName}`,
    `Scale: ${getActiveScaleInfo().name}`,
    `Emotion target: ${state.emotionTarget}`,
    "",
    ...state.progressionCache.map((entry) => entry.exportLine),
  ].join("\n");

  const blob = new Blob([body], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${tonicName}-${state.emotionTarget}-progressions.txt`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function renderApp() {
  const scaleInfo = getActiveScaleInfo();
  state.tonalMode = scaleInfo.tonalMode === "major" || scaleInfo.tonalMode === "minor"
    ? scaleInfo.tonalMode
    : "other";

  elements.scaleCustomWrap.classList.toggle("is-visible", scaleInfo.id === "artificial-custom");

  refreshHarmonyToggleAvailability();

  const scaleNotes = getActiveScaleNotes();
  updateScaleMeta(scaleInfo, scaleNotes);

  const scaleConnections = state.showScaleLines
    ? getScaleConnections(scaleNotes).map((connection) => ({
        ...connection,
        title: `Scale step: ${NOTE_NAMES[connection.startIndex]} -> ${NOTE_NAMES[connection.targetIndex]}`,
      }))
    : [];

  const harmonyConnections = state.showHarmonyLines
    ? getActiveHarmonyConnections(
        state.tonicIndex,
        state.tonalMode,
        state.harmonyToggles,
      ).map((connection) => ({
        ...connection,
        title: `${connection.label}: ${connection.semitones}H`,
      }))
    : [];

  const intervalData = analyzeInterval(state.intervalFromIndex, state.intervalToIndex);
  const intervalConnection = state.showIntervalLine
    ? {
        startIndex: state.intervalFromIndex,
        targetIndex: state.intervalToIndex,
        isLoop: state.intervalFromIndex === state.intervalToIndex,
        className: "line-interval",
        color: "#d79cff",
        title: `${NOTE_NAMES[state.intervalFromIndex]} -> ${NOTE_NAMES[state.intervalToIndex]} | ${intervalData.semitones}H (${getCanonicalIntervalName(intervalData.semitones)})`,
      }
    : null;

  const chord = getCurrentChord();
  const chordConnections = state.showChordLines
    ? getChordConnections(chord.noteIndices).map((connection) => ({
        ...connection,
        title: `${chord.name}: ${NOTE_NAMES[connection.startIndex]} -> ${NOTE_NAMES[connection.targetIndex]}`,
      }))
    : [];

  renderer.updateNodeStates({
    tonicIndex: state.tonicIndex,
    scaleNoteIndices: scaleNotes,
    chordNoteIndices: chord.noteIndices,
    intervalEndpoints: [state.intervalFromIndex, state.intervalToIndex],
  });
  renderer.renderScaleConnections(scaleConnections);
  renderer.renderHarmonyConnections(harmonyConnections);
  renderer.renderChordConnections(chordConnections);
  renderer.renderIntervalConnection(intervalConnection);

  renderIntervalInfo(intervalData);
  renderEmotionGuide();
  renderProgressions();
  updateLabels(`${chord.name} (${chord.noteLabels.join(" - ")})`, scaleInfo);
}

function setupEventListeners() {
  elements.scalePreset.addEventListener("change", (event) => {
    state.scaleId = event.target.value;
    renderApp();
  });

  elements.scaleCustomIntervals.addEventListener("change", (event) => {
    const parsed = parseCustomScaleInput(event.target.value);
    if (parsed && parsed.length >= 2) {
      state.scaleCustomIntervals = parsed;
      state.scaleCustomInputError = false;
    } else {
      state.scaleCustomInputError = true;
      event.target.value = state.scaleCustomIntervals.join(",");
    }
    renderApp();
  });

  elements.showScaleLines.addEventListener("change", (event) => {
    state.showScaleLines = event.target.checked;
    renderApp();
  });

  elements.showHarmonyLines.addEventListener("change", (event) => {
    state.showHarmonyLines = event.target.checked;
    renderApp();
  });

  elements.showIntervalLine.addEventListener("change", (event) => {
    state.showIntervalLine = event.target.checked;
    renderApp();
  });

  elements.showChordLines.addEventListener("change", (event) => {
    state.showChordLines = event.target.checked;
    renderApp();
  });

  elements.intervalFrom.addEventListener("change", (event) => {
    state.intervalFromIndex = Number.parseInt(event.target.value, 10);
    renderApp();
  });

  elements.intervalTo.addEventListener("change", (event) => {
    state.intervalToIndex = Number.parseInt(event.target.value, 10);
    renderApp();
  });

  elements.chordType.addEventListener("change", (event) => {
    state.chordType = event.target.value;
    renderApp();
  });

  elements.lockChordToTonic.addEventListener("change", (event) => {
    state.lockChordToTonic = event.target.checked;
    if (state.lockChordToTonic) {
      state.chordRootIndex = state.tonicIndex;
      elements.chordRoot.value = String(state.chordRootIndex);
    }
    elements.chordRoot.disabled = state.lockChordToTonic;
    renderApp();
  });

  elements.chordRoot.addEventListener("change", (event) => {
    state.chordRootIndex = Number.parseInt(event.target.value, 10);
    if (!state.lockChordToTonic) {
      renderApp();
    }
  });

  elements.emotionTarget.addEventListener("change", (event) => {
    state.emotionTarget = event.target.value;
    renderApp();
  });

  elements.exportProgressions.addEventListener("click", exportProgressionsAsText);

  elements.audioEnabled.addEventListener("change", (event) => {
    state.audioEnabled = event.target.checked;
    if (!state.audioEnabled) {
      stopActiveVoices();
    }
  });

  elements.audioPlaybackMode.addEventListener("change", (event) => {
    state.audioPlaybackMode = event.target.value;
  });
}

function init() {
  setupSelects();
  setupHarmonyToggles();
  setupEventListeners();
  elements.chordRoot.disabled = state.lockChordToTonic;
  renderApp();
}

init();
