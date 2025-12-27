import type { ChordPosition } from '@/utils/chordConverter';

interface UkuleleNeckProps {
  positions: ChordPosition[];
  frets?: number;
}

function fingerColor(finger?: string) {
  switch (finger) {
    case '1':
      return 'bg-blue-500 text-white';
    case '2':
      return 'bg-green-500 text-white';
    case '3':
      return 'bg-orange-500 text-white';
    case '4':
      return 'bg-purple-500 text-white';
    default:
      return 'bg-primary text-primary-foreground';
  }
}

export function UkuleleNeck({ positions, frets = 7 }: UkuleleNeckProps) {
  const maxFret = Math.max(1, ...positions.map((p) => p.fret || 1));
  const startFret = maxFret > frets ? Math.max(1, maxFret - frets + 1) : 1;
  const visibleFrets = Array.from({ length: frets }, (_, i) => startFret + i);

  // Layout topo->base: G, C, E, A (idx 3,2,1,0)
  const strings = [
    { label: 'G', idx: 3 },
    { label: 'C', idx: 2 },
    { label: 'E', idx: 1 },
    { label: 'A', idx: 0 },
  ];

  const map = new Map<string, ChordPosition>();
  positions.forEach((p) => map.set(`${p.string}-${p.fret}`, p));

  return (
    <div className="w-full rounded-2xl border-2 border-border bg-gradient-to-b from-amber-50 to-orange-100 dark:from-amber-950/20 dark:to-orange-950/20 p-4 shadow-lg">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-amber-900/90 dark:bg-amber-200/20 border border-amber-950/30" />
        <div className="flex-1">
          <div className="h-3 rounded-full bg-amber-900/80 dark:bg-amber-100/30" />
        </div>
      </div>

      <div className="flex items-center gap-3 mb-2">
        <div className="w-10" />
        <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${frets}, minmax(0, 1fr))` }}>
          {visibleFrets.map((f) => (
            <div key={f} className="text-center text-xs font-semibold text-muted-foreground">
              {f}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border-2 border-amber-900/30 dark:border-amber-200/20 bg-[linear-gradient(180deg,rgba(120,53,15,0.22),rgba(120,53,15,0.10))] p-4">
        {strings.map((s) => (
          <div key={s.label} className="flex items-center gap-3 py-3">
            <div className="w-10 text-sm font-bold text-amber-900 dark:text-amber-100">{s.label}</div>

            <div className="flex-1 grid gap-2" style={{ gridTemplateColumns: `repeat(${frets}, minmax(0, 1fr))` }}>
              {visibleFrets.map((fret) => {
                const p = map.get(`${s.idx}-${fret}`);
                return (
                  <div
                    key={`${s.idx}-${fret}`}
                    className="relative h-10 rounded-lg border border-amber-900/20 dark:border-amber-200/10 bg-white/40 dark:bg-black/20 overflow-hidden"
                  >
                    <div className="absolute right-0 top-0 bottom-0 w-[2px] bg-amber-900/25 dark:bg-amber-100/15" />
                    {p && (
                      <div
                        className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full shadow-lg flex items-center justify-center text-sm font-extrabold ${fingerColor(
                          p.finger
                        )}`}
                      >
                        {p.finger || ''}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {startFret > 1 && (
          <div className="mt-2 text-xs text-muted-foreground">
            Janela de trastes: {startFret}–{startFret + frets - 1}
          </div>
        )}
      </div>
    </div>
  );
}


