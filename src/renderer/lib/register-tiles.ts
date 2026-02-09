import { registerTile } from './tile-registry';
import WebFetchTile from '../components/tiles/WebFetchTile';
import SqlTile from '../components/tiles/SqlTile';
import MemoryTile from '../components/tiles/MemoryTile';
import SubagentTile from '../components/tiles/SubagentTile';
import SkillTile from '../components/tiles/SkillTile';
import { NotificationTile, ClipboardTile, SystemInfoTile, OpenUrlTile, SoundTile } from '../components/tiles/NativeToolTiles';

/** Register all custom tile renderers for specific tool names */
export function registerBuiltinTiles(): void {
  registerTile('web_fetch', WebFetchTile);
  registerTile('sql', SqlTile);
  registerTile('store_memory', MemoryTile);
  registerTile('task', SubagentTile);
  registerTile('skill', SkillTile);
  registerTile('desktop_notification', NotificationTile);
  registerTile('clipboard_read', ClipboardTile);
  registerTile('clipboard_write', ClipboardTile);
  registerTile('system_info', SystemInfoTile);
  registerTile('open_url', OpenUrlTile);
  registerTile('play_sound', SoundTile);
}
