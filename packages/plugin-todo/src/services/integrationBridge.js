import { Service, logger } from '@elizaos/core';
import '../types'; // Import to register service types
/**
 * Integration bridge service for connecting with other plugins
 */
export class TodoIntegrationBridge extends Service {
    static serviceType = 'TODO_INTEGRATION_BRIDGE';
    static serviceName = 'TODO_INTEGRATION_BRIDGE';
    capabilityDescription = 'Bridges todo plugin with other plugins for enhanced functionality';
    get serviceName() {
        return 'TODO_INTEGRATION_BRIDGE';
    }
    static async start(runtime) {
        logger.info('Starting TodoIntegrationBridge...');
        const service = new TodoIntegrationBridge();
        service.runtime = runtime;
        await service.initialize();
        logger.info('TodoIntegrationBridge started successfully');
        return service;
    }
    async initialize() {
        // Initialization complete
    }
    async stop() {
        logger.info('TodoIntegrationBridge stopped');
    }
    static async stop(runtime) {
        const service = runtime.getService(TodoIntegrationBridge.serviceType);
        if (service) {
            await service.stop();
        }
    }
}
