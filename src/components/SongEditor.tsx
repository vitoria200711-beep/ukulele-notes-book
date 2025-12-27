import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { UkuleleFretboard } from './UkuleleFretboard';
import { Save, X } from 'lucide-react';

interface Note {
  string: number;
  fret: number;
  finger?: string;
}

interface Song {
  id?: string;
  title: string;
  artist?: string;
  notes: Note[];
}

interface SongEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  song?: Song;
  onSave: (song: Omit<Song, 'id'> & { id?: string }) => void;
}

export function SongEditor({ open, onOpenChange, song, onSave }: SongEditorProps) {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [notes, setNotes] = useState<Note[]>([]);

  useEffect(() => {
    if (song) {
      setTitle(song.title);
      setArtist(song.artist || '');
      setNotes(song.notes || []);
    } else {
      setTitle('');
      setArtist('');
      setNotes([]);
    }
  }, [song, open]);

  const handleSave = () => {
    if (!title.trim()) return;
    
    onSave({
      id: song?.id,
      title: title.trim(),
      artist: artist.trim() || undefined,
      notes,
    });
    
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">
            {song?.id ? 'Editar Música' : 'Nova Música'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título da música *</Label>
            <Input
              id="title"
              placeholder="Ex: Somewhere Over the Rainbow"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="artist">Artista (opcional)</Label>
            <Input
              id="artist"
              placeholder="Ex: Israel Kamakawiwo'ole"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Notas do ukulele</Label>
            <p className="text-sm text-muted-foreground mb-2">
              Clique nos trastes para adicionar as notas. Use os botões de dedo para indicar qual dedo usar.
            </p>
            <UkuleleFretboard
              notes={notes}
              onNotesChange={setNotes}
              editable={true}
            />
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            <X className="w-4 h-4 mr-2" />
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={!title.trim()}
          >
            <Save className="w-4 h-4 mr-2" />
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
