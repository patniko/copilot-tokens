import { registerTile } from './tile-registry';
import WebFetchTile from '../components/tiles/WebFetchTile';

/** Register all custom tile renderers for specific tool names */
export function registerBuiltinTiles(): void {
  registerTile('web_fetch', WebFetchTile);
}
