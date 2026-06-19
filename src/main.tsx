import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

import { InterdictionOverlay } from "./components/InterdictionOverlay";

const isOverlay = window.location.pathname === "/overlay";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {isOverlay ? <InterdictionOverlay /> : <App />}
  </React.StrictMode>,
);
