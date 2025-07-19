import { describe, it, expect, mock, beforeEach, type Mock } from 'bun:test';
import type { IAgentRuntime, Memory, State } from '@elizaos/core';
import type { UUID } from '@elizaos/core';
import { securityStatusProvider } from '../securityStatus';

const createMockRuntime = (): IAgentRuntime =>
  ({
    agentId: 'test-agent' as UUID,
    getService: mock(),
  }) as any;

const createMockMemory = (text: string, entityId: UUID): Memory =>
  ({
    entityId,
    content: {
      text,
    },
    roomId: 'room-1' as UUID,
  }) as Memory;

describe('securityStatusProvider', () => {
  let runtime: IAgentRuntime;
  let securityModule: any;
  const testEntityId = 'entity-1' as UUID;

  beforeEach(() => {
    runtime = createMockRuntime();
    securityModule = {
      getRecentSecurityIncidents: mock().mockResolvedValue([]),
      assessThreatLevel: mock().mockResolvedValue(0.2),
      analyzeMessage: mock().mockResolvedValue({
        detected: false,
        type: null,
      }),
      getSecurityRecommendations: mock().mockReturnValue([]),
    };
    (runtime.getService as unknown as Mock<any>).mockImplementation((name: string) => {
      if (name === 'security-module') {
        return securityModule;
      }
      return null;
    });
  });

  it('should provide security status', async () => {
    const memory = createMockMemory('test', testEntityId);
    const state = {} as State;

    const result = await securityStatusProvider.get(runtime, memory, state);

    expect(result).toBeDefined();
    expect(result.text).toContain('Security Status: NORMAL');
    expect(result.text).toContain('No security incidents in the last 24 hours');
    expect(result.values).toMatchObject({
      threatLevel: 0.2,
      alertLevel: 'NORMAL',
      recentIncidentCount: 0,
      hasActiveThreats: false,
      currentMessageFlagged: false,
    });
  });

  it('should handle security threats', async () => {
    securityModule.getRecentSecurityIncidents.mockResolvedValue([
      { id: 'incident-1', type: 'spam' },
      { id: 'incident-2', type: 'phishing' },
    ]);
    securityModule.assessThreatLevel.mockResolvedValue(0.8);
    securityModule.analyzeMessage.mockResolvedValue({
      detected: true,
      type: 'suspicious_link',
    });

    const memory = createMockMemory('test', testEntityId);
    const state = {} as State;

    const result = await securityStatusProvider.get(runtime, memory, state);

    expect(result.text).toContain('Security Status: HIGH ALERT');
    expect(result.text).toContain('2 security incident(s) detected');
    expect(result.text).toContain('Current message flagged: suspicious_link');
    expect(result.values?.hasActiveThreats).toBe(true);
  });

  it('should handle missing security module', async () => {
    (runtime.getService as unknown as Mock<any>).mockReturnValue(null);

    const memory = createMockMemory('test', testEntityId);
    const state = {} as State;

    const result = await securityStatusProvider.get(runtime, memory, state);

    expect(result.text).toContain('Security module not available');
  });

  it('should handle errors gracefully', async () => {
    securityModule.assessThreatLevel.mockRejectedValue(new Error('Service error'));

    const memory = createMockMemory('test', testEntityId);
    const state = {} as State;

    const result = await securityStatusProvider.get(runtime, memory, state);

    expect(result.text).toContain('Unable to fetch security status');
  });
});
