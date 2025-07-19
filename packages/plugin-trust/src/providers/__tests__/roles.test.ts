import { describe, it, expect, mock, beforeEach, type Mock } from 'bun:test';
import type { IAgentRuntime, Memory, State } from '@elizaos/core';
import { ChannelType } from '@elizaos/core';
import type { UUID } from '@elizaos/core';
import { roleProvider } from '../roles';
import { createMockRuntime, createMockMemory, createMockState } from '../../__tests__/test-utils';

const createProviderRolesMockRuntime = (): IAgentRuntime => {
  const mockWorld = {
    id: 'world-1' as UUID,
    metadata: {
      ownership: {
        ownerId: 'owner-1',
      },
      roles: {
        'entity-1': 'OWNER',
        'entity-2': 'ADMIN',
        'entity-3': 'MEMBER',
      },
    },
  };

  const mockEntities = {
    'entity-1': {
      id: 'entity-1',
      metadata: { name: 'Alice', username: 'alice' },
      names: ['Alice', 'alice123'],
    },
    'entity-2': {
      id: 'entity-2',
      metadata: { name: 'Bob', username: 'bob' },
      names: ['Bob', 'bob456'],
    },
    'entity-3': {
      id: 'entity-3',
      metadata: { name: 'Charlie', username: 'charlie' },
      names: ['Charlie', 'charlie789'],
    },
  };

  return createMockRuntime({
    getRoom: mock().mockResolvedValue({
      id: 'room-1',
      type: ChannelType.GROUP,
      serverId: 'server-1',
    }),
    getWorld: mock().mockResolvedValue(mockWorld),
    getEntityById: mock().mockImplementation(
      (id: string) => mockEntities[id as keyof typeof mockEntities]
    ),
  });
};

describe('roleProvider', () => {
  let runtime: IAgentRuntime;
  const testEntityId = 'entity-1' as UUID;

  beforeEach(() => {
    runtime = createProviderRolesMockRuntime();
    mock.restore();
  });

  it('should provide role information', async () => {
    const memory = createMockMemory('test', testEntityId);
    const state = { data: {} } as State;

    const result = await roleProvider.get(runtime, memory, state);

    expect(result).toBeDefined();
    expect(result.text).toContain('# Server Role Hierarchy');
    expect(result.text).toContain('## Owners');
    expect(result.text).toContain('Alice');
    expect(result.text).toContain('## Administrators');
    expect(result.text).toContain('Bob');
    expect(result.text).toContain('## Members');
    expect(result.text).toContain('Charlie');
  });

  it('should handle DM channels', async () => {
    (runtime.getRoom as Mock<any>).mockResolvedValue({
      id: 'room-1',
      type: ChannelType.DM,
      serverId: null,
    });

    const memory = createMockMemory('test', testEntityId);
    const state = { data: {} } as State;

    const result = await roleProvider.get(runtime, memory, state);

    expect(result.text).toContain('No access to role information in DMs');
  });

  it('should handle missing world data', async () => {
    (runtime.getWorld as Mock<any>).mockResolvedValue(null);

    const memory = createMockMemory('test', testEntityId);
    const state = { data: {} } as State;

    const result = await roleProvider.get(runtime, memory, state);

    expect(result.text).toContain('No role information available');
  });

  it('should handle empty roles', async () => {
    (runtime.getWorld as Mock<any>).mockResolvedValue({
      id: 'world-1',
      metadata: {
        ownership: { ownerId: 'owner-1' },
        roles: {},
      },
    });

    const memory = createMockMemory('test', testEntityId);
    const state = { data: {} } as State;

    const result = await roleProvider.get(runtime, memory, state);

    expect(result.values?.roles).toContain('No role information available');
  });
});
