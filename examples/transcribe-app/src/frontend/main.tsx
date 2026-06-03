import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { GlassAuthProvider } from "./auth.js";
import { App } from "./App.js";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <GlassAuthProvider>
      <App />
    </GlassAuthProvider>
  </StrictMode>
);
