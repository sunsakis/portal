import { Routes, Route, useParams, useNavigate } from 'react-router-dom';
import Map from './components/Map';
import './App.css';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Map />} />
      <Route path="/:shareId" element={<Map />} />
    </Routes>
  );
}

export default App;