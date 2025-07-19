import { logger, type Provider, type IAgentRuntime, type Memory, type State } from '@elizaos/core';
import { EventBridge } from '../managers/EventBridge';

export const eventBridgeProvider: Provider = {
  name: 'EVENT_BRIDGE_STATUS',
  description: 'Provides status and capabilities of the cross-plugin event bridge system',
  position: 10, // Run late in the provider chain

  get: async (runtime: IAgentRuntime, _message: Memory, _state: State) => {
    try {
      // Get EventBridge service instance
      const eventBridge = runtime.getService('event-bridge') as unknown as EventBridge;
      if (!eventBridge) {
        return {
          text: '',
          values: {
            eventBridgeAvailable: false,
          },
        };
      }

      // Get event statistics
      const stats = eventBridge.getEventStatistics();
      const subscribedPlugins = eventBridge.getSubscribedPlugins();

      // Determine if there are active cross-plugin connections
      const hasActiveConnections = subscribedPlugins.length > 0;
      const totalEventsEmitted = Object.values(stats.emitted).reduce(
        (sum, count) => sum + count,
        0
      );
      const totalEventsDelivered = Object.values(stats.crossPluginDelivered).reduce(
        (sum, count) => sum + count,
        0
      );
      const totalEventsFailed = Object.values(stats.crossPluginFailed).reduce(
        (sum, count) => sum + count,
        0
      );

      // Calculate reliability
      const totalAttempted = totalEventsDelivered + totalEventsFailed;
      const reliability = totalAttempted > 0 ? (totalEventsDelivered / totalAttempted) * 100 : 100;

      const text = [
        '[EVENT BRIDGE STATUS]',
        `Cross-plugin event system: ${hasActiveConnections ? 'ACTIVE' : 'INACTIVE'}`,
        `Connected plugins: ${subscribedPlugins.length}`,
        `Events emitted: ${totalEventsEmitted}`,
        `Cross-plugin delivery: ${totalEventsDelivered}/${totalAttempted} (${reliability.toFixed(1)}% success)`,
        hasActiveConnections ? `Active subscriptions: ${subscribedPlugins.join(', ')}` : '',
        `Queue size: ${stats.queueSize}`,
        '[/EVENT BRIDGE STATUS]',
      ]
        .filter(Boolean)
        .join('\n');

      return {
        text,
        values: {
          eventBridgeAvailable: true,
          hasActiveConnections,
          subscribedPlugins,
          totalEventsEmitted,
          crossPluginDelivery: {
            delivered: totalEventsDelivered,
            failed: totalEventsFailed,
            reliability,
          },
          eventStatistics: stats,
        },
        data: {
          eventBridge: {
            stats,
            subscribedPlugins,
            capabilities: [
              'entity_events',
              'relationship_events',
              'trust_events',
              'interaction_events',
              'health_events',
              'cross_plugin_communication',
            ],
          },
        },
      };
    } catch (error) {
      logger.error('[EventBridgeProvider] Error getting event bridge status:', error);
      return {
        text: '[EVENT BRIDGE STATUS]\nError: Unable to retrieve event bridge status\n[/EVENT BRIDGE STATUS]',
        values: {
          eventBridgeAvailable: false,
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  },
};
