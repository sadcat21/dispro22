import { createRoot } from "react-dom/client";
import RuntimeGuard from "./components/RuntimeGuard.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import App from "./App.tsx";
import "./index.css";
import { registerSW } from "virtual:pwa-register";

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    updateSW(true);
  },
  onOfflineReady() {
    console.info("App is ready for offline use.");
  },
});

createRoot(document.getElementById("root")!).render(
  <RuntimeGuard>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </RuntimeGuard>
);
