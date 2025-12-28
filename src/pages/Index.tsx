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
import { SongView } from '@/components/SongView';
import { mergeSongsWithCifra, setSongCifra } from '@/utils/songStorage';
import { UkuleleTuner } from '@/components/UkuleleTuner';
import { PwaInstallCard } from '@/components/PwaInstallCard';

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
  cifra?: string;
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
  const [viewOpen, setViewOpen] = useState(false);
  const [viewSong, setViewSong] = useState<Song | undefined>();
  const [tunerOpen, setTunerOpen] = useState(false);
  const [showInstallHelp, setShowInstallHelp] = useState(false);

  useEffect(() => {
    try {
      const seen = localStorage.getItem('ukulele-pwa-install-seen') === '1';
      if (!seen) {
        // Mostrar apenas na primeira abertura
        setShowInstallHelp(true);
        localStorage.setItem('ukulele-pwa-install-seen', '1');
      } else {
        setShowInstallHelp(false);
      }
    } catch {
      // Se localStorage falhar, não força aparecer toda vez
      setShowInstallHelp(false);
    }
  }, []);

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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cifra: ((song as any).cifra as string | null) || undefined,
      }));

      // Mescla com cifra local (IndexedDB/localStorage)
      const merged = await mergeSongsWithCifra(typedSongs);
      setSongs(merged);

      // Se a música tiver cifra local mas o Supabase ainda estiver sem cifra,
      // sincroniza automaticamente (isso resolve PC -> celular).
      const remoteCifraById = new Map<string, string | undefined>();
      typedSongs.forEach((s) => remoteCifraById.set(s.id, s.cifra));

      // Evita re-tentar infinitamente no mesmo navegador
      const triedKey = 'ukulele-cifra-sync-tried-v1';
      let tried: Record<string, 1> = {};
      try {
        tried = JSON.parse(sessionStorage.getItem(triedKey) || '{}') as Record<string, 1>;
      } catch {
        tried = {};
      }

      const toSync = merged.filter((s) => !!s.cifra && !remoteCifraById.get(s.id) && !tried[s.id]);
      if (toSync.length > 0) {
        // Marca como tentado
        toSync.forEach((s) => (tried[s.id] = 1));
        try {
          sessionStorage.setItem(triedKey, JSON.stringify(tried));
        } catch {
          // ignore
        }

        // Roda em background, mas com feedback (1 toast) se der certo/errado.
        void (async () => {
          const results = await Promise.allSettled(
            toSync.map((s) =>
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              supabase.from('songs').update({ cifra: s.cifra } as any).eq('id', s.id)
            )
          );

          const ok = results.filter((r) => r.status === 'fulfilled').length;
          const fail = results.length - ok;

          if (ok > 0) {
            toast({
              title: 'Sincronizado',
              description: `Sincronizei ${ok} música(s) para aparecer no celular.`,
            });
          }
          if (fail > 0) {
            toast({
              title: 'Atenção',
              description: `Não consegui sincronizar ${fail} música(s). Verifique se você está logada no mesmo usuário no celular.`,
              variant: 'destructive',
            });
          }
        })();
      }
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

  const handleSave = async (songData: { id?: string; title: string; artist?: string; notes: Note[]; cifra?: string }) => {
    try {
      if (songData.id) {
        // Tenta salvar cifra também (para sincronizar no celular).
        // Se a coluna ainda não existir no Supabase, fazemos fallback sem quebrar o app.
        let updateError: any = null;
        try {
          const { error } = await supabase
            .from('songs')
            .update({
              title: songData.title,
              artist: songData.artist,
              notes: songData.notes as unknown as never,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              cifra: (songData.cifra ?? null) as any,
            } as any)
            .eq('id', songData.id);
          updateError = error;
        } catch (e) {
          updateError = e;
        }

        if (updateError) {
          // Fallback: tenta atualizar sem cifra (caso a coluna não exista ainda)
          const msg = String((updateError as any)?.message || updateError);
          if (msg.toLowerCase().includes('column') && msg.toLowerCase().includes('cifra')) {
            const { error } = await supabase
              .from('songs')
              .update({
                title: songData.title,
                artist: songData.artist,
                notes: songData.notes as unknown as never,
              })
              .eq('id', songData.id);
            if (error) throw error;
          } else {
            throw updateError;
          }
        }

        if (songData.cifra) {
          // Salvar localmente e também manter no state, para aparecer na hora no celular.
          try { await setSongCifra(songData.id, songData.cifra); } catch { /* ignore */ }
        }

        setSongs((prev) =>
          prev.map((s) =>
            s.id === songData.id
              ? {
                  ...s,
                  title: songData.title,
                  artist: songData.artist,
                  notes: songData.notes,
                  cifra: songData.cifra || s.cifra,
                }
              : s
          )
        );

        toast({ title: 'Música atualizada!' });
      } else {
        let insertData: any = null;
        let insertError: any = null;
        try {
          const { data, error } = await supabase
            .from('songs')
            .insert({
              title: songData.title,
              artist: songData.artist,
              notes: songData.notes as unknown as never,
              user_id: user?.id,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              cifra: (songData.cifra ?? null) as any,
            } as any)
            .select('id')
            .single();
          insertData = data;
          insertError = error;
        } catch (e) {
          insertError = e;
        }

        if (insertError) {
          const msg = String((insertError as any)?.message || insertError);
          if (msg.toLowerCase().includes('column') && msg.toLowerCase().includes('cifra')) {
            const { data, error } = await supabase
              .from('songs')
              .insert({
                title: songData.title,
                artist: songData.artist,
                notes: songData.notes as unknown as never,
                user_id: user?.id,
              })
              .select('id')
              .single();
            if (error) throw error;
            insertData = data;
          } else {
            throw insertError;
          }
        }

        const data = insertData;
        if (data?.id && songData.cifra) {
          try { await setSongCifra(data.id, songData.cifra); } catch { /* ignore */ }
        }

        // Atualiza a UI imediatamente (importante no celular)
        if (data?.id) {
          const now = new Date().toISOString();
          setSongs((prev) => [
            {
              id: data.id,
              title: songData.title,
              artist: songData.artist,
              notes: songData.notes,
              created_at: now,
              cifra: songData.cifra,
            },
            ...prev,
          ]);
        }

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

  const handleView = (song: Song) => {
    setViewSong(song);
    setViewOpen(true);
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
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden border">
              <img src="/ukulele-logo.svg" alt="Ukulele" className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-heading font-bold">Caderno de Ukulele</h1>
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
        {showInstallHelp && (
          <div className="mb-6">
            <PwaInstallCard
              onDismiss={() => {
                setShowInstallHelp(false);
              }}
            />
          </div>
        )}

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
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" onClick={() => setTunerOpen(true)}>
              <Music className="w-4 h-4 mr-2" />
              Afinador
            </Button>
            <Button onClick={handleNewSong}>
              <Plus className="w-4 h-4 mr-2" />
              Nova Música
            </Button>
          </div>
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
                onView={handleView}
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

      {viewSong && (
        <SongView
          open={viewOpen}
          onOpenChange={setViewOpen}
          song={viewSong}
        />
      )}

      <UkuleleTuner open={tunerOpen} onOpenChange={setTunerOpen} />
    </div>
  );
}
