import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

import { InterdictionOverlay } from "./components/InterdictionOverlay";
import { DistractionToast } from "./components/DistractionToast";

const isOverlay = window.location.pathname === "/overlay";
const isToast = window.location.pathname === "/toast";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {isOverlay ? <InterdictionOverlay /> : isToast ? <DistractionToast /> : <App />}
  </React.StrictMode>,
);
