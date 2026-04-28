import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ensurePerformanceApp, registerServiceWorker } from './lib/performanceApp.browser';
import './styles.css';

void ensurePerformanceApp();
void registerServiceWorker();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);