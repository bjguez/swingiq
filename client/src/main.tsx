import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import posthog from "posthog-js";

posthog.init("phc_SnAgEwU37mCOGklvOkB0QwgXsDwrf8xTkLsQRvKAEIA", {
  api_host: "https://us.i.posthog.com",
  capture_pageview: false, // we'll capture manually via router
});

createRoot(document.getElementById("root")!).render(<App />);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
