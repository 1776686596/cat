import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { installDesktopBridge } from "./bridge/installDesktopBridge";
import "./styles.css";

installDesktopBridge();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
