import { useState } from 'react';

interface Note {
  string: number;
  fret: number;
  finger?: string;
}

interface UkuleleFretboardProps {
  notes: Note[];
  onNotesChange: (notes: Note[]) => void;
  editable?: boolean;
}

const STRINGS = ['A', 'E', 'C', 'G']; // From bottom to top
const FRETS = 5;

export function UkuleleFretboard({ notes, onNotesChange, editable = true }: UkuleleFretboardProps) {
  const [selectedFinger, setSelectedFinger] = useState('1');

  const isNoteActive = (string: number, fret: number) => {
    return notes.some(n => n.string === string && n.fret === fret);
  };

  const getNote = (string: number, fret: number) => {
    return notes.find(n => n.string === string && n.fret === fret);
  };

  const toggleNote = (string: number, fret: number) => {
    if (!editable) return;

    const existingNote = notes.find(n => n.string === string && n.fret === fret);
    
    if (existingNote) {
      onNotesChange(notes.filter(n => !(n.string === string && n.fret === fret)));
    } else {
      onNotesChange([...notes, { string, fret, finger: selectedFinger }]);
    }
  };

  return (
    <div className="bg-card rounded-lg p-4 border-2 border-border">
      {editable && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Dedo:</span>
          {['1', '2', '3', '4'].map((finger) => (
            <button
              key={finger}
              onClick={() => setSelectedFinger(finger)}
              className={`w-8 h-8 rounded-full text-sm font-medium transition-all ${
                selectedFinger === finger
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {finger}
            </button>
          ))}
        </div>
      )}

      <div className="relative">
        {/* Fretboard */}
        <div className="bg-ukulele-wood rounded-lg overflow-hidden">
          {/* Open strings indicator */}
          <div className="flex justify-center gap-[calc(100%/6)] py-2 bg-muted/50">
            {STRINGS.map((stringName, index) => {
              const isOpen = notes.some(n => n.string === index && n.fret === 0);
              return (
                <button
                  key={`open-${index}`}
                  onClick={() => toggleNote(index, 0)}
                  className={`w-8 h-8 rounded-full border-2 text-xs font-bold transition-all ${
                    isOpen
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'border-border bg-background text-foreground hover:border-primary/50'
                  }`}
                >
                  {isOpen ? getNote(index, 0)?.finger || '○' : stringName}
                </button>
              );
            })}
          </div>

          {/* Nut */}
          <div className="h-2 bg-background/80" />

          {/* Frets */}
          <div className="relative px-4 py-2">
            {Array.from({ length: FRETS }).map((_, fretIndex) => (
              <div key={fretIndex} className="relative">
                {/* Fret wire */}
                <div className="absolute left-0 right-0 bottom-0 h-0.5 bg-ukulele-fret" />
                
                {/* Fret number */}
                <div className="absolute -left-2 top-1/2 -translate-y-1/2 text-xs text-background/60 font-medium">
                  {fretIndex + 1}
                </div>

                {/* Strings and note positions */}
                <div className="flex justify-center gap-[calc(100%/6)] py-4">
                  {STRINGS.map((_, stringIndex) => {
                    const isActive = isNoteActive(stringIndex, fretIndex + 1);
                    const note = getNote(stringIndex, fretIndex + 1);
                    
                    return (
                      <div key={stringIndex} className="relative">
                        {/* String line */}
                        <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-0.5 bg-ukulele-string string-shadow" />
                        
                        {/* Note position */}
                        <button
                          onClick={() => toggleNote(stringIndex, fretIndex + 1)}
                          className={`relative w-8 h-8 rounded-full transition-all ${
                            isActive
                              ? 'bg-primary text-primary-foreground note-glow scale-110'
                              : editable
                                ? 'bg-transparent hover:bg-primary/20'
                                : 'bg-transparent'
                          }`}
                        >
                          {isActive && (
                            <span className="font-bold text-sm">
                              {note?.finger || '●'}
                            </span>
                          )}
                        </button>
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
  );
}
