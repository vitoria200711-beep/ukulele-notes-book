import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Mic, MicOff, Music, Volume2 } from 'lucide-react';
import { useAudioDetector } from '@/hooks/useAudioDetector';
import { UKULELE_TUNINGS, getNoteFromFrequency } from '@/lib/ukuleleConfig';

interface UkuleleTunerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function centsBetween(detected: number, target: number): number {
  return 1200 * Math.log2(detected / target);
}

function bestCentsToTarget(detected: number, target: number): number {
  // Compensar erro comum de oitava (x2 ou /2)
  const candidates = [target, target * 2, target / 2];
  let best = Number.POSITIVE_INFINITY;
  for (const c of candidates) {
    const cents = centsBetween(detected, c);
    const abs = Math.abs(cents);
    if (abs < Math.abs(best)) best = cents;
  }
  return best;
}

export function UkuleleTuner({ open, onOpenChange }: UkuleleTunerProps) {
  const { isListening, frequency, volume, error, startListening, stopListening } = useAudioDetector();
  const [lockedString, setLockedString] = useState<'AUTO' | 'G' | 'C' | 'E' | 'A'>('AUTO');

  const tuning = UKULELE_TUNINGS.soprano; // G C E A
  const detectedNote = useMemo(() => {
    if (frequency <= 0) return null;
    return getNoteFromFrequency(frequency);
  }, [frequency]);

  const closest = useMemo(() => {
    if (frequency <= 0) return null;
    const targets = tuning.strings.map((freq, i) => ({
      idx: i,
      name: tuning.stringNames[i],
      targetFreq: freq,
      cents: bestCentsToTarget(frequency, freq),
    }));
    targets.sort((a, b) => Math.abs(a.cents) - Math.abs(b.cents));
    return targets[0];
  }, [frequency, tuning.strings, tuning.stringNames]);

  const meter = useMemo(() => {
    if (!closest) return 50; // meio
    // clamp -50..50 cents
    const c = Math.max(-50, Math.min(50, closest.cents));
    // map para 0..100
    return ((c + 50) / 100) * 100;
  }, [closest]);

  const status = useMemo(() => {
    if (!closest || frequency <= 0) return '—';
    const abs = Math.abs(closest.cents);
    if (abs <= 5) return 'Afinado';
    return closest.cents > 0 ? 'Agudo (abaixe)' : 'Grave (suba)';
  }, [closest, frequency]);

  const handleClose = (next: boolean) => {
    if (!next) stopListening();
    onOpenChange(next);
  };

  const startForLocked = async () => {
    // Faixas mais estreitas melhoram MUITO com microfone de notebook (reduz harmônicos)
    const ranges: Record<string, { minFreq: number; maxFreq: number }> = {
      // Inclui também o 2º harmônico (muito comum ser mais forte no mic do notebook),
      // e a UI compensa erro de oitava.
      G: { minFreq: 260, maxFreq: 900 }, // G4 ~ 392 (2º harmônico ~ 784)
      C: { minFreq: 170, maxFreq: 650 }, // C4 ~ 261 (2º harmônico ~ 523)
      E: { minFreq: 220, maxFreq: 820 }, // E4 ~ 329 (2º harmônico ~ 659)
      A: { minFreq: 300, maxFreq: 980 }, // A4 ~ 440 (2º harmônico ~ 880)
    };
    if (lockedString === 'AUTO') {
      // Auto: cobre as 4 cordas e também o 2º harmônico (com correção de oitava)
      await startListening({
        minFreq: 90,
        maxFreq: 1200,
        threshold: 0.15,
        minRms: 0.008,
        minQuality: 0.45,
        softQuality: 0.35,
        allowSoftStart: true,
      });
      return;
    }
    const r = ranges[lockedString];
    await startListening({
      minFreq: r.minFreq,
      maxFreq: r.maxFreq,
      threshold: 0.15,
      minRms: 0.008,
      minQuality: 0.45,
      softQuality: 0.35,
      allowSoftStart: true,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Music className="w-5 h-5" />
            Afinador de Ukulele (GCEA)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-muted-foreground">
                  Toque <strong>uma corda por vez</strong> para melhor precisão.
                </div>
                <Button
                  onClick={isListening ? stopListening : startForLocked}
                  variant={isListening ? 'destructive' : 'default'}
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
                <div className="flex items-center gap-3">
                  <Volume2 className="w-5 h-5 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-100"
                        style={{ width: `${Math.min(volume * 500, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-2 border-amber-500/20">
            <CardContent className="p-4 space-y-2">
              <div className="text-xs text-muted-foreground uppercase">Travar corda (mais preciso)</div>
              <div className="flex flex-wrap gap-2">
                {(['AUTO', 'G', 'C', 'E', 'A'] as const).map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={lockedString === s ? 'default' : 'outline'}
                    onClick={async () => {
                      setLockedString(s);
                      if (isListening) {
                        stopListening();
                        // pequeno delay para o Chrome liberar o stream direito
                        setTimeout(() => {
                          startForLocked();
                        }, 150);
                      }
                    }}
                  >
                    {s === 'AUTO' ? 'Auto' : s}
                  </Button>
                ))}
              </div>
              <div className="text-xs text-muted-foreground">
                Dica: escolha a corda que você está afinando (G/C/E/A) para reduzir erros.
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-4">
            <Card className="border-2 border-primary/20">
              <CardContent className="p-4 text-center">
                <div className="text-xs text-muted-foreground uppercase">Nota detectada</div>
                <div className="text-5xl font-black text-primary">
                  {detectedNote ? `${detectedNote.note}${detectedNote.octave}` : '—'}
                </div>
                {detectedNote && (
                  <div className="text-xs text-muted-foreground">
                    {detectedNote.cents > 0 ? '+' : ''}
                    {detectedNote.cents}¢
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-2 border-amber-500/20">
              <CardContent className="p-4 text-center space-y-2">
                <div className="text-xs text-muted-foreground uppercase">Corda alvo</div>
                <div className="text-5xl font-black text-amber-600">
                  {closest ? closest.name : '—'}
                </div>
                <div className="text-sm font-semibold">{status}</div>
                {closest && (
                  <div className="text-xs text-muted-foreground">
                    {closest.cents > 0 ? '+' : ''}
                    {Math.round(closest.cents)}¢
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="text-xs text-muted-foreground uppercase">Ajuste fino</div>
              <div className="h-3 bg-muted rounded-full overflow-hidden relative">
                <div className="absolute left-1/2 top-0 bottom-0 w-[2px] bg-foreground/40" />
                <div
                  className="absolute top-0 bottom-0 w-3 rounded-full bg-primary shadow"
                  style={{ left: `calc(${meter}% - 6px)` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Grave</span>
                <span>OK</span>
                <span>Agudo</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}


