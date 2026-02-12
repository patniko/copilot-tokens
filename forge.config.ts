import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { cpSync, existsSync } from 'fs';
import { resolve, join } from 'path';

const platformPkg = `copilot-${process.platform}-${process.arch}`;

const config: ForgeConfig = {
  packagerConfig: {
    appBundleId: 'com.copilot.tokens',
    asar: {
      unpack: '**/node_modules/@github/{copilot,copilot-*}/**',
    },
    icon: './icon',
    extendInfo: {
      NSMicrophoneUsageDescription: 'Copilot Tokens uses the microphone for voice-to-text input.',
    },
    osxSign: {
      optionsForFile: () => ({
        entitlements: './entitlements.plist',
        entitlementsInherit: './entitlements.child.plist',
      }),
    },
    osxNotarize: {
      tool: 'notarytool',
      keychainProfile: process.env.NOTARY_PROFILE || 'copilot-tokens',
    },
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({}),
    new MakerZIP({}, ['darwin']),
    new MakerDMG({ format: 'ULFO' }),
    new MakerDeb({}),
    new MakerRpm({}),
  ],
  hooks: {
    // Copy the Copilot CLI runtime and platform-specific native binary
    // into the packaged app so the SDK can spawn it as a subprocess.
    packageAfterCopy: async (_config, buildPath) => {
      const projectRoot = resolve(__dirname);
      for (const pkg of ['copilot', platformPkg]) {
        const src = join(projectRoot, 'node_modules', '@github', pkg);
        if (!existsSync(src)) continue;
        const dest = join(buildPath, 'node_modules', '@github', pkg);
        cpSync(src, dest, { recursive: true });
      }
    },
  },
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: 'src/main/main.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload/preload.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
  ],
};

export default config;
