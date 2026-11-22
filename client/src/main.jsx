import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './estilos.css';
import './marca-caribe.css'; // capa de marca v0.6 «Atardecer Caribe» (colores, tipografía, liquid glass)

createRoot(document.getElementById('raiz')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
