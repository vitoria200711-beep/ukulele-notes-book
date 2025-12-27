# Caderno de Ukulele (PWA)

App para **importar/colar cifras**, ver a música em passos e praticar com **afinador + microfone** (GCEA).

## Rodar localmente

```sh
npm i
npm run dev
```

## Variáveis de ambiente (Supabase)

Crie um arquivo `.env` na raiz com:

```sh
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

## PWA (instalável)

- No Chrome: abra o app e use **Instalar app** (menu ⋮) ou o ícone de instalação na barra.
- Para gerar o PWA (service worker + manifest):

```sh
npm run build
```

