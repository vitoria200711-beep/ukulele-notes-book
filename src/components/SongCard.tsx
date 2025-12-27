import { Music, Trash2, Edit2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Song {
  id: string;
  title: string;
  artist?: string;
  notes: unknown[];
  created_at: string;
}

interface SongCardProps {
  song: Song;
  onEdit: (song: Song) => void;
  onDelete: (id: string) => void;
}

export function SongCard({ song, onEdit, onDelete }: SongCardProps) {
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
          
          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(song)}
              className="h-8 w-8 p-0"
            >
              <Edit2 className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(song.id)}
              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
