import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import { applyStoredTheme } from "./lib/theme";

applyStoredTheme();

ReactDOM.createRoot(document.getElementById("app")!).render(<App />);