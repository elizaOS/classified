import {
  describe,
  expect,
  it,
  mock,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
  spyOn,
} from 'bun:test';
import { StagehandService, BrowserSession } from '../index';
import { logger } from '@elizaos/core';
import { Stagehand } from '@browserbasehq/stagehand';
import { createMockRuntime } from './test-utils';

// Mock the Stagehand module
mock.module('@browserbasehq/stagehand', () => {
  return {
    Stagehand: mock().mockImplementation(() => {
      const mockPage = {
        goto: mock().mockResolvedValue(undefined),
        goBack: mock().mockResolvedValue(undefined),
        goForward: mock().mockResolvedValue(undefined),
        reload: mock().mockResolvedValue(undefined),
        waitForLoadState: mock().mockResolvedValue(undefined),
        title: mock().mockResolvedValue('Test Page Title'),
        url: mock().mockReturnValue('https://example.com'),
      };

      return {
        init: mock().mockResolvedValue(undefined),
        close: mock().mockResolvedValue(undefined),
        page: mockPage,
      };
    }),
  };
});

// Mock logger
beforeAll(() => {
  spyOn(logger, 'info').mockImplementation(() => {});
  spyOn(logger, 'error').mockImplementation(() => {});
  spyOn(logger, 'debug').mockImplementation(() => {});
  spyOn(logger, 'warn').mockImplementation(() => {});
});

afterAll(() => {
  mock.restore();
});

describe('BrowserSession', () => {
  it('should create a browser session with correct properties', () => {
    const mockStagehand = new Stagehand({ env: 'LOCAL' } as any);
    const session = new BrowserSession('test-session-1', mockStagehand as any);

    expect(session.id).toBe('test-session-1');
    expect(session.stagehand).toBe(mockStagehand);
    expect(session.createdAt).toBeInstanceOf(Date);
  });

  it('should provide access to page through getter', () => {
    const mockStagehand = new Stagehand({ env: 'LOCAL' } as any);
    const session = new BrowserSession('test-session-1', mockStagehand as any);

    expect(session.page).toBe(mockStagehand.page);
  });

  it('should destroy session and close stagehand', async () => {
    const mockStagehand = new Stagehand({ env: 'LOCAL' } as any);
    const session = new BrowserSession('test-session-1', mockStagehand as any);

    await session.destroy();

    expect(mockStagehand.close).toHaveBeenCalled();
  });

  it('should handle errors during destroy gracefully', async () => {
    const mockStagehand = new Stagehand({ env: 'LOCAL' } as any);
    (mockStagehand.close as any).mockRejectedValueOnce(new Error('Close failed'));

    const session = new BrowserSession('test-session-1', mockStagehand as any);

    // Should not throw
    await expect(session.destroy()).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      'Error destroying browser session:',
      expect.any(Error)
    );
  });
});

describe('StagehandService', () => {
  let mockRuntime: any;
  let service: StagehandService;

  beforeEach(() => {
    // Reset mocks
    mock.restore();

    // Create mock runtime
    mockRuntime = createMockRuntime({
      getService: mock(),
      character: {
        name: 'Test Agent',
        bio: ['Test agent for Stagehand browser automation'],
      },
    });

    // Create service
    service = new StagehandService(mockRuntime);
  });

  afterEach(async () => {
    // Clean up any sessions
    await service.stop();
  });

  describe('start and stop', () => {
    it('should start the service', async () => {
      const startedService = await StagehandService.start(mockRuntime);

      expect(startedService).toBeInstanceOf(StagehandService);
      expect(logger.info).toHaveBeenCalledWith('Starting Stagehand browser automation service');
    });

    it('should stop the service', async () => {
      mockRuntime.getService.mockReturnValue(service);

      await StagehandService.stop(mockRuntime);

      expect(logger.info).toHaveBeenCalledWith('Stopping Stagehand browser automation service');
      expect(logger.info).toHaveBeenCalledWith('Cleaning up browser sessions');
    });

    it('should throw error if service not found when stopping', async () => {
      mockRuntime.getService.mockReturnValue(null);

      await expect(StagehandService.stop(mockRuntime)).rejects.toThrow(
        'Stagehand service not found'
      );
    });

    it('should clean up all sessions when stopping', async () => {
      // Create some sessions
      const session1 = await service.createSession('session-1');
      const session2 = await service.createSession('session-2');

      await service.stop();

      // Verify sessions were destroyed
      expect(session1.stagehand.close).toHaveBeenCalled();
      expect(session2.stagehand.close).toHaveBeenCalled();

      // Verify sessions were removed
      expect(await service.getSession('session-1')).toBeUndefined();
      expect(await service.getSession('session-2')).toBeUndefined();
    });
  });

  describe('createSession', () => {
    it('should create a new browser session', async () => {
      const session = await service.createSession('test-session');

      expect(session).toBeInstanceOf(BrowserSession);
      expect(session.id).toBe('test-session');
      expect(await service.getSession('test-session')).toBe(session);
      expect(await service.getCurrentSession()).toBe(session);
    });

    it('should initialize Stagehand with LOCAL env when no API key', async () => {
      delete process.env.BROWSERBASE_API_KEY;

      await service.createSession('test-session');

      expect(Stagehand).toHaveBeenCalledWith(
        expect.objectContaining({
          env: 'LOCAL',
          headless: true,
        })
      );
    });

    it('should initialize Stagehand with BROWSERBASE env when API key present', async () => {
      process.env.BROWSERBASE_API_KEY = 'test-api-key';
      process.env.BROWSERBASE_PROJECT_ID = 'test-project-id';

      await service.createSession('test-session');

      expect(Stagehand).toHaveBeenCalledWith(
        expect.objectContaining({
          env: 'BROWSERBASE',
          apiKey: 'test-api-key',
          projectId: 'test-project-id',
          browserbaseSessionCreateParams: expect.objectContaining({
            projectId: 'test-project-id',
          }),
        })
      );
    });

    it('should respect BROWSER_HEADLESS setting', async () => {
      process.env.BROWSER_HEADLESS = 'false';

      await service.createSession('test-session');

      expect(Stagehand).toHaveBeenCalledWith(
        expect.objectContaining({
          headless: false,
        })
      );

      // Cleanup
      delete process.env.BROWSER_HEADLESS;
    });

    it('should enforce max sessions limit', async () => {
      // Create max sessions
      await service.createSession('session-1');
      await service.createSession('session-2');
      await service.createSession('session-3');

      // Create one more - should remove oldest
      await service.createSession('session-4');

      // Session 1 should be removed
      expect(await service.getSession('session-1')).toBeUndefined();
      // Others should still exist
      expect(await service.getSession('session-2')).toBeDefined();
      expect(await service.getSession('session-3')).toBeDefined();
      expect(await service.getSession('session-4')).toBeDefined();
    });
  });

  describe('getSession', () => {
    it('should return existing session', async () => {
      const session = await service.createSession('test-session');
      const retrieved = await service.getSession('test-session');

      expect(retrieved).toBe(session);
    });

    it('should return undefined for non-existent session', async () => {
      const retrieved = await service.getSession('non-existent');

      expect(retrieved).toBeUndefined();
    });
  });

  describe('getCurrentSession', () => {
    it('should return current session', async () => {
      const session = await service.createSession('test-session');
      const current = await service.getCurrentSession();

      expect(current).toBe(session);
    });

    it('should return undefined if no current session', async () => {
      const current = await service.getCurrentSession();

      expect(current).toBeUndefined();
    });

    it('should update current session when creating new one', async () => {
      const session1 = await service.createSession('session-1');
      expect(await service.getCurrentSession()).toBe(session1);

      const session2 = await service.createSession('session-2');
      expect(await service.getCurrentSession()).toBe(session2);
    });
  });

  describe('destroySession', () => {
    it('should destroy existing session', async () => {
      const session = await service.createSession('test-session');

      await service.destroySession('test-session');

      expect(session.stagehand.close).toHaveBeenCalled();
      expect(await service.getSession('test-session')).toBeUndefined();
    });

    it('should clear current session if destroying current', async () => {
      await service.createSession('test-session');
      expect(await service.getCurrentSession()).toBeDefined();

      await service.destroySession('test-session');

      expect(await service.getCurrentSession()).toBeUndefined();
    });

    it('should handle destroying non-existent session', async () => {
      // Should not throw
      await expect(service.destroySession('non-existent')).resolves.toBeUndefined();
    });

    it('should not clear current session if destroying different session', async () => {
      const session1 = await service.createSession('session-1');
      const session2 = await service.createSession('session-2');

      // session-2 is current
      expect(await service.getCurrentSession()).toBe(session2);

      // Destroy session-1
      await service.destroySession('session-1');

      // session-2 should still be current
      expect(await service.getCurrentSession()).toBe(session2);
    });
  });

  describe('service metadata', () => {
    it('should have correct service type', () => {
      expect(StagehandService.serviceType).toBe('stagehand');
    });

    it('should have correct capability description', () => {
      expect(service.capabilityDescription).toBe(
        'Browser automation service using Stagehand for web interactions'
      );
    });
  });
});
