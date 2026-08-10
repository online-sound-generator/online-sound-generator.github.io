(function attachHarmonyEngine(globalObject) {
  const { NOTE_NAMES, transposeNoteIndex } = globalObject.IntervalEngine;
  const { getScaleNoteIndices } = globalObject.ScaleEngine;

  const HARMONY_RELATIONSHIPS = Object.freeze([
    { id: "dominant", label: "Dominant (D)", semitones: 7, color: "#ff8f66", modes: ["major", "minor"] },
    { id: "subdominant", label: "Subdominant (SD)", semitones: 5, color: "#55e1cf", modes: ["major", "minor"] },
    { id: "mediant", label: "Mediant (M)", semitones: 4, color: "#ffcd5c", modes: ["major", "minor"] },
    { id: "submediant", label: "Submediant (SM)", semitones: 9, color: "#c78cff", modes: ["major", "minor"] },
    { id: "supertonic", label: "Supertonic (ST)", semitones: 2, color: "#76b3ff", modes: ["major", "minor"] },
    { id: "leadingTone", label: "Leading Tone (LT, major only)", semitones: 11, color: "#9be86e", modes: ["major"] },
    { id: "subtonic", label: "Subtonic (minor only)", semitones: 10, color: "#f892d9", modes: ["minor"] },
    { id: "tonicOctave", label: "Tonic Octave (T)", semitones: 12, color: "#ffd166", modes: ["major", "minor"] },
  ]);

  const PROGRESSION_TEMPLATES = Object.freeze({
    major: Object.freeze([
      { id: "maj-145", romans: ["I", "IV", "V"], emotion: "Stable, resolved", tags: ["stable", "uplifting"] },
      { id: "maj-1564", romans: ["I", "V", "vi", "IV"], emotion: "Emotional / pop", tags: ["emotional", "uplifting"] },
      { id: "maj-251", romans: ["ii7", "V7", "Imaj7"], emotion: "Jazzy resolution", tags: ["jazzy", "sophisticated"] },
      { id: "maj-1625", romans: ["Imaj7", "vi7", "ii7", "V7"], emotion: "Classic turnaround", tags: ["jazzy", "nostalgic"] },
      { id: "maj-1451", romans: ["I", "IV", "V", "I"], emotion: "Anthemic closure", tags: ["epic", "stable"] },
      { id: "maj-bright9", romans: ["Iadd9", "IVmaj7", "V13", "Imaj9"], emotion: "Bright and modern", tags: ["uplifting", "dreamy"] },
      { id: "maj-cinematic", romans: ["Imaj7", "iii7", "IVmaj7", "ii7", "V7"], emotion: "Cinematic movement", tags: ["epic", "emotional"] },
    ]),
    minor: Object.freeze([
      { id: "min-145", romans: ["i", "iv", "v"], emotion: "Dark, modal", tags: ["dark", "melancholic"] },
      { id: "min-1637", romans: ["i", "VI", "III", "VII"], emotion: "Cinematic", tags: ["epic", "dark"] },
      { id: "min-147", romans: ["i", "iv", "VII"], emotion: "Melancholic", tags: ["melancholic", "dark"] },
      { id: "min-6257", romans: ["i", "VI", "ii7b5", "V7"], emotion: "Dramatic tension and release", tags: ["tension", "dark"] },
      { id: "min-jazz", romans: ["i7", "ii7b5", "V7b9", "iMaj7"], emotion: "Dark jazz cadence", tags: ["jazzy", "dark"] },
      { id: "min-neosoul", romans: ["i9", "iv11", "VII13", "IIImaj9"], emotion: "Moody neo-soul", tags: ["dreamy", "emotional"] },
      { id: "min-epic", romans: ["i", "VII", "VI", "V"], emotion: "Epic descent", tags: ["epic", "tension"] },
    ]),
  });

  const EMOTION_PROFILES = Object.freeze([
    {
      id: "balanced",
      label: "Balanced / Neutral",
      description: "Use this when you want clear functional harmony.",
      major: ["I", "IV", "V", "I"],
      minor: ["i", "iv", "V", "i"],
      other: ["I", "IV", "V", "I"],
    },
    {
      id: "uplifting",
      label: "Uplifting / Happy",
      description: "Favor major colors, add9 and major7 sonorities.",
      major: ["Imaj7", "IVmaj7", "Vadd9", "vi7"],
      minor: ["IIImaj7", "VImaj7", "VII", "i"],
      other: ["I", "II", "V", "I"],
    },
    {
      id: "melancholic",
      label: "Melancholic / Nostalgic",
      description: "Use minor quality with 6th, 9th, and suspended motion.",
      major: ["vi7", "IVmaj7", "Imaj7", "V7sus"],
      minor: ["i9", "iv11", "VImaj7", "VII7sus"],
      other: ["i", "iv", "VII", "i"],
    },
    {
      id: "dark",
      label: "Dark / Brooding",
      description: "Leaning on minor, diminished and altered tension colors.",
      major: ["iii7", "vi7", "ii7b5", "V7b9"],
      minor: ["i", "ii7b5", "V7b9", "iMaj7"],
      other: ["i", "ii7b5", "v", "i"],
    },
    {
      id: "dreamy",
      label: "Dreamy / Floating",
      description: "Major7, 9 and #11 colors with softer cadences.",
      major: ["Imaj9", "II7sus", "IVmaj7", "V13"],
      minor: ["i9", "IIImaj9", "VImaj7", "iv11"],
      other: ["Iadd9", "IVadd9", "I", "Vsus"],
    },
    {
      id: "tension",
      label: "Tension / Suspense",
      description: "Dominant alterations, diminished and suspended tension.",
      major: ["ii7", "V7b9", "V7#9", "I"],
      minor: ["ii7b5", "V7alt", "V7b9", "i"],
      other: ["ii", "V7b9", "V7#11", "I"],
    },
    {
      id: "epic",
      label: "Epic / Cinematic",
      description: "Wide-feeling progressions and modal interchange flavor.",
      major: ["I", "V", "vi", "IV", "ii7", "V7"],
      minor: ["i", "VII", "VI", "III", "iv", "V"],
      other: ["i", "VII", "IV", "V"],
    },
    {
      id: "jazzy",
      label: "Jazzy / Sophisticated",
      description: "7th and 9th voicings with circle motion.",
      major: ["Imaj7", "iii7", "vi7", "ii7", "V7", "Imaj9"],
      minor: ["i7", "iv7", "ii7b5", "V7b9", "iMaj7"],
      other: ["I7", "IV7", "ii7", "V7"],
    },
  ]);

  const ROMAN_DEGREE_MAP = Object.freeze({
    I: 1,
    II: 2,
    III: 3,
    IV: 4,
    V: 5,
    VI: 6,
    VII: 7,
  });

  function resolveFunctionalMode(mode) {
    if (mode === "major" || mode === "minor") {
      return mode;
    }
    return "other";
  }

  function createDefaultHarmonyToggles() {
    return HARMONY_RELATIONSHIPS.reduce((accumulator, relationship) => {
      accumulator[relationship.id] = true;
      return accumulator;
    }, {});
  }

  function isRelationshipAvailableForMode(relationship, mode) {
    const resolvedMode = resolveFunctionalMode(mode);
    if (relationship.modes.includes(resolvedMode)) {
      return true;
    }
    if (resolvedMode === "other") {
      return relationship.modes.includes("major") && relationship.modes.includes("minor");
    }
    return false;
  }

  function getActiveHarmonyConnections(tonicIndex, mode, toggles) {
    return HARMONY_RELATIONSHIPS
      .filter((relationship) => isRelationshipAvailableForMode(relationship, mode))
      .filter((relationship) => toggles[relationship.id])
      .map((relationship) => ({
        id: relationship.id,
        label: relationship.label,
        semitones: relationship.semitones,
        color: relationship.color,
        startIndex: tonicIndex,
        targetIndex: transposeNoteIndex(tonicIndex, relationship.semitones),
        isLoop: relationship.semitones % 12 === 0,
        className: "line-harmony",
      }));
  }

  function parseRomanSymbol(romanSymbol) {
    const match = romanSymbol.trim().match(/^([b#]*)([ivIV]+)(.*)$/);
    if (!match) {
      return {
        degree: 1,
        accidentalShift: 0,
        qualityRemainder: "",
        isLowerCase: false,
      };
    }

    const accidentalPrefix = match[1] ?? "";
    const numeral = match[2] ?? "I";
    const qualityRemainder = (match[3] ?? "").trim();
    const accidentalShift = [...accidentalPrefix].reduce((sum, char) => {
      if (char === "#") {
        return sum + 1;
      }
      if (char === "b") {
        return sum - 1;
      }
      return sum;
    }, 0);

    return {
      degree: ROMAN_DEGREE_MAP[numeral.toUpperCase()] ?? 1,
      accidentalShift,
      qualityRemainder,
      isLowerCase: numeral === numeral.toLowerCase(),
    };
  }

  function qualityRemainderToSuffix(remainder, isLowerCase) {
    const value = remainder.toLowerCase();

    if (!value) {
      return isLowerCase ? "m" : "";
    }
    if (value.startsWith("maj13")) {
      return isLowerCase ? "m^9" : "M13";
    }
    if (value.startsWith("maj9")) {
      return isLowerCase ? "m^9" : "M9";
    }
    if (value.startsWith("maj7")) {
      return isLowerCase ? "m^7" : "M7";
    }
    if (value.startsWith("maj")) {
      return "M";
    }
    if (value.startsWith("add9")) {
      return isLowerCase ? "madd9" : "add9";
    }
    if (value.startsWith("alt")) {
      return "7alt";
    }
    if (value.startsWith("7b13sus")) {
      return "7b13sus";
    }
    if (value.startsWith("7b9sus")) {
      return "7b9sus";
    }
    if (value.startsWith("7susadd3")) {
      return "7susadd3";
    }
    if (value.startsWith("13sus")) {
      return "13sus";
    }
    if (value.startsWith("9sus")) {
      return "9sus";
    }
    if (value.startsWith("sus")) {
      return "sus";
    }
    if (value.startsWith("7b9")) {
      return "7b9";
    }
    if (value.startsWith("7#9")) {
      return "7#9";
    }
    if (value.startsWith("7#11")) {
      return "7#11";
    }
    if (value.startsWith("7")) {
      return isLowerCase ? "m7" : "7";
    }
    if (value.startsWith("13")) {
      return "13";
    }
    if (value.startsWith("11")) {
      return isLowerCase ? "m11" : "11";
    }
    if (value.startsWith("9")) {
      return isLowerCase ? "m9" : "9";
    }
    if (value.startsWith("6")) {
      return isLowerCase ? "m6" : "6";
    }
    if (value.startsWith("m7b5") || value.startsWith("7b5")) {
      return "m7b5";
    }
    if (value.startsWith("dim7") || value.startsWith("o7")) {
      return "o7";
    }
    if (value.startsWith("dim") || value.startsWith("o")) {
      return "o";
    }

    return remainder;
  }

  function pickScaleRoot(scaleNotes, degree, accidentalShift) {
    if (!Array.isArray(scaleNotes) || !scaleNotes.length) {
      return 0;
    }
    const indexInScale = ((degree - 1) % scaleNotes.length + scaleNotes.length) % scaleNotes.length;
    const baseIndex = scaleNotes[indexInScale];
    return transposeNoteIndex(baseIndex, accidentalShift);
  }

  function romanEntryToChordName(romanEntry, scaleNotes) {
    const parsed = parseRomanSymbol(romanEntry);
    const rootIndex = pickScaleRoot(scaleNotes, parsed.degree, parsed.accidentalShift);
    const suffix = qualityRemainderToSuffix(parsed.qualityRemainder, parsed.isLowerCase);
    return `${NOTE_NAMES[rootIndex]}${suffix}`;
  }

  function getProgressionTemplatesForMode(mode) {
    const resolvedMode = resolveFunctionalMode(mode);
    if (resolvedMode === "major") {
      return PROGRESSION_TEMPLATES.major;
    }
    if (resolvedMode === "minor") {
      return PROGRESSION_TEMPLATES.minor;
    }
    return [...PROGRESSION_TEMPLATES.major.slice(0, 4), ...PROGRESSION_TEMPLATES.minor.slice(0, 4)];
  }

  function getProgressionSuggestions(tonicIndex, mode) {
    const resolvedMode = resolveFunctionalMode(mode);
    const baseScale = getScaleNoteIndices(
      tonicIndex,
      resolvedMode === "minor" ? "natural-minor-aeolian" : "major-ionian",
    );
    const templates = getProgressionTemplatesForMode(mode);

    return templates.map((template) => {
      const chords = template.romans.map((roman) => romanEntryToChordName(roman, baseScale));
      const roots = chords.map((chordName) => chordName.match(/^[A-G]#?/)[0]);

      return {
        id: template.id,
        romanProgression: template.romans.join(" - "),
        chordsProgression: chords.join(" - "),
        notesProgression: roots.join(" - "),
        emotion: template.emotion,
        tags: template.tags ?? [],
        exportLine: `${template.romans.join(" - ")} | ${chords.join(" - ")} | ${roots.join(" - ")} | ${template.emotion}`,
      };
    });
  }

  function getEmotionProfiles() {
    return EMOTION_PROFILES.map((profile) => ({
      id: profile.id,
      label: profile.label,
      description: profile.description,
    }));
  }

  function getEmotionChordSuggestions(tonicIndex, mode, emotionId) {
    const resolvedMode = resolveFunctionalMode(mode);
    const profile =
      EMOTION_PROFILES.find((entry) => entry.id === emotionId) ??
      EMOTION_PROFILES.find((entry) => entry.id === "balanced");

    const baseScale = getScaleNoteIndices(
      tonicIndex,
      resolvedMode === "minor" ? "natural-minor-aeolian" : "major-ionian",
    );
    const romanChoices = profile[resolvedMode] ?? profile.other ?? profile.major;
    const chords = romanChoices.map((romanEntry) => romanEntryToChordName(romanEntry, baseScale));

    return {
      id: profile.id,
      label: profile.label,
      description: profile.description,
      romanLine: romanChoices.join(" - "),
      chordLine: chords.join(" - "),
      chords,
    };
  }

  globalObject.HarmonyEngine = Object.freeze({
    HARMONY_RELATIONSHIPS,
    PROGRESSION_TEMPLATES,
    createDefaultHarmonyToggles,
    isRelationshipAvailableForMode,
    getActiveHarmonyConnections,
    getProgressionSuggestions,
    getEmotionProfiles,
    getEmotionChordSuggestions,
  });
})(window);
