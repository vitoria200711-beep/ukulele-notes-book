import { Music, Trash2, Edit2, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Note {
  string: number;
  fret: number;
  finger?: string;
}

interface Song {
  id: string;
  title: string;
  artist?: string;
  notes: Note[];
  created_at: string;
}

interface SongCardProps {
  song: Song;
  onEdit: (song: Song) => void;
  onDelete: (id: string) => void;
  onView: (song: Song) => void;
}

export function SongCard({ song, onEdit, onDelete, onView }: SongCardProps) {
  const notesCount = Array.isArray(song.notes) ? song.notes.length : 0;

  return (
    <Card className="group hover:shadow-lg transition-all duration-300 border-2 hover:border-primary/30">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Music className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg font-heading">{song.title}</CardTitle>
              {song.artist && (
                <p className="text-sm text-muted-foreground">{song.artist}</p>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {notesCount} {notesCount === 1 ? 'nota' : 'notas'} salvas
          </span>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onView(song)}
              className="h-9"
              title="Ver a música (player)"
            >
              <Eye className="w-4 h-4 mr-2" />
              Ver
            </Button>
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(song)}
            className="h-9 flex-1 justify-center"
            title="Editar"
          >
            <Edit2 className="w-4 h-4 mr-2" />
            Editar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(song.id)}
            className="h-9 flex-1 justify-center text-destructive hover:text-destructive"
            title="Excluir"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Excluir
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
