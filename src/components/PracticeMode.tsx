import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAudioDetector } from '@/hooks/useAudioDetector';
import { 
  UkuleleType, 
  UKULELE_TUNINGS, 
  getFrequencyForPosition, 
  getNoteFromFrequency,
  isNoteMatch 
} from '@/lib/ukuleleConfig';
import { Mic, MicOff, Music, Volume2 } from 'lucide-react';

interface Note {
  string: number;
  fret: number;
  finger?: string;
}

interface PracticeModeProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  songTitle: string;
  notes: Note[];
}

const STRINGS = ['A', 'E', 'C', 'G'];
const FRETS = 5;

export function PracticeMode({ open, onOpenChange, songTitle, notes }: PracticeModeProps) {
  const [ukuleleType, setUkuleleType] = useState<UkuleleType>('soprano');
  const { isListening, frequency, volume, error, startListening, stopListening, hasPermission } = useAudioDetector();

  // Calculate which notes are being detected
  const noteStatuses = useMemo(() => {
    const statuses: Record<string, 'correct' | 'close' | 'wrong' | 'waiting'> = {};
    
    notes.forEach(note => {
      const key = `${note.string}-${note.fret}`;
      
      if (!isListening || frequency <= 0) {
        statuses[key] = 'waiting';
        return;
      }

      const expectedFreq = getFrequencyForPosition(ukuleleType, note.string, note.fret);
      statuses[key] = isNoteMatch(frequency, expectedFreq);
    });

    return statuses;
  }, [notes, frequency, isListening, ukuleleType]);

  // Calculate accuracy
  const accuracy = useMemo(() => {
    if (notes.length === 0) return 0;
    
    const correctCount = Object.values(noteStatuses).filter(s => s === 'correct').length;
    return Math.round((correctCount / notes.length) * 100);
  }, [noteStatuses, notes.length]);

  // Get detected note info
  const detectedNote = useMemo(() => {
    if (frequency <= 0) return null;
    return getNoteFromFrequency(frequency);
  }, [frequency]);

  const handleClose = () => {
    stopListening();
    onOpenChange(false);
  };

  const isNoteInSong = (string: number, fret: number) => {
    return notes.some(n => n.string === string && n.fret === fret);
  };

  const getNoteStatus = (string: number, fret: number) => {
    const key = `${string}-${fret}`;
    return noteStatuses[key] || null;
  };

  const getStatusColor = (status: 'correct' | 'close' | 'wrong' | 'waiting' | null) => {
    switch (status) {
      case 'correct':
        return 'bg-green-500 text-white ring-4 ring-green-500/50';
      case 'close':
        return 'bg-yellow-500 text-white ring-4 ring-yellow-500/50';
      case 'wrong':
        return 'bg-red-500 text-white ring-4 ring-red-500/50';
      case 'waiting':
        return 'bg-primary text-primary-foreground';
      default:
        return 'bg-transparent';
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Music className="w-5 h-5" />
            Praticar: {songTitle}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Settings */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Tipo:</span>
              <Select value={ukuleleType} onValueChange={(v) => setUkuleleType(v as UkuleleType)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="soprano">Soprano</SelectItem>
                  <SelectItem value="concert">Concert</SelectItem>
                  <SelectItem value="tenor">Tenor</SelectItem>
                  <SelectItem value="baritone">Barítono</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={isListening ? stopListening : startListening}
              variant={isListening ? 'destructive' : 'default'}
              className="gap-2"
            >
              {isListening ? (
                <>
                  <MicOff className="w-4 h-4" />
                  Parar
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4" />
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

          {/* Audio feedback */}
          {isListening && (
            <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
              <Volume2 className="w-5 h-5 text-muted-foreground" />
              <div className="flex-1">
                <div className="h-2 bg-background rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-100"
                    style={{ width: `${Math.min(volume * 500, 100)}%` }}
                  />
                </div>
              </div>
              <div className="text-right min-w-[100px]">
                {detectedNote ? (
                  <span className="font-mono font-bold text-lg">
                    {detectedNote.note}{detectedNote.octave}
                    <span className="text-xs text-muted-foreground ml-1">
                      ({detectedNote.cents > 0 ? '+' : ''}{detectedNote.cents}¢)
                    </span>
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
            </div>
          )}

          {/* Accuracy display */}
          {isListening && notes.length > 0 && (
            <div className="text-center">
              <span className="text-4xl font-bold">{accuracy}%</span>
              <p className="text-sm text-muted-foreground">Precisão</p>
            </div>
          )}

          {/* Fretboard visualization */}
          <div className="bg-card rounded-lg p-4 border-2 border-border">
            <div className="relative">
              <div className="bg-ukulele-wood rounded-lg overflow-hidden">
                {/* Open strings */}
                <div className="flex justify-center gap-[calc(100%/6)] py-2 bg-muted/50">
                  {STRINGS.map((stringName, index) => {
                    const isInSong = isNoteInSong(index, 0);
                    const status = getNoteStatus(index, 0);
                    
                    return (
                      <div
                        key={`open-${index}`}
                        className={`w-8 h-8 rounded-full border-2 text-xs font-bold flex items-center justify-center transition-all ${
                          isInSong
                            ? getStatusColor(status)
                            : 'border-border bg-background text-foreground'
                        }`}
                      >
                        {stringName}
                      </div>
                    );
                  })}
                </div>

                {/* Nut */}
                <div className="h-2 bg-background/80" />

                {/* Frets */}
                <div className="relative px-4 py-2">
                  {Array.from({ length: FRETS }).map((_, fretIndex) => (
                    <div key={fretIndex} className="relative">
                      <div className="absolute left-0 right-0 bottom-0 h-0.5 bg-ukulele-fret" />
                      
                      <div className="absolute -left-2 top-1/2 -translate-y-1/2 text-xs text-background/60 font-medium">
                        {fretIndex + 1}
                      </div>

                      <div className="flex justify-center gap-[calc(100%/6)] py-4">
                        {STRINGS.map((_, stringIndex) => {
                          const isInSong = isNoteInSong(stringIndex, fretIndex + 1);
                          const status = getNoteStatus(stringIndex, fretIndex + 1);
                          
                          return (
                            <div key={stringIndex} className="relative">
                              <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-0.5 bg-ukulele-string" />
                              
                              <div
                                className={`relative w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                                  isInSong ? getStatusColor(status) : 'bg-transparent'
                                }`}
                              >
                                {isInSong && (
                                  <span className="font-bold text-sm">●</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-3 flex justify-center gap-2 text-xs text-muted-foreground">
              <span>G</span>
              <span>C</span>
              <span>E</span>
              <span>A</span>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-green-500" />
              <span>Correto</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-yellow-500" />
              <span>Quase</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-red-500" />
              <span>Errado</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-primary" />
              <span>Aguardando</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
