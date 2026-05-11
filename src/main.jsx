import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import DistrictedPrototype from "./DistrictedPrototype.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <DistrictedPrototype />
  </React.StrictMode>
);
