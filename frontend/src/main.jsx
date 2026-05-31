import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { applyStoredTheme } from "./lib/theme.js";

applyStoredTheme();

ReactDOM.createRoot(document.getElementById("app")).render(<App />);
