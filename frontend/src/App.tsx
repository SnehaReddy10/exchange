import { Route, Routes } from 'react-router-dom';
import './App.css';
import Home from './components/Home';
import Market from './components/Market';

function App() {
  return (
    <div className="w-full h-screen text-white bg-black">
      <Routes>
        <Route element={<Home />} path="/"></Route>
        <Route element={<Market />} path="/market"></Route>
      </Routes>
    </div>
  );
}

export default App;
