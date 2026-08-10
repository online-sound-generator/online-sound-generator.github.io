(function attachChordEngine(globalObject) {
  const { NOTE_NAMES, normalizeSemitoneClass } = globalObject.IntervalEngine;

  const CHORD_FORMULAS = Object.freeze({
    "": Object.freeze([0, 4, 7]),
    "2": Object.freeze([0, 2, 4, 7]),
    "5": Object.freeze([0, 7]),
    "6": Object.freeze([0, 4, 7, 9]),
    "7": Object.freeze([0, 4, 7, 10]),
    "9": Object.freeze([0, 4, 7, 10, 14]),
    "11": Object.freeze([0, 4, 7, 10, 14, 17]),
    "13": Object.freeze([0, 4, 7, 10, 14, 17, 21]),
    "69": Object.freeze([0, 4, 7, 9, 14]),
    add9: Object.freeze([0, 4, 7, 14]),
    o: Object.freeze([0, 3, 6]),
    h: Object.freeze([0, 3, 6]),
    sus: Object.freeze([0, 5, 7]),
    "^": Object.freeze([0, 4, 7]),
    "-": Object.freeze([0, 3, 7]),
    "^7": Object.freeze([0, 4, 7, 11]),
    "-7": Object.freeze([0, 3, 7, 10]),
    "7sus": Object.freeze([0, 5, 7, 10]),
    h7: Object.freeze([0, 3, 6, 10]),
    o7: Object.freeze([0, 3, 6, 9]),
    "^9": Object.freeze([0, 4, 7, 11, 14]),
    "^13": Object.freeze([0, 4, 7, 11, 14, 17, 21]),
    "^7#11": Object.freeze([0, 4, 7, 11, 18]),
    "^9#11": Object.freeze([0, 4, 7, 11, 14, 18]),
    "^7#5": Object.freeze([0, 4, 8, 11]),
    "-6": Object.freeze([0, 3, 7, 9]),
    "-69": Object.freeze([0, 3, 7, 9, 14]),
    "-^7": Object.freeze([0, 3, 7, 11]),
    "-^9": Object.freeze([0, 3, 7, 11, 14]),
    "-9": Object.freeze([0, 3, 7, 10, 14]),
    "-add9": Object.freeze([0, 3, 7, 14]),
    "-11": Object.freeze([0, 3, 7, 10, 14, 17]),
    "-7b5": Object.freeze([0, 3, 6, 10]),
    h9: Object.freeze([0, 3, 6, 10, 14]),
    "-b6": Object.freeze([0, 3, 7, 8]),
    "-#5": Object.freeze([0, 3, 8]),
    "7b9": Object.freeze([0, 4, 7, 10, 13]),
    "7#9": Object.freeze([0, 4, 7, 10, 15]),
    "7#11": Object.freeze([0, 4, 7, 10, 18]),
    "7b5": Object.freeze([0, 4, 6, 10]),
    "7#5": Object.freeze([0, 4, 8, 10]),
    "9#11": Object.freeze([0, 4, 7, 10, 14, 18]),
    "9b5": Object.freeze([0, 4, 6, 10, 14]),
    "9#5": Object.freeze([0, 4, 8, 10, 14]),
    "7b13": Object.freeze([0, 4, 7, 10, 20]),
    "7#9#5": Object.freeze([0, 4, 8, 10, 15]),
    "7#9b5": Object.freeze([0, 4, 6, 10, 15]),
    "7#9#11": Object.freeze([0, 4, 7, 10, 15, 18]),
    "7b9#11": Object.freeze([0, 4, 7, 10, 13, 18]),
    "7b9b5": Object.freeze([0, 4, 6, 10, 13]),
    "7b9#5": Object.freeze([0, 4, 8, 10, 13]),
    "7b9#9": Object.freeze([0, 4, 7, 10, 13, 15]),
    "7b9b13": Object.freeze([0, 4, 7, 10, 13, 20]),
    "7alt": Object.freeze([0, 4, 6, 8, 10, 13, 15]),
    "13#11": Object.freeze([0, 4, 7, 10, 14, 18, 21]),
    "13b9": Object.freeze([0, 4, 7, 10, 13, 21]),
    "13#9": Object.freeze([0, 4, 7, 10, 15, 21]),
    "7b9sus": Object.freeze([0, 5, 7, 10, 13]),
    "7susadd3": Object.freeze([0, 4, 5, 7, 10]),
    "9sus": Object.freeze([0, 5, 7, 10, 14]),
    "13sus": Object.freeze([0, 5, 7, 10, 14, 21]),
    "7b13sus": Object.freeze([0, 5, 7, 10, 20]),
    aug: Object.freeze([0, 4, 8]),
    M: Object.freeze([0, 4, 7]),
    m: Object.freeze([0, 3, 7]),
    M7: Object.freeze([0, 4, 7, 11]),
    m7: Object.freeze([0, 3, 7, 10]),
    M9: Object.freeze([0, 4, 7, 11, 14]),
    M13: Object.freeze([0, 4, 7, 11, 14, 21]),
    "M7#11": Object.freeze([0, 4, 7, 11, 18]),
    "M9#11": Object.freeze([0, 4, 7, 11, 14, 18]),
    "M7#5": Object.freeze([0, 4, 8, 11]),
    m6: Object.freeze([0, 3, 7, 9]),
    m69: Object.freeze([0, 3, 7, 9, 14]),
    "m^7": Object.freeze([0, 3, 7, 11]),
    "-M7": Object.freeze([0, 3, 7, 11]),
    "m^9": Object.freeze([0, 3, 7, 11, 14]),
    "-M9": Object.freeze([0, 3, 7, 11, 14]),
    m9: Object.freeze([0, 3, 7, 10, 14]),
    madd9: Object.freeze([0, 3, 7, 14]),
    m11: Object.freeze([0, 3, 7, 10, 14, 17]),
    m7b5: Object.freeze([0, 3, 6, 10]),
    mb6: Object.freeze([0, 3, 7, 8]),
    "m#5": Object.freeze([0, 3, 8]),
  });

  const CHORD_TOKEN_ORDER = Object.freeze([
    "2", "5", "6", "7", "9", "11", "13", "69",
    "add9", "o", "h", "sus", "^", "-", "^7",
    "-7", "7sus", "h7", "o7", "^9", "^13",
    "^7#11", "^9#11", "^7#5", "-6", "-69",
    "-^7", "-^9", "-9", "-add9", "-11",
    "-7b5", "h9", "-b6", "-#5", "7b9",
    "7#9", "7#11", "7b5", "7#5", "9#11",
    "9b5", "9#5", "7b13", "7#9#5", "7#9b5",
    "7#9#11", "7b9#11", "7b9b5", "7b9#5",
    "7b9#9", "7b9b13", "7alt", "13#11",
    "13b9", "13#9", "7b9sus", "7susadd3",
    "9sus", "13sus", "7b13sus", "", "aug",
    "M", "m", "M7", "m7", "M9", "M13", "M7#11",
    "M9#11", "M7#5", "m6", "m69", "m^7",
    "-M7", "m^9", "-M9", "m9", "madd9",
    "m11", "m7b5", "mb6", "m#5",
  ]);

  const CHORD_OPTIONS = Object.freeze(
    CHORD_TOKEN_ORDER.map((token, index) => {
      const intervals = CHORD_FORMULAS[token] ?? CHORD_FORMULAS[""];
      return Object.freeze({
        id: `strudel-${index}`,
        token,
        label: token ? `C${token}` : "C",
        intervals,
      });
    }),
  );

  const CHORD_OPTION_BY_ID = new Map(CHORD_OPTIONS.map((option) => [option.id, option]));
  const DEFAULT_CHORD_ID = CHORD_OPTIONS.find((option) => option.token === "")?.id ?? CHORD_OPTIONS[0].id;

  function semitoneToOctave(rootIndex, semitonesFromRoot) {
    return 4 + Math.floor((rootIndex + semitonesFromRoot) / 12);
  }

  function getChordTypeOptions() {
    return CHORD_OPTIONS;
  }

  function buildChord(rootIndex, chordTypeId) {
    const option = CHORD_OPTION_BY_ID.get(chordTypeId) ?? CHORD_OPTION_BY_ID.get(DEFAULT_CHORD_ID);
    const absoluteSemitones = option.intervals.map((interval) => rootIndex + interval);
    const noteIndicesRaw = absoluteSemitones.map((absolute) => normalizeSemitoneClass(absolute));
    const uniqueNoteIndices = [...new Set(noteIndicesRaw)];
    const noteLabels = absoluteSemitones.map((absolute, position) => {
      const noteIndex = normalizeSemitoneClass(absolute);
      const octave = semitoneToOctave(rootIndex, option.intervals[position]);
      return `${NOTE_NAMES[noteIndex]}${octave}`;
    });
    const token = option.token;

    return {
      rootIndex,
      chordType: option.id,
      token,
      label: option.label,
      name: token ? `${NOTE_NAMES[rootIndex]}${token}` : NOTE_NAMES[rootIndex],
      intervalSemitones: [...option.intervals],
      noteIndices: uniqueNoteIndices,
      voicedNoteIndices: noteIndicesRaw,
      notes: uniqueNoteIndices.map((index) => NOTE_NAMES[index]),
      noteLabels,
    };
  }

  function getChordConnections(noteIndices) {
    if (noteIndices.length < 2) {
      return [];
    }

    const edges = [];

    for (let i = 0; i < noteIndices.length - 1; i += 1) {
      edges.push({
        startIndex: noteIndices[i],
        targetIndex: noteIndices[i + 1],
        isLoop: false,
        className: "line-chord",
      });
    }

    if (noteIndices.length > 2) {
      edges.push({
        startIndex: noteIndices[noteIndices.length - 1],
        targetIndex: noteIndices[0],
        isLoop: false,
        className: "line-chord",
      });
    }

    return edges;
  }

  function buildTriad(rootIndex, chordTypeId) {
    return buildChord(rootIndex, chordTypeId);
  }

  function getTriadConnections(noteIndices) {
    return getChordConnections(noteIndices);
  }

  globalObject.ChordEngine = Object.freeze({
    CHORD_FORMULAS,
    getChordTypeOptions,
    buildChord,
    getChordConnections,
    buildTriad,
    getTriadConnections,
  });
})(window);
