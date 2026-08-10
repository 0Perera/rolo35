import { BrowserRouter, Routes, Route } from 'react-router';
import { LoginPage } from './pages/LoginPage';
import { PapelPlaceholderPage } from './pages/PapelPlaceholderPage';
import { BuscaFilmesPage } from './pages/BuscaFilmesPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/organizador" element={<BuscaFilmesPage />} />
        <Route path="/cliente" element={<PapelPlaceholderPage titulo="Área do Cliente" />} />
        <Route path="/portaria" element={<PapelPlaceholderPage titulo="Área da Portaria" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
