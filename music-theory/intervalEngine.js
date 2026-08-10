(function attachIntervalEngine(globalObject) {
  const NOTE_NAMES = Object.freeze([
    "C",
    "C#",
    "D",
    "D#",
    "E",
    "F",
    "F#",
    "G",
    "G#",
    "A",
    "A#",
    "B",
  ]);

  const INTERVAL_LABELS = new Map([
    [0, "P1 / Dim2"],
    [1, "m2"],
    [2, "M2 / Dim3"],
    [3, "m3 / Aug2"],
    [4, "M3 / Dim4"],
    [5, "P4 / Aug3"],
    [6, "Aug4 / Dim5 (Tritone)"],
    [7, "P5 / Dim6"],
    [8, "m6 / Aug5"],
    [9, "M6 / Dim7"],
    [10, "m7 / Aug6"],
    [11, "M7 / Dim8"],
    [12, "P8 / Aug7"],
    [13, "Aug8"],
  ]);

  const CANONICAL_INTERVALS = new Map([
    [0, "P1"],
    [1, "m2"],
    [2, "M2"],
    [3, "m3"],
    [4, "M3"],
    [5, "P4"],
    [6, "Aug4"],
    [7, "P5"],
    [8, "m6"],
    [9, "M6"],
    [10, "m7"],
    [11, "M7"],
    [12, "P8"],
    [13, "Aug8"],
  ]);

  function normalizeSemitoneClass(value) {
    return ((value % 12) + 12) % 12;
  }

  function transposeNoteIndex(noteIndex, semitones) {
    return normalizeSemitoneClass(noteIndex + semitones);
  }

  function semitoneDistance(fromIndex, toIndex) {
    return normalizeSemitoneClass(toIndex - fromIndex);
  }

  function getIntervalLabelBySemitones(semitones) {
    if (INTERVAL_LABELS.has(semitones)) {
      return INTERVAL_LABELS.get(semitones);
    }

    const reduced = normalizeSemitoneClass(semitones);
    if (INTERVAL_LABELS.has(reduced)) {
      return `${INTERVAL_LABELS.get(reduced)} (+${Math.floor(semitones / 12)} oct)`;
    }

    return `${semitones}H`;
  }

  function getCanonicalIntervalName(semitones) {
    if (CANONICAL_INTERVALS.has(semitones)) {
      return CANONICAL_INTERVALS.get(semitones);
    }

    const reduced = normalizeSemitoneClass(semitones);
    return CANONICAL_INTERVALS.get(reduced) ?? `${reduced}H`;
  }

  function invertSemitoneDistance(semitones) {
    const normalized = normalizeSemitoneClass(semitones);
    return normalized === 0 ? 12 : 12 - normalized;
  }

  function analyzeInterval(fromIndex, toIndex) {
    const semitones = semitoneDistance(fromIndex, toIndex);
    const inversionSemitones = invertSemitoneDistance(semitones);

    return {
      semitones,
      name: getIntervalLabelBySemitones(semitones),
      canonicalName: getCanonicalIntervalName(semitones),
      inversionSemitones,
      inversionName: getIntervalLabelBySemitones(inversionSemitones),
      inversionCanonicalName: getCanonicalIntervalName(inversionSemitones),
    };
  }

  globalObject.IntervalEngine = Object.freeze({
    NOTE_NAMES,
    normalizeSemitoneClass,
    transposeNoteIndex,
    semitoneDistance,
    getIntervalLabelBySemitones,
    getCanonicalIntervalName,
    invertSemitoneDistance,
    analyzeInterval,
  });
})(window);
