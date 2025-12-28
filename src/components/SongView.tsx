import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Mic, MicOff, Pause, Play, RotateCcw, SkipBack, SkipForward, Volume2 } from 'lucide-react';
import { chordToPositions, parseCifraToSteps } from '@/utils/chordConverter';
import { UkuleleNeck } from '@/components/UkuleleNeck';
import { useAudioDetector } from '@/hooks/useAudioDetector';
import { UkuleleType, getExpectedNote, getFrequencyForPosition, getNoteFromFrequency, isNoteMatch } from '@/lib/ukuleleConfig';

interface Note {
  string: number;
  fret: number;
  finger?: string;
}

export interface SongForView {
  id: string;
  title: string;
  artist?: string;
  notes: Note[];
  created_at: string;
  cifra?: string; // música inteira (cifra completa)
}

interface SongViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  song: SongForView;
}

export function SongView({ open, onOpenChange, song }: SongViewProps) {
  const steps = useMemo(() => {
    if (song.cifra?.trim()) {
      const parsed = parseCifraToSteps(song.cifra);
      // Se por algum motivo não conseguir parsear, não “some” com a música: mostra o texto cru.
      if (!parsed || parsed.length === 0) {
        return [{ chord: '—', lyric: song.cifra }];
      }
      return parsed;
    }
    // Fallback: se não tem cifra completa, usa as notas “salvas”
    return [{ chord: 'C', lyric: 'Adicione a cifra completa para tocar a música inteira.' }];
  }, [song.cifra]);

  const [idx, setIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedMs, setSpeedMs] = useState(3500);
  const [practiceOn, setPracticeOn] = useState(true);
  const [ukuleleType] = useState<UkuleleType>('soprano');
  const listRef = useRef<HTMLDivElement>(null);
  const { isListening, frequency, volume, error, startListening, stopListening } = useAudioDetector();

  // Mapear índices de corda do app (0=A,1=E,2=C,3=G) para o ukuleleConfig (0=G,1=C,2=E,3=A)
  const appStringToConfigString = (appStringIndex: number) => 3 - appStringIndex;

  const current = steps[idx] || steps[0];
  const currentChord = current?.chord || 'C';
  const positions = useMemo(() => chordToPositions(currentChord), [currentChord]);

  const startListeningForChord = async () => {
    if (positions.length === 0) {
      await startListening({
        minFreq: 120,
        maxFreq: 1200,
        // Mesmo perfil do afinador: responde mesmo longe do alvo
        threshold: 0.15,
        minRms: 0.008,
        minQuality: 0.45,
        softQuality: 0.35,
        allowSoftStart: true,
      });
      return;
    }
    const expectedFreqs = positions.map((p) =>
      getFrequencyForPosition(ukuleleType, appStringToConfigString(p.string), p.fret)
    );
    const min = Math.min(...expectedFreqs);
    const max = Math.max(...expectedFreqs);
    await startListening({
      minFreq: Math.max(110, min * 0.7),
      maxFreq: Math.min(1200, max * 2.2),
      threshold: 0.15,
      minRms: 0.008,
      minQuality: 0.45,
      softQuality: 0.35,
      allowSoftStart: true,
    });
  };

  useEffect(() => {
    if (!open) return;
    setIdx(0);
    setIsPlaying(false);
    setPracticeOn(true);
    stopListening();
  }, [open, song.id]);

  // Começar a identificação automaticamente quando iniciar a música (Auto)
  useEffect(() => {
    if (!practiceOn) return;
    if (!isPlaying) return;
    if (isListening) return;
    if (positions.length === 0) return;

    // Requer gesto do usuário: o clique em "Auto" serve como gesto para o navegador.
    // Faixa aproximada do acorde atual para evitar harmônicos (microfone do notebook).
    startListeningForChord();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, practiceOn, currentChord]);

  useEffect(() => {
    if (!practiceOn && isListening) {
      stopListening();
    }
  }, [practiceOn, isListening, stopListening]);

  useEffect(() => {
    if (!isPlaying) return;
    if (steps.length <= 1) return;

    const t = window.setInterval(() => {
      setIdx((prev) => (prev >= steps.length - 1 ? prev : prev + 1));
    }, speedMs);
    return () => window.clearInterval(t);
  }, [isPlaying, speedMs, steps.length]);

  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector(`[data-step="${idx}"]`);
    if (el) (el as HTMLElement).scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [idx]);

  const progress = steps.length > 0 ? Math.round(((idx + 1) / steps.length) * 100) : 0;

  const noteStatuses = useMemo(() => {
    const statuses: Record<string, 'correct' | 'close' | 'wrong' | 'waiting'> = {};
    positions.forEach((p) => {
      statuses[`${p.string}-${p.fret}`] = 'waiting';
    });

    if (!practiceOn || !isListening || frequency <= 0 || positions.length === 0) {
      return statuses;
    }

    // Em batidas/acordes, o microfone geralmente “enxerga” UMA nota dominante.
    // Então marcamos somente a MELHOR correspondência do acorde atual.
    let bestKey = '';
    let bestCents = Number.POSITIVE_INFINITY;
    let bestExpected = 0;

    for (const p of positions) {
      const expected = getFrequencyForPosition(
        ukuleleType,
        appStringToConfigString(p.string),
        p.fret
      );
      const cents = Math.abs(1200 * Math.log2(frequency / expected));
      if (cents < bestCents) {
        bestCents = cents;
        bestKey = `${p.string}-${p.fret}`;
        bestExpected = expected;
      }
    }

    if (bestKey) {
      statuses[bestKey] = isNoteMatch(frequency, bestExpected);
    }

    return statuses;
  }, [positions, practiceOn, isListening, frequency, ukuleleType]);

  const detectedNote = useMemo(() => {
    if (!practiceOn || !isListening || frequency <= 0) return null;
    return getNoteFromFrequency(frequency);
  }, [practiceOn, isListening, frequency]);

  const statusBadge = (s: 'correct' | 'close' | 'wrong' | 'waiting') => {
    switch (s) {
      case 'correct':
        return 'bg-green-600 text-white';
      case 'close':
        return 'bg-yellow-500 text-white';
      case 'wrong':
        return 'bg-red-600 text-white';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 max-w-none w-screen h-[100dvh] flex flex-col overflow-hidden
        left-0 top-0 right-0 bottom-0 translate-x-0 translate-y-0
        sm:left-[50%] sm:top-[50%] sm:right-auto sm:bottom-auto sm:translate-x-[-50%] sm:translate-y-[-50%]
        sm:w-full sm:max-w-[98vw] sm:h-[95vh]"
      >
        {/* Container de scroll único (funciona melhor em mobile/desktop) */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
          {/* Header (sticky dentro do container rolável) */}
          <div className="sticky top-0 z-10 px-4 py-3 sm:px-6 sm:py-4 border-b bg-background/95 backdrop-blur flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-base sm:text-xl font-bold truncate">{song.title}</div>
              {song.artist && <div className="text-xs sm:text-sm text-muted-foreground truncate">{song.artist}</div>}
            </div>
            <div className="shrink-0 text-right">
              <div className="text-[10px] sm:text-xs text-muted-foreground uppercase">Progresso</div>
              <div className="text-base sm:text-lg font-bold">{progress}%</div>
            </div>
          </div>

          <div className="flex flex-col lg:grid lg:grid-cols-12">
              {/* Painel do acorde (mobile: topo / desktop: direita) */}
              <div className="order-1 lg:order-2 lg:col-span-5 border-b lg:border-b-0 lg:border-l">
                <div className="p-4 sm:p-6 space-y-3 sm:space-y-4 lg:sticky lg:top-20">
              <Card className="border-2 border-primary/30">
                <CardContent className="p-3 sm:p-4 text-center">
                  <div className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide">Acorde atual</div>
                  <div className="text-4xl sm:text-6xl font-black text-primary">{currentChord}</div>
                </CardContent>
              </Card>

              <div className="-mx-4 px-4 sm:mx-0 sm:px-0">
                <UkuleleNeck positions={positions} />
              </div>

              {/* Praticar enquanto vê a cifra (microfone) */}
              <Card className="border-2 border-primary/20">
                <CardContent className="p-3 sm:p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold">Praticar com microfone</div>
                      <div className="text-xs text-muted-foreground">
                        Toque <strong>uma corda por vez</strong> do acorde atual e veja se acertou.
                      </div>
                    </div>
                    <Button
                      variant={practiceOn ? 'outline' : 'default'}
                      onClick={() => setPracticeOn((p) => !p)}
                      className="shrink-0"
                    >
                      {practiceOn ? 'Desligar' : 'Ligar'}
                    </Button>
                  </div>

                  {practiceOn && (
                    <>
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-semibold text-muted-foreground">
                          Ukulele: <span className="text-foreground">GCEA</span>
                        </div>

                        <Button
                          onClick={isListening ? stopListening : startListeningForChord}
                          variant={isListening ? 'destructive' : 'default'}
                          className="ml-auto"
                        >
                          {isListening ? (
                            <>
                              <MicOff className="w-4 h-4 mr-2" />
                              Parar
                            </>
                          ) : (
                            <>
                              <Mic className="w-4 h-4 mr-2" />
                              Iniciar
                            </>
                          )}
                        </Button>
                      </div>

                      {error && (
                        <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                          {error}
                        </div>
                      )}

                      {isListening && (
                        <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                          <Volume2 className="w-5 h-5 text-muted-foreground" />
                          <div className="flex-1">
                            <div className="h-2 bg-background rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary transition-all duration-100"
                                style={{ width: `${Math.min(volume * 500, 100)}%` }}
                              />
                            </div>
                          </div>
                          <div className="min-w-[80px] text-right">
                            {detectedNote ? (
                              <span className="font-mono font-bold">
                                {detectedNote.note}
                                {detectedNote.octave}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="space-y-2">
                        {positions.map((p) => {
                          const key = `${p.string}-${p.fret}`;
                          const st = noteStatuses[key] || 'waiting';
                          const expectedLabel = getExpectedNote(
                            ukuleleType,
                            appStringToConfigString(p.string),
                            p.fret
                          );
                          const stringLabel = p.string === 3 ? 'G' : p.string === 2 ? 'C' : p.string === 1 ? 'E' : 'A';
                          return (
                            <div key={key} className="flex items-center justify-between gap-2 border rounded-lg p-2 bg-background">
                              <div className="text-sm">
                                <span className="font-bold">{stringLabel}</span>
                                <span className="text-muted-foreground"> · traste {p.fret}</span>
                                <span className="text-muted-foreground"> · esperado </span>
                                <span className="font-mono font-semibold">{expectedLabel}</span>
                              </div>
                              <div className={`px-2 py-1 rounded-md text-xs font-bold ${statusBadge(st)}`}>
                                {st === 'waiting' ? 'Aguardando' : st === 'correct' ? 'Certo' : st === 'close' ? 'Quase' : 'Errado'}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-3 sm:p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs text-muted-foreground uppercase">Velocidade</div>
                    <select
                      value={speedMs}
                      onChange={(e) => setSpeedMs(Number(e.target.value))}
                      className="border rounded-lg px-3 py-1 bg-background"
                    >
                      <option value={2500}>Rápido (2,5s)</option>
                      <option value={3500}>Normal (3,5s)</option>
                      <option value={5000}>Devagar (5s)</option>
                      <option value={7000}>Muito devagar (7s)</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-center gap-2">
                    <Button variant="outline" size="icon" onClick={() => { setIdx(0); setIsPlaying(false); }}>
                      <RotateCcw className="w-5 h-5" />
                    </Button>
                    <Button variant="outline" size="icon" disabled={idx === 0} onClick={() => setIdx((p) => Math.max(0, p - 1))}>
                      <SkipBack className="w-5 h-5" />
                    </Button>
                    <Button onClick={() => setIsPlaying((p) => !p)} className="px-6">
                      {isPlaying ? <><Pause className="w-5 h-5 mr-2" />Pausar</> : <><Play className="w-5 h-5 mr-2" />Auto</>}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={idx >= steps.length - 1}
                      onClick={() => setIdx((p) => Math.min(steps.length - 1, p + 1))}
                    >
                      <SkipForward className="w-5 h-5" />
                    </Button>
                  </div>

                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                  </div>
                </CardContent>
              </Card>
                </div>
              </div>

              {/* Texto da música inteira (mobile: embaixo / desktop: esquerda) */}
              <div className="order-2 lg:order-1 lg:col-span-7 p-4 sm:p-6 lg:border-r" ref={listRef}>
                <div className="max-w-3xl mx-auto space-y-3 pb-24">
                  {steps.map((s, i) => {
                    const isCurrent = i === idx;
                    const isPast = i < idx;
                    return (
                      <button
                        key={i}
                        data-step={i}
                        onClick={() => setIdx(i)}
                        className={`w-full text-left p-3 sm:p-4 rounded-xl border-2 transition-all ${
                          isCurrent
                            ? 'border-primary bg-primary/10'
                            : isPast
                            ? 'border-border/40 opacity-60 hover:opacity-80'
                            : 'border-border hover:border-primary/40'
                        }`}
                      >
                        <div className="text-base sm:text-lg font-extrabold text-primary">{s.chord}</div>
                        <div className="text-sm sm:text-base text-foreground whitespace-pre-wrap">{s.lyric || ' '}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


