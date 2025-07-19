import { type Plugin } from '@elizaos/core';
import { AutonomousLoopService } from './loop-service.js';
import { toggleLoopAction } from './actions/toggle-loop.js';
import { setAdminAction } from './actions/set-admin.js';
import { adminChatProvider } from './providers/admin-chat.js';
import { autonomyRoutes } from './routes.js';

// Declare environment variables for autonomous service configuration
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      AUTONOMOUS_LOOP_INTERVAL?: string;
      AUTONOMOUS_AUTO_START?: string;
    }
  }
}

export const autoPlugin: Plugin = {
  name: 'auto',
  description: 'Simple autonomous loop that continuously triggers agent thinking and actions',

  services: [AutonomousLoopService],

  actions: [toggleLoopAction, setAdminAction],

  providers: [adminChatProvider],

  routes: autonomyRoutes,
};

// Export main components
export { AutonomousLoopService } from './loop-service.js';
export { toggleLoopAction } from './actions/toggle-loop.js';
export { setAdminAction } from './actions/set-admin.js';
export { adminChatProvider } from './providers/admin-chat.js';

export default autoPlugin;
