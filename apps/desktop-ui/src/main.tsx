import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { installDesktopBridge } from "./bridge/installDesktopBridge";
import "./styles.css";
import "./themes/botanical-theme.css";

installDesktopBridge();

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
