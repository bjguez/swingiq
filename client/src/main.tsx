import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import posthog from "posthog-js";

posthog.init("phc_SnAgEwU37mCOGklvOkB0QwgXsDwrf8xTkLsQRvKAEIA", {
  api_host: "/ingest",
  ui_host: "https://us.posthog.com",
  capture_pageview: false,
});

createRoot(document.getElementById("root")!).render(<App />);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
