import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BrowserRouter } from "react-router-dom";
import AuthProvider from './hooks/AuthProvider'
import { I18nProvider } from './i18n';

// Create root and render app
const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <BrowserRouter>
    <I18nProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </I18nProvider>
  </BrowserRouter>
)
