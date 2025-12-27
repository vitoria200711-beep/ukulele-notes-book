import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { SongCard } from '@/components/SongCard';
import { SongEditor } from '@/components/SongEditor';
import { useToast } from '@/hooks/use-toast';
import { Plus, LogOut, Music, Search, Sun, Moon } from 'lucide-react';
import { Input } from '@/components/ui/input';

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

export default function Index() {
  const { user, loading, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [songs, setSongs] = useState<Song[]>([]);
  const [loadingSongs, setLoadingSongs] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingSong, setEditingSong] = useState<Song | undefined>();
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchSongs();
    }
  }, [user]);

  const fetchSongs = async () => {
    try {
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const typedSongs: Song[] = (data || []).map((song) => ({
        id: song.id,
        title: song.title,
        artist: song.artist || undefined,
        notes: Array.isArray(song.notes) ? (song.notes as unknown as Note[]) : [],
        created_at: song.created_at,
      }));

      setSongs(typedSongs);
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as músicas',
        variant: 'destructive',
      });
    } finally {
      setLoadingSongs(false);
    }
  };

  const handleSave = async (songData: { id?: string; title: string; artist?: string; notes: Note[] }) => {
    try {
      if (songData.id) {
        const { error } = await supabase
          .from('songs')
          .update({
            title: songData.title,
            artist: songData.artist,
            notes: songData.notes as unknown as never,
          })
          .eq('id', songData.id);

        if (error) throw error;

        toast({ title: 'Música atualizada!' });
      } else {
        const { error } = await supabase
          .from('songs')
          .insert({
            title: songData.title,
            artist: songData.artist,
            notes: songData.notes as unknown as never,
            user_id: user?.id,
          });

        if (error) throw error;

        toast({ title: 'Música adicionada!' });
      }

      fetchSongs();
      setEditingSong(undefined);
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar a música',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('songs')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setSongs(songs.filter((s) => s.id !== id));
      toast({ title: 'Música removida!' });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível remover a música',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (song: Song) => {
    setEditingSong(song);
    setEditorOpen(true);
  };

  const handleNewSong = () => {
    setEditingSong(undefined);
    setEditorOpen(true);
  };

  const filteredSongs = songs.filter(
    (song) =>
      song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (song.artist?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 ukulele-gradient rounded-full flex items-center justify-center">
              <Music className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-heading font-bold">Ukulele Notes</h1>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="rounded-full"
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-8">
        {/* Search and add */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar músicas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button onClick={handleNewSong} className="shrink-0">
            <Plus className="w-4 h-4 mr-2" />
            Nova Música
          </Button>
        </div>

        {/* Songs grid */}
        {loadingSongs ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredSongs.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
              <Music className="w-10 h-10 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-heading font-semibold mb-2">
              {searchQuery ? 'Nenhuma música encontrada' : 'Nenhuma música ainda'}
            </h2>
            <p className="text-muted-foreground mb-6">
              {searchQuery
                ? 'Tente buscar por outro termo'
                : 'Adicione sua primeira música para começar a anotar!'}
            </p>
            {!searchQuery && (
              <Button onClick={handleNewSong}>
                <Plus className="w-4 h-4 mr-2" />
                Adicionar música
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredSongs.map((song) => (
              <SongCard
                key={song.id}
                song={song}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </main>

      {/* Song Editor Modal */}
      <SongEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        song={editingSong}
        onSave={handleSave}
      />
    </div>
  );
}
