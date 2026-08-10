(function attachScaleEngine(globalObject) {
  const { normalizeSemitoneClass, transposeNoteIndex } = globalObject.IntervalEngine;

  const LEGACY_SCALE_ALIASES = Object.freeze({
    major: "major-ionian",
    minor: "natural-minor-aeolian",
  });

  function normalizeIntervals(intervals) {
    const normalized = [...new Set(intervals.map((value) => normalizeSemitoneClass(Math.round(value))))]
      .sort((a, b) => a - b);

    if (!normalized.includes(0)) {
      normalized.unshift(0);
    }

    return normalized;
  }

  function createScale(definition) {
    return Object.freeze({
      id: definition.id,
      family: definition.family,
      name: definition.name,
      temperament: definition.temperament ?? "12tet",
      note: definition.note ?? "",
      tonalMode: definition.tonalMode ?? "other",
      intervals: Object.freeze(normalizeIntervals(definition.intervals)),
    });
  }

  const SCALE_LIBRARY = Object.freeze([
    createScale({ id: "major-ionian", family: "I. Diatonic (7-Note) - Major System", name: "Major (Ionian)", intervals: [0, 2, 4, 5, 7, 9, 11], tonalMode: "major" }),
    createScale({ id: "natural-minor-aeolian", family: "I. Diatonic (7-Note) - Major System", name: "Natural Minor (Aeolian)", intervals: [0, 2, 3, 5, 7, 8, 10], tonalMode: "minor" }),
    createScale({ id: "harmonic-minor", family: "I. Diatonic (7-Note) - Major System", name: "Harmonic Minor", intervals: [0, 2, 3, 5, 7, 8, 11], tonalMode: "minor" }),
    createScale({ id: "melodic-minor-ascending", family: "I. Diatonic (7-Note) - Major System", name: "Melodic Minor (ascending)", intervals: [0, 2, 3, 5, 7, 9, 11], tonalMode: "minor" }),
    createScale({ id: "harmonic-major", family: "I. Diatonic (7-Note) - Major System", name: "Harmonic Major", intervals: [0, 2, 4, 5, 7, 8, 11], tonalMode: "major" }),
    createScale({ id: "melodic-major", family: "I. Diatonic (7-Note) - Major System", name: "Melodic Major (jazz minor modes)", intervals: [0, 2, 4, 5, 7, 8, 10], tonalMode: "major" }),

    createScale({ id: "mode-ionian", family: "I. Diatonic (7-Note) - Modes of Major", name: "Ionian", intervals: [0, 2, 4, 5, 7, 9, 11], tonalMode: "major" }),
    createScale({ id: "mode-dorian", family: "I. Diatonic (7-Note) - Modes of Major", name: "Dorian", intervals: [0, 2, 3, 5, 7, 9, 10], tonalMode: "minor" }),
    createScale({ id: "mode-phrygian", family: "I. Diatonic (7-Note) - Modes of Major", name: "Phrygian", intervals: [0, 1, 3, 5, 7, 8, 10], tonalMode: "minor" }),
    createScale({ id: "mode-lydian", family: "I. Diatonic (7-Note) - Modes of Major", name: "Lydian", intervals: [0, 2, 4, 6, 7, 9, 11], tonalMode: "major" }),
    createScale({ id: "mode-mixolydian", family: "I. Diatonic (7-Note) - Modes of Major", name: "Mixolydian", intervals: [0, 2, 4, 5, 7, 9, 10], tonalMode: "major" }),
    createScale({ id: "mode-aeolian", family: "I. Diatonic (7-Note) - Modes of Major", name: "Aeolian", intervals: [0, 2, 3, 5, 7, 8, 10], tonalMode: "minor" }),
    createScale({ id: "mode-locrian", family: "I. Diatonic (7-Note) - Modes of Major", name: "Locrian", intervals: [0, 1, 3, 5, 6, 8, 10], tonalMode: "minor" }),

    createScale({ id: "harmonic-minor-mode-1", family: "I. Diatonic (7-Note) - Modes of Harmonic Minor", name: "Harmonic Minor", intervals: [0, 2, 3, 5, 7, 8, 11], tonalMode: "minor" }),
    createScale({ id: "harmonic-minor-mode-2", family: "I. Diatonic (7-Note) - Modes of Harmonic Minor", name: "Locrian nat6", intervals: [0, 1, 3, 5, 6, 9, 10], tonalMode: "minor" }),
    createScale({ id: "harmonic-minor-mode-3", family: "I. Diatonic (7-Note) - Modes of Harmonic Minor", name: "Ionian #5", intervals: [0, 2, 4, 5, 8, 9, 11], tonalMode: "major" }),
    createScale({ id: "harmonic-minor-mode-4", family: "I. Diatonic (7-Note) - Modes of Harmonic Minor", name: "Dorian #4", intervals: [0, 2, 3, 6, 7, 9, 10], tonalMode: "minor" }),
    createScale({ id: "harmonic-minor-mode-5", family: "I. Diatonic (7-Note) - Modes of Harmonic Minor", name: "Phrygian Dominant", intervals: [0, 1, 4, 5, 7, 8, 10], tonalMode: "major" }),
    createScale({ id: "harmonic-minor-mode-6", family: "I. Diatonic (7-Note) - Modes of Harmonic Minor", name: "Lydian #2", intervals: [0, 3, 4, 6, 7, 9, 11], tonalMode: "major" }),
    createScale({ id: "harmonic-minor-mode-7", family: "I. Diatonic (7-Note) - Modes of Harmonic Minor", name: "Ultra-Locrian (Super-Locrian bb7)", intervals: [0, 1, 3, 4, 6, 8, 9], tonalMode: "minor" }),

    createScale({ id: "melodic-minor-mode-1", family: "I. Diatonic (7-Note) - Modes of Melodic Minor", name: "Melodic Minor", intervals: [0, 2, 3, 5, 7, 9, 11], tonalMode: "minor" }),
    createScale({ id: "melodic-minor-mode-2", family: "I. Diatonic (7-Note) - Modes of Melodic Minor", name: "Dorian b2", intervals: [0, 1, 3, 5, 7, 9, 10], tonalMode: "minor" }),
    createScale({ id: "melodic-minor-mode-3", family: "I. Diatonic (7-Note) - Modes of Melodic Minor", name: "Lydian Augmented", intervals: [0, 2, 4, 6, 8, 9, 11], tonalMode: "major" }),
    createScale({ id: "melodic-minor-mode-4", family: "I. Diatonic (7-Note) - Modes of Melodic Minor", name: "Lydian Dominant (Acoustic)", intervals: [0, 2, 4, 6, 7, 9, 10], tonalMode: "major" }),
    createScale({ id: "melodic-minor-mode-5", family: "I. Diatonic (7-Note) - Modes of Melodic Minor", name: "Mixolydian b6", intervals: [0, 2, 4, 5, 7, 8, 10], tonalMode: "major" }),
    createScale({ id: "melodic-minor-mode-6", family: "I. Diatonic (7-Note) - Modes of Melodic Minor", name: "Locrian nat2", intervals: [0, 2, 3, 5, 6, 8, 10], tonalMode: "minor" }),
    createScale({ id: "melodic-minor-mode-7", family: "I. Diatonic (7-Note) - Modes of Melodic Minor", name: "Altered (Super-Locrian)", intervals: [0, 1, 3, 4, 6, 8, 10], tonalMode: "minor" }),

    createScale({ id: "major-pentatonic", family: "II. Pentatonic (5-Note)", name: "Major Pentatonic", intervals: [0, 2, 4, 7, 9], tonalMode: "major" }),
    createScale({ id: "minor-pentatonic", family: "II. Pentatonic (5-Note)", name: "Minor Pentatonic", intervals: [0, 3, 5, 7, 10], tonalMode: "minor" }),
    createScale({ id: "blues-pentatonic", family: "II. Pentatonic (5-Note)", name: "Blues Pentatonic", intervals: [0, 3, 5, 6, 10], tonalMode: "minor" }),
    createScale({ id: "egyptian-pentatonic", family: "II. Pentatonic (5-Note)", name: "Egyptian Pentatonic", intervals: [0, 2, 5, 7, 10], tonalMode: "other" }),
    createScale({ id: "man-gong", family: "II. Pentatonic (5-Note)", name: "Man Gong", intervals: [0, 3, 5, 7, 10], tonalMode: "other" }),
    createScale({ id: "ritusen", family: "II. Pentatonic (5-Note)", name: "Ritusen", intervals: [0, 2, 5, 7, 9], tonalMode: "other" }),
    createScale({ id: "insen", family: "II. Pentatonic (5-Note)", name: "Insen", intervals: [0, 1, 5, 7, 10], tonalMode: "other" }),
    createScale({ id: "hirajoshi", family: "II. Pentatonic (5-Note)", name: "Hirajoshi", intervals: [0, 2, 3, 7, 8], tonalMode: "other" }),
    createScale({ id: "kumoi", family: "II. Pentatonic (5-Note)", name: "Kumoi", intervals: [0, 2, 3, 7, 9], tonalMode: "other" }),
    createScale({ id: "yo", family: "II. Pentatonic (5-Note)", name: "Yo Scale", intervals: [0, 2, 5, 7, 9], tonalMode: "other" }),

    createScale({ id: "whole-tone-hex", family: "III. Hexatonic (6-Note)", name: "Whole Tone", intervals: [0, 2, 4, 6, 8, 10], tonalMode: "other" }),
    createScale({ id: "augmented-hex", family: "III. Hexatonic (6-Note)", name: "Augmented Scale", intervals: [0, 3, 4, 7, 8, 11], tonalMode: "other" }),
    createScale({ id: "blues-hex", family: "III. Hexatonic (6-Note)", name: "Blues Scale", intervals: [0, 3, 5, 6, 7, 10], tonalMode: "minor" }),
    createScale({ id: "prometheus", family: "III. Hexatonic (6-Note)", name: "Prometheus", intervals: [0, 2, 4, 6, 9, 10], tonalMode: "other" }),
    createScale({ id: "tritone-scale", family: "III. Hexatonic (6-Note)", name: "Tritone Scale", intervals: [0, 1, 4, 6, 7, 10], tonalMode: "other" }),

    createScale({ id: "diminished-whole-half", family: "IV. Octatonic (8-Note)", name: "Diminished (Whole-Half)", intervals: [0, 2, 3, 5, 6, 8, 9, 11], tonalMode: "other" }),
    createScale({ id: "diminished-half-whole", family: "IV. Octatonic (8-Note)", name: "Diminished (Half-Whole)", intervals: [0, 1, 3, 4, 6, 7, 9, 10], tonalMode: "other" }),
    createScale({ id: "bebop-major", family: "IV. Octatonic (8-Note)", name: "Bebop Major", intervals: [0, 2, 4, 5, 7, 8, 9, 11], tonalMode: "major" }),
    createScale({ id: "bebop-dominant", family: "IV. Octatonic (8-Note)", name: "Bebop Dominant", intervals: [0, 2, 4, 5, 7, 9, 10, 11], tonalMode: "major" }),
    createScale({ id: "bebop-minor", family: "IV. Octatonic (8-Note)", name: "Bebop Minor", intervals: [0, 2, 3, 5, 7, 8, 9, 10], tonalMode: "minor" }),
    createScale({ id: "bebop-melodic-minor", family: "IV. Octatonic (8-Note)", name: "Bebop Melodic Minor", intervals: [0, 2, 3, 5, 7, 8, 9, 11], tonalMode: "minor" }),

    createScale({ id: "sym-chromatic", family: "V. Symmetrical Scales", name: "Chromatic (12 notes)", intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], tonalMode: "other" }),
    createScale({ id: "sym-whole-tone", family: "V. Symmetrical Scales", name: "Whole Tone", intervals: [0, 2, 4, 6, 8, 10], tonalMode: "other" }),
    createScale({ id: "sym-diminished", family: "V. Symmetrical Scales", name: "Diminished", intervals: [0, 1, 3, 4, 6, 7, 9, 10], tonalMode: "other" }),
    createScale({ id: "sym-augmented", family: "V. Symmetrical Scales", name: "Augmented", intervals: [0, 3, 4, 7, 8, 11], tonalMode: "other" }),

    createScale({ id: "neapolitan-major", family: "VI. Synthetic / Modern", name: "Neapolitan Major", intervals: [0, 1, 3, 5, 7, 9, 11], tonalMode: "major" }),
    createScale({ id: "neapolitan-minor", family: "VI. Synthetic / Modern", name: "Neapolitan Minor", intervals: [0, 1, 3, 5, 7, 8, 11], tonalMode: "minor" }),
    createScale({ id: "enigmatic", family: "VI. Synthetic / Modern", name: "Enigmatic Scale", intervals: [0, 1, 4, 6, 8, 10, 11], tonalMode: "other" }),
    createScale({ id: "double-harmonic-major", family: "VI. Synthetic / Modern", name: "Double Harmonic Major (Byzantine)", intervals: [0, 1, 4, 5, 7, 8, 11], tonalMode: "major" }),
    createScale({ id: "hungarian-minor", family: "VI. Synthetic / Modern", name: "Hungarian Minor", intervals: [0, 2, 3, 6, 7, 8, 11], tonalMode: "minor" }),
    createScale({ id: "hungarian-major", family: "VI. Synthetic / Modern", name: "Hungarian Major", intervals: [0, 3, 4, 6, 7, 9, 10], tonalMode: "major" }),
    createScale({ id: "persian", family: "VI. Synthetic / Modern", name: "Persian", intervals: [0, 1, 4, 5, 6, 8, 11], tonalMode: "other" }),
    createScale({ id: "arabic", family: "VI. Synthetic / Modern", name: "Arabic", intervals: [0, 2, 4, 5, 6, 8, 10], tonalMode: "other" }),
    createScale({ id: "spanish-gypsy", family: "VI. Synthetic / Modern", name: "Spanish Gypsy (Phrygian Dominant)", intervals: [0, 1, 4, 5, 7, 8, 10], tonalMode: "major" }),
    createScale({ id: "romanian-minor", family: "VI. Synthetic / Modern", name: "Romanian Minor", intervals: [0, 2, 3, 6, 7, 9, 10], tonalMode: "minor" }),
    createScale({ id: "balinese-pelog", family: "VI. Synthetic / Modern", name: "Balinese Pelog", intervals: [0, 1, 3, 7, 8], tonalMode: "other", temperament: "approx", note: "Approximation of Pelog in 12-TET." }),
    createScale({ id: "ukrainian-dorian", family: "VI. Synthetic / Modern", name: "Ukrainian Dorian", intervals: [0, 2, 3, 6, 7, 9, 10], tonalMode: "minor" }),
    createScale({ id: "leading-whole-tone", family: "VI. Synthetic / Modern", name: "Leading Whole Tone", intervals: [0, 2, 4, 6, 8, 10, 11], tonalMode: "other" }),
    createScale({ id: "lydian-b7", family: "VI. Synthetic / Modern", name: "Lydian b7", intervals: [0, 2, 4, 6, 7, 9, 10], tonalMode: "major" }),
    createScale({ id: "acoustic", family: "VI. Synthetic / Modern", name: "Acoustic", intervals: [0, 2, 4, 6, 7, 9, 10], tonalMode: "major" }),
    createScale({ id: "altered-dominant", family: "VI. Synthetic / Modern", name: "Altered Dominant", intervals: [0, 1, 3, 4, 6, 8, 10], tonalMode: "other" }),
    createScale({ id: "half-diminished", family: "VI. Synthetic / Modern", name: "Half Diminished", intervals: [0, 2, 3, 5, 6, 8, 10], tonalMode: "minor" }),
    createScale({ id: "major-locrian", family: "VI. Synthetic / Modern", name: "Major Locrian", intervals: [0, 2, 4, 5, 6, 8, 10], tonalMode: "major" }),
    createScale({ id: "overtone", family: "VI. Synthetic / Modern", name: "Overtone Scale", intervals: [0, 2, 4, 6, 7, 9, 10], tonalMode: "major" }),

    createScale({ id: "maqam-rast", family: "VII. Modal Folk / Regional - Maqam", name: "Rast", intervals: [0, 2, 4, 5, 7, 9, 10], tonalMode: "other", temperament: "approx", note: "12-TET approximation of microtonal Maqam." }),
    createScale({ id: "maqam-bayati", family: "VII. Modal Folk / Regional - Maqam", name: "Bayati", intervals: [0, 1, 3, 5, 7, 8, 10], tonalMode: "other", temperament: "approx", note: "12-TET approximation of microtonal Maqam." }),
    createScale({ id: "maqam-hijaz", family: "VII. Modal Folk / Regional - Maqam", name: "Hijaz", intervals: [0, 1, 4, 5, 7, 8, 10], tonalMode: "other", temperament: "approx", note: "12-TET approximation of microtonal Maqam." }),
    createScale({ id: "maqam-saba", family: "VII. Modal Folk / Regional - Maqam", name: "Saba", intervals: [0, 1, 3, 4, 7, 8, 10], tonalMode: "other", temperament: "approx", note: "12-TET approximation of microtonal Maqam." }),
    createScale({ id: "maqam-kurd", family: "VII. Modal Folk / Regional - Maqam", name: "Kurd", intervals: [0, 1, 3, 5, 7, 8, 10], tonalMode: "other", temperament: "approx", note: "12-TET approximation of microtonal Maqam." }),
    createScale({ id: "maqam-nahawand", family: "VII. Modal Folk / Regional - Maqam", name: "Nahawand", intervals: [0, 2, 3, 5, 7, 8, 10], tonalMode: "minor", temperament: "approx", note: "12-TET approximation of microtonal Maqam." }),
    createScale({ id: "maqam-ajam", family: "VII. Modal Folk / Regional - Maqam", name: "Ajam", intervals: [0, 2, 4, 5, 7, 9, 11], tonalMode: "major", temperament: "approx", note: "12-TET approximation of microtonal Maqam." }),
    createScale({ id: "maqam-sikah", family: "VII. Modal Folk / Regional - Maqam", name: "Sikah", intervals: [0, 1, 4, 5, 7, 8, 10], tonalMode: "other", temperament: "approx", note: "12-TET approximation of microtonal Maqam." }),

    createScale({ id: "thaat-bilawal", family: "VII. Modal Folk / Regional - Indian Thaat", name: "Bilawal", intervals: [0, 2, 4, 5, 7, 9, 11], tonalMode: "major" }),
    createScale({ id: "thaat-kalyan", family: "VII. Modal Folk / Regional - Indian Thaat", name: "Kalyan", intervals: [0, 2, 4, 6, 7, 9, 11], tonalMode: "major" }),
    createScale({ id: "thaat-khamaj", family: "VII. Modal Folk / Regional - Indian Thaat", name: "Khamaj", intervals: [0, 2, 4, 5, 7, 9, 10], tonalMode: "major" }),
    createScale({ id: "thaat-bhairav", family: "VII. Modal Folk / Regional - Indian Thaat", name: "Bhairav", intervals: [0, 1, 4, 5, 7, 8, 11], tonalMode: "other" }),
    createScale({ id: "thaat-poorvi", family: "VII. Modal Folk / Regional - Indian Thaat", name: "Poorvi", intervals: [0, 1, 4, 6, 7, 8, 11], tonalMode: "other" }),
    createScale({ id: "thaat-marwa", family: "VII. Modal Folk / Regional - Indian Thaat", name: "Marwa", intervals: [0, 1, 4, 6, 7, 9, 11], tonalMode: "other" }),
    createScale({ id: "thaat-kafi", family: "VII. Modal Folk / Regional - Indian Thaat", name: "Kafi", intervals: [0, 2, 3, 5, 7, 9, 10], tonalMode: "minor" }),
    createScale({ id: "thaat-asavari", family: "VII. Modal Folk / Regional - Indian Thaat", name: "Asavari", intervals: [0, 2, 3, 5, 7, 8, 10], tonalMode: "minor" }),
    createScale({ id: "thaat-todi", family: "VII. Modal Folk / Regional - Indian Thaat", name: "Todi", intervals: [0, 1, 3, 6, 7, 8, 11], tonalMode: "other" }),
    createScale({ id: "thaat-bhairavi", family: "VII. Modal Folk / Regional - Indian Thaat", name: "Bhairavi", intervals: [0, 1, 3, 5, 7, 8, 10], tonalMode: "minor" }),

    createScale({ id: "japanese-in", family: "VII. Modal Folk / Regional - Japanese", name: "In", intervals: [0, 1, 5, 7, 8], tonalMode: "other" }),
    createScale({ id: "japanese-yo", family: "VII. Modal Folk / Regional - Japanese", name: "Yo", intervals: [0, 2, 5, 7, 9], tonalMode: "other" }),
    createScale({ id: "japanese-hirajoshi", family: "VII. Modal Folk / Regional - Japanese", name: "Hirajoshi", intervals: [0, 2, 3, 7, 8], tonalMode: "other" }),
    createScale({ id: "japanese-kumoi", family: "VII. Modal Folk / Regional - Japanese", name: "Kumoi", intervals: [0, 2, 3, 7, 9], tonalMode: "other" }),
    createScale({ id: "japanese-iwato", family: "VII. Modal Folk / Regional - Japanese", name: "Iwato", intervals: [0, 1, 5, 6, 10], tonalMode: "other" }),

    createScale({ id: "chinese-gong", family: "VII. Modal Folk / Regional - Chinese", name: "Gong", intervals: [0, 2, 4, 7, 9], tonalMode: "major" }),
    createScale({ id: "chinese-shang", family: "VII. Modal Folk / Regional - Chinese", name: "Shang", intervals: [0, 2, 5, 7, 10], tonalMode: "other" }),
    createScale({ id: "chinese-jue", family: "VII. Modal Folk / Regional - Chinese", name: "Jue", intervals: [0, 3, 5, 8, 10], tonalMode: "other" }),
    createScale({ id: "chinese-zhi", family: "VII. Modal Folk / Regional - Chinese", name: "Zhi", intervals: [0, 2, 5, 7, 9], tonalMode: "other" }),
    createScale({ id: "chinese-yu", family: "VII. Modal Folk / Regional - Chinese", name: "Yu", intervals: [0, 3, 5, 7, 10], tonalMode: "minor" }),

    createScale({ id: "tet19", family: "VIII. Microtonal & Non-Western Systems", name: "19-tone Equal Temperament (approx)", intervals: [0, 2, 4, 5, 7, 9, 11], tonalMode: "other", temperament: "approx", note: "Displayed as 12-TET approximation." }),
    createScale({ id: "tet24", family: "VIII. Microtonal & Non-Western Systems", name: "24-tone Quarter-tone (approx)", intervals: [0, 2, 4, 5, 7, 9, 11], tonalMode: "other", temperament: "approx", note: "Displayed as 12-TET approximation." }),
    createScale({ id: "maqam-microtonal", family: "VIII. Microtonal & Non-Western Systems", name: "Maqam Microtonal Variants (approx)", intervals: [0, 1, 4, 5, 7, 8, 10], tonalMode: "other", temperament: "approx", note: "Displayed as 12-TET approximation." }),
    createScale({ id: "turkish-makam", family: "VIII. Microtonal & Non-Western Systems", name: "Turkish Makam (approx)", intervals: [0, 1, 4, 5, 7, 8, 10], tonalMode: "other", temperament: "approx", note: "Displayed as 12-TET approximation." }),
    createScale({ id: "persian-dastgah", family: "VIII. Microtonal & Non-Western Systems", name: "Persian Dastgah (approx)", intervals: [0, 1, 4, 5, 7, 8, 10], tonalMode: "other", temperament: "approx", note: "Displayed as 12-TET approximation." }),
    createScale({ id: "indonesian-slendro", family: "VIII. Microtonal & Non-Western Systems", name: "Indonesian Slendro (approx)", intervals: [0, 2, 5, 7, 9], tonalMode: "other", temperament: "approx", note: "Displayed as 12-TET approximation." }),
    createScale({ id: "indonesian-pelog", family: "VIII. Microtonal & Non-Western Systems", name: "Indonesian Pelog (approx)", intervals: [0, 1, 3, 7, 8], tonalMode: "other", temperament: "approx", note: "Displayed as 12-TET approximation." }),

    createScale({ id: "special-chromatic", family: "IX. Special Theoretical Constructs", name: "Chromatic", intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], tonalMode: "other" }),
    createScale({ id: "special-symmetric-division", family: "IX. Special Theoretical Constructs", name: "Synthetic Symmetric Division of Octave", intervals: [0, 3, 6, 9], tonalMode: "other" }),
    createScale({ id: "messiaen-mode-1", family: "IX. Special Theoretical Constructs", name: "Messiaen Mode 1", intervals: [0, 2, 4, 6, 8, 10], tonalMode: "other" }),
    createScale({ id: "messiaen-mode-2", family: "IX. Special Theoretical Constructs", name: "Messiaen Mode 2", intervals: [0, 1, 3, 4, 6, 7, 9, 10], tonalMode: "other" }),
    createScale({ id: "messiaen-mode-3", family: "IX. Special Theoretical Constructs", name: "Messiaen Mode 3", intervals: [0, 2, 3, 4, 6, 7, 8, 10, 11], tonalMode: "other" }),
    createScale({ id: "messiaen-mode-4", family: "IX. Special Theoretical Constructs", name: "Messiaen Mode 4", intervals: [0, 1, 2, 5, 6, 7, 8, 11], tonalMode: "other" }),
    createScale({ id: "messiaen-mode-5", family: "IX. Special Theoretical Constructs", name: "Messiaen Mode 5", intervals: [0, 1, 5, 6, 7, 11], tonalMode: "other" }),
    createScale({ id: "messiaen-mode-6", family: "IX. Special Theoretical Constructs", name: "Messiaen Mode 6", intervals: [0, 2, 4, 5, 6, 8, 10, 11], tonalMode: "other" }),
    createScale({ id: "messiaen-mode-7", family: "IX. Special Theoretical Constructs", name: "Messiaen Mode 7", intervals: [0, 1, 2, 3, 4, 6, 7, 8, 9, 10], tonalMode: "other" }),
    createScale({ id: "artificial-custom", family: "IX. Special Theoretical Constructs", name: "Artificial Scale (Custom Interval Set)", intervals: [0, 2, 4, 5, 7, 9, 11], tonalMode: "other", temperament: "custom", note: "Edit intervals manually in the custom field." }),
  ]);

  const SCALE_BY_ID = new Map(SCALE_LIBRARY.map((scale) => [scale.id, scale]));

  function resolveScaleId(scaleIdOrAlias) {
    if (SCALE_BY_ID.has(scaleIdOrAlias)) {
      return scaleIdOrAlias;
    }
    return LEGACY_SCALE_ALIASES[scaleIdOrAlias] ?? "major-ionian";
  }

  function getAllScales() {
    return SCALE_LIBRARY;
  }

  function getScaleById(scaleIdOrAlias) {
    const resolvedId = resolveScaleId(scaleIdOrAlias);
    return SCALE_BY_ID.get(resolvedId) ?? SCALE_BY_ID.get("major-ionian");
  }

  function parseCustomScaleInput(inputValue) {
    if (!inputValue || typeof inputValue !== "string") {
      return null;
    }

    const values = inputValue
      .split(/[\s,]+/)
      .map((token) => token.trim())
      .filter(Boolean)
      .map((token) => Number.parseInt(token, 10))
      .filter((value) => Number.isFinite(value));

    if (!values.length) {
      return null;
    }

    return normalizeIntervals(values);
  }

  function getScaleDegreeSemitones(scaleIdOrAlias, customIntervals) {
    const scale = getScaleById(scaleIdOrAlias);
    if (scale.id === "artificial-custom") {
      if (Array.isArray(customIntervals) && customIntervals.length) {
        return normalizeIntervals(customIntervals);
      }
      return scale.intervals;
    }

    return scale.intervals;
  }

  function getScaleNoteIndices(tonicIndex, scaleIdOrAlias, customIntervals) {
    const degreeSemitones = getScaleDegreeSemitones(scaleIdOrAlias, customIntervals);
    return degreeSemitones.map((step) => transposeNoteIndex(tonicIndex, step));
  }

  function getScaleConnections(scaleNoteIndices) {
    if (!scaleNoteIndices.length) {
      return [];
    }

    const connections = [];

    for (let i = 0; i < scaleNoteIndices.length; i += 1) {
      const startIndex = scaleNoteIndices[i];
      const targetIndex = scaleNoteIndices[(i + 1) % scaleNoteIndices.length];
      connections.push({
        startIndex,
        targetIndex,
        isLoop: false,
        className: "line-scale",
      });
    }

    return connections;
  }

  globalObject.ScaleEngine = Object.freeze({
    SCALE_LIBRARY,
    getAllScales,
    getScaleById,
    parseCustomScaleInput,
    getScaleDegreeSemitones,
    getScaleNoteIndices,
    getScaleConnections,
  });
})(window);
