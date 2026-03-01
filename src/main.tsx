import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import RuntimeGuard from "./components/RuntimeGuard.tsx";

createRoot(document.getElementById("root")!).render(
  <RuntimeGuard>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </RuntimeGuard>
);
