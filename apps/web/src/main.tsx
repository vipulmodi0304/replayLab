import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, useParams } from "react-router-dom";
import Workspace from "../../../components/replaylab/workspace";
import Auth from "../../../components/replaylab/auth";
import Home from "./pages/home";
import Docs from "./pages/docs";
import "./styles.css";
function AppRoute() {
  const params = useParams();
  return (
    <Workspace segments={(params["*"] || "").split("/").filter(Boolean)} />
  );
}
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/app/*" element={<AppRoute />} />
        <Route path="/login" element={<Auth />} />
        <Route path="/register" element={<Auth register />} />
        <Route
          path="/settings"
          element={<Workspace segments={["settings"]} />}
        />
        <Route path="/docs" element={<Docs />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
