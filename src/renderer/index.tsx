import { createRoot } from 'react-dom/client';
import App from './App';
import './global.css';
import { registerBuiltinTiles } from './lib/register-tiles';

registerBuiltinTiles();

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
