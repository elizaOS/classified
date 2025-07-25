import type { Plugin } from '@elizaos/core';
import { sayAloudAction } from './actions/sayAloud';
import { SamTTSService } from './services/SamTTSService';

/**
 * Plugin SAM - Retro TTS using SAM Speech Synthesizer
 *
 * Provides classic 1980s text-to-speech capabilities using the SAM synthesizer.
 * Integrates with the hardware bridge to send audio directly to user speakers.
 */
export const samPlugin: Plugin = {
  name: '@elizaos/plugin-sam',
  description: 'Retro text-to-speech using SAM Speech Synthesizer with hardware bridge integration',

  actions: [sayAloudAction],

  services: [SamTTSService],

  // Initialize the plugin
  init: async (_config, _runtime) => {
    console.log('[SAM-PLUGIN] Initializing SAM TTS plugin...');

    // The service will be automatically started by the runtime
    console.log('[SAM-PLUGIN] SAM TTS plugin initialized successfully');
  },
};

export default samPlugin;
export * from './actions/sayAloud';
export * from './services/SamTTSService';
