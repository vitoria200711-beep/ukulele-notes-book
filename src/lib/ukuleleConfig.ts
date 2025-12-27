// Ukulele types and their standard tunings (frequencies in Hz)
export type UkuleleType = 'soprano' | 'concert' | 'tenor' | 'baritone';

interface UkuleleTuning {
  name: string;
  strings: [number, number, number, number]; // G, C, E, A frequencies
  stringNames: [string, string, string, string];
}

export const UKULELE_TUNINGS: Record<UkuleleType, UkuleleTuning> = {
  soprano: {
    name: 'Soprano/Concert/Tenor',
    strings: [392.00, 261.63, 329.63, 440.00], // G4, C4, E4, A4
    stringNames: ['G', 'C', 'E', 'A'],
  },
  concert: {
    name: 'Concert',
    strings: [392.00, 261.63, 329.63, 440.00], // G4, C4, E4, A4
    stringNames: ['G', 'C', 'E', 'A'],
  },
  tenor: {
    name: 'Tenor',
    strings: [392.00, 261.63, 329.63, 440.00], // G4, C4, E4, A4
    stringNames: ['G', 'C', 'E', 'A'],
  },
  baritone: {
    name: 'Barítono',
    strings: [146.83, 196.00, 246.94, 329.63], // D3, G3, B3, E4
    stringNames: ['D', 'G', 'B', 'E'],
  },
};

// Note names for display
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Calculate frequency for a given string and fret
export function getFrequencyForPosition(
  ukuleleType: UkuleleType,
  stringIndex: number,
  fret: number
): number {
  const baseFrequency = UKULELE_TUNINGS[ukuleleType].strings[stringIndex];
  // Each fret is a semitone higher (multiply by 2^(1/12))
  return baseFrequency * Math.pow(2, fret / 12);
}

// Get note name from frequency
export function getNoteFromFrequency(frequency: number): { note: string; octave: number; cents: number } {
  // A4 = 440Hz is our reference
  const A4 = 440;
  const C0 = A4 * Math.pow(2, -4.75);
  
  if (frequency <= 0) return { note: '-', octave: 0, cents: 0 };
  
  const halfSteps = 12 * Math.log2(frequency / C0);
  const octave = Math.floor(halfSteps / 12);
  const noteIndex = Math.round(halfSteps) % 12;
  const cents = Math.round((halfSteps - Math.round(halfSteps)) * 100);
  
  return {
    note: NOTE_NAMES[noteIndex < 0 ? noteIndex + 12 : noteIndex],
    octave,
    cents,
  };
}

// Get expected note for a position
export function getExpectedNote(
  ukuleleType: UkuleleType,
  stringIndex: number,
  fret: number
): string {
  const frequency = getFrequencyForPosition(ukuleleType, stringIndex, fret);
  const { note, octave } = getNoteFromFrequency(frequency);
  return `${note}${octave}`;
}

// Check if detected frequency matches expected note (within tolerance)
export function isNoteMatch(
  detectedFrequency: number,
  expectedFrequency: number,
  toleranceCents: number = 50
): 'correct' | 'close' | 'wrong' {
  if (detectedFrequency <= 0) return 'wrong';
  
  const cents = 1200 * Math.log2(detectedFrequency / expectedFrequency);
  const absCents = Math.abs(cents);
  
  if (absCents <= toleranceCents / 2) return 'correct';
  if (absCents <= toleranceCents) return 'close';
  return 'wrong';
}

// Find which note position matches a detected frequency
export function findMatchingPosition(
  detectedFrequency: number,
  ukuleleType: UkuleleType,
  maxFret: number = 5,
  toleranceCents: number = 50
): { string: number; fret: number; match: 'correct' | 'close' } | null {
  let bestMatch: { string: number; fret: number; match: 'correct' | 'close'; cents: number } | null = null;
  
  for (let stringIndex = 0; stringIndex < 4; stringIndex++) {
    for (let fret = 0; fret <= maxFret; fret++) {
      const expectedFreq = getFrequencyForPosition(ukuleleType, stringIndex, fret);
      const cents = Math.abs(1200 * Math.log2(detectedFrequency / expectedFreq));
      
      if (cents <= toleranceCents) {
        const match = cents <= toleranceCents / 2 ? 'correct' : 'close';
        
        if (!bestMatch || cents < bestMatch.cents) {
          bestMatch = { string: stringIndex, fret, match, cents };
        }
      }
    }
  }
  
  return bestMatch ? { string: bestMatch.string, fret: bestMatch.fret, match: bestMatch.match } : null;
}
