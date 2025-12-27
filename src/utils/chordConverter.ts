// Parser e conversor de cifra (estilo Cifra Club) para ukulele (G C E A)

export interface ChordPosition {
  // Convenção do app: 0=A, 1=E, 2=C, 3=G
  string: number;
  fret: number;
  finger?: string;
}

export interface ChordLyricStep {
  chord: string;
  lyric: string; // linha da letra associada ao acorde
}

// Dicionário mínimo (expansível). Normaliza "Am" -> "AM" etc.
const UKULELE_CHORDS: Record<string, ChordPosition[]> = {
  // Maiores
  C: [{ string: 0, fret: 3, finger: '3' }],
  D: [
    { string: 1, fret: 2, finger: '1' },
    { string: 2, fret: 2, finger: '2' },
    { string: 3, fret: 2, finger: '3' },
  ],
  // E maior (4442)
  E: [
    { string: 3, fret: 4, finger: '3' }, // G
    { string: 2, fret: 4, finger: '4' }, // C
    { string: 1, fret: 4, finger: '2' }, // E
    { string: 0, fret: 2, finger: '1' }, // A
  ],
  F: [
    // F maior (2010): G2 + E1 (mínimo)
    { string: 3, fret: 2, finger: '2' }, // G
    { string: 1, fret: 1, finger: '1' }, // E
  ],
  G: [
    { string: 0, fret: 2, finger: '1' },
    { string: 1, fret: 3, finger: '2' },
    { string: 2, fret: 2, finger: '3' },
  ],
  // A maior (2100): G2 + C1
  A: [
    { string: 3, fret: 2, finger: '2' }, // G
    { string: 2, fret: 1, finger: '1' }, // C
  ],

  // Menores (usamos AM como menor)
  // Am (2000): G2
  AM: [{ string: 3, fret: 2, finger: '2' }],
  // Dm (2210): G2 C2 E1
  DM: [
    { string: 3, fret: 2, finger: '2' }, // G
    { string: 2, fret: 2, finger: '3' }, // C
    { string: 1, fret: 1, finger: '1' }, // E
  ],
  // Em (0432): C4 E3 A2 (G aberto)
  EM: [
    { string: 2, fret: 4, finger: '4' }, // C
    { string: 1, fret: 3, finger: '3' }, // E
    { string: 0, fret: 2, finger: '1' }, // A
  ],
};

export function normalizeChordName(chordName: string): string {
  const raw = chordName.trim();
  if (!raw) return 'C';
  // Ex: "Am" => "AM", "A" => "A"
  // Mantém #/b (bem simples)
  const upper = raw.replace(/\s+/g, '');
  const m = upper.match(/^([A-Ga-g])([#b])?(m)?(.*)$/);
  if (!m) return raw.toUpperCase();
  const root = (m[1] || '').toUpperCase();
  const accidental = m[2] || '';
  const minor = m[3] ? 'M' : '';
  const rest = (m[4] || '').toUpperCase();

  // Rest (7/maj7 etc) por enquanto ignoramos no lookup; o player ainda mostra nome completo.
  return `${root}${accidental}${minor}${rest}`;
}

export function chordToPositions(chordName: string): ChordPosition[] {
  // Ex: "D/F#" -> "D"
  const noBass = chordName.split('/')[0] || chordName;
  const normalized = normalizeChordName(noBass);

  if (UKULELE_CHORDS[normalized]) return UKULELE_CHORDS[normalized];

  // Tenta remover extensões (7, maj7, sus4 etc)
  const base = normalized
    .replace(/MAJ7|M7|7|SUS2|SUS4|SUS|ADD\d+|DIM|AUG|MIN|MAJ/g, '')
    .replace(/[0-9]/g, '');
  if (UKULELE_CHORDS[base]) return UKULELE_CHORDS[base];

  return UKULELE_CHORDS.C;
}

// Parser Cifra Club “robusto o suficiente”:
// - aceita linhas só de acordes (G D Em C)
// - associa a próxima linha (letra) ao(s) acorde(s)
// - repete a mesma linha de letra para todos os acordes daquela linha (evita “só parte da cifra”)
export function parseCifraToSteps(text: string): ChordLyricStep[] {
  const lines = text.split('\n');
  const steps: ChordLyricStep[] = [];

  // Suporta: Am, A7, Amaj7, Asus4, D/F#, Bb, etc.
  const chordToken = /\b[A-G][#b]?(?:m|maj|min|dim|aug|sus2|sus4|sus)?\d*(?:\/[A-G][#b]?)?\b/g;
  let lastChord = 'C';

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] || '';
    const line = raw.trim();
    if (!line) continue;
    if (/^\[.*\]$/.test(line)) continue; // [Intro], [Refrão], etc

    const matches = line.match(chordToken) || [];
    const nonChord = line
      .replace(chordToken, '')
      .replace(/[|()[\]-]/g, '')
      .trim();
    const isChordLine = matches.length > 0 && nonChord.length < 3;

    if (isChordLine) {
      const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : '';
      const nextIsTag = /^\[.*\]$/.test(nextLine);
      const nextHasChords = (nextLine.match(chordToken) || []).length > 0 && nextLine.replace(chordToken, '').trim().length < 3;
      const lyric = nextLine && !nextIsTag && !nextHasChords ? nextLine : '';

      for (const chord of matches) {
        lastChord = chord;
        steps.push({ chord, lyric });
      }

      if (lyric) i++; // consumiu a linha da letra
    } else {
      // Linha de letra solta: NÃO deve criar um "novo acorde" (senão o player muda fora do tempo).
      // Em vez disso, anexamos a letra ao último passo existente.
      if (steps.length === 0) {
        steps.push({ chord: lastChord, lyric: line });
      } else {
        const last = steps[steps.length - 1];
        last.lyric = last.lyric ? `${last.lyric}\n${line}` : line;
      }
    }
  }

  return steps;
}


