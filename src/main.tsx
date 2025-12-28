import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// PWA: registra service worker (auto update)
import { registerSW } from "virtual:pwa-register";

registerSW({
  immediate: true,
  onNeedRefresh() {
    // Em PWA no celular, é comum ficar “preso” numa versão antiga.
    // Ao detectar atualização do service worker, recarrega automaticamente.
    window.location.reload();
  },
});

createRoot(document.getElementById("root")!).render(<App />);
