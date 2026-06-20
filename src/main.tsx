import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

import { DistractionToast } from "./components/DistractionToast";

const isToast = window.location.pathname === "/toast";
if (isToast) {
  document.body.style.backgroundColor = "transparent";
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {isToast ? <DistractionToast /> : <App />}
  </React.StrictMode>,
);
