import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import ConfigurationError from "./components/ConfigurationError";
import { isSupabaseConfigured } from "./lib/supabase";
import "./index.css";

const container = document.getElementById("root");

if (!container) {
  // Should be impossible (index.html ships the node), but never fail silently.
  document.body.innerHTML =
    '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;' +
    'background:#09090b;color:#fafafa;font-family:system-ui,sans-serif;text-align:center;padding:24px">' +
    "<div><h1 style=\"font-size:18px;margin:0 0 8px\">Application Error</h1>" +
    '<p style="color:#a1a1aa;margin:0;font-size:14px">Root element #root was not found.</p></div></div>';
  throw new Error("Root element #root was not found in index.html");
}

try {
  createRoot(container).render(
    <StrictMode>
      <ErrorBoundary>
        {isSupabaseConfigured ? <App /> : <ConfigurationError />}
      </ErrorBoundary>
    </StrictMode>,
  );
} catch (error) {
  // Last-resort guard: if React itself cannot boot, paint a readable message
  // instead of leaving an empty #root over the dark body background (which
  // renders as a completely black screen).
  console.error("[StreamVault] Fatal bootstrap error:", error);
  container.innerHTML =
    '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;' +
    'background:#09090b;color:#fafafa;font-family:system-ui,sans-serif;text-align:center;padding:24px">' +
    "<div><h1 style=\"font-size:18px;margin:0 0 8px\">Application Error</h1>" +
    '<p style="color:#a1a1aa;margin:0 0 16px;font-size:14px">Something went wrong while loading this page.</p>' +
    '<button onclick="window.location.reload()" style="height:40px;padding:0 24px;border:0;border-radius:8px;' +
    'background:#7c3aed;color:#fff;font-size:14px;cursor:pointer">Reload Page</button></div></div>';
}
