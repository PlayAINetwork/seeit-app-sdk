import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MotionConfig } from "framer-motion";
import { GlassAuthProvider } from "./auth.js";
import { ToastProvider } from "./components/Toast.js";
import { App } from "./App.js";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <GlassAuthProvider>
      <ToastProvider>
        <MotionConfig reducedMotion="user">
          <App />
        </MotionConfig>
      </ToastProvider>
    </GlassAuthProvider>
  </StrictMode>
);
