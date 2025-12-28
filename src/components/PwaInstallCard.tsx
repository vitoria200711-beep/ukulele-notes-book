import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { X } from 'lucide-react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function isStandaloneMode() {
  // iOS Safari: navigator.standalone
  // Outros: display-mode
  return (
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window.navigator as any).standalone === true
  );
}

export function PwaInstallCard({ onDismiss }: { onDismiss?: () => void }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setInstalled(isStandaloneMode());

    const onBip = (e: Event) => {
      // Chrome: precisa chamar preventDefault para liberar prompt customizado
      e.preventDefault?.();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
      onDismiss?.();
    };

    window.addEventListener('beforeinstallprompt', onBip as EventListener);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBip as EventListener);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const canPrompt = useMemo(() => !!deferred && !installed, [deferred, installed]);

  const handleInstall = async () => {
    if (!deferred) return;
    await deferred.prompt();
    try {
      const choice = await deferred.userChoice;
      if (choice.outcome === 'accepted') {
        setInstalled(true);
        onDismiss?.();
      }
    } finally {
      setDeferred(null);
    }
  };

  return (
    <Card className="border-2 border-primary/20">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center shrink-0">
            <img src="/ukulele-logo.svg" alt="Ukulele" className="w-8 h-8" />
          </div>

          <div className="flex-1 space-y-2">
            {onDismiss && (
              <div className="flex justify-end -mt-1">
                <Button variant="ghost" size="icon" onClick={onDismiss} className="h-8 w-8">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
            <div className="font-bold text-lg leading-tight">Instalar como app (recomendado)</div>
            <div className="text-sm text-muted-foreground">
              Assim você usa offline, fica mais rápido e aparece como um app no seu celular/PC.
            </div>

            {installed ? (
              <div className="text-sm font-semibold text-green-600">Você já está usando como app ✅</div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                <Button onClick={handleInstall} disabled={!canPrompt} className="sm:w-auto w-full">
                  Instalar agora
                </Button>
                {!canPrompt && (
                  <div className="text-xs text-muted-foreground">
                    Se o botão estiver desativado: use o menu do navegador (⋮ / compartilhar) e escolha “Instalar app”.
                  </div>
                )}
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-2 pt-2">
              <div className="text-xs text-muted-foreground bg-muted/60 rounded-lg p-3">
                <div className="font-semibold text-foreground mb-1">Android/Chrome</div>
                Menu (⋮) → <strong>Instalar app</strong>
              </div>
              <div className="text-xs text-muted-foreground bg-muted/60 rounded-lg p-3">
                <div className="font-semibold text-foreground mb-1">iPhone (Safari)</div>
                Compartilhar → <strong>Adicionar à Tela de Início</strong>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


