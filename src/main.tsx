import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// React.StrictMode はエフェクトを開発時に2回実行するため、
// Tauri の onCloseRequested リスナーが二重登録される問題が起きる。
// デスクトップアプリなので外す。
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <App />
);
