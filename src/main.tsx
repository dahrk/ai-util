import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Panel from "./routes/Panel";
import Onboarding from "./routes/Onboarding";
import Playground from "./routes/Playground";
import Settings from "./routes/Settings";

import "./styles/tokens.css";
import "./styles/globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/panel" element={<Panel />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/playground" element={<Playground />} />
        <Route path="/" element={<Navigate to="/panel" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
