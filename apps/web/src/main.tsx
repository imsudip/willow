import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/lora";
import "./index.css";
import { App } from "./App";
import { registerSW } from "virtual:pwa-register";

registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
