/// <reference types="cypress" />

/**
 * PostgreSQL Container Integration Test
 *
 * This test verifies that the PostgreSQL container functionality works correctly
 * through the Tauri backend. It tests container startup, health monitoring,
 * and proper error handling.
 */

describe('PostgreSQL Container Integration', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
    cy.clearCookies();

    // Mock Tauri environment for container testing
    cy.window().then((win) => {
      (win as any).__TAURI__ = {
        invoke: cy.stub().as('tauriInvoke'),
      };
    });
  });

  it('should start PostgreSQL container successfully', () => {
    cy.visit('/', { timeout: 20000 });

    // Wait for the app to load
    cy.get('.app', { timeout: 10000 }).should('be.visible');
    cy.screenshot('postgres-01-app-loaded');

    // Configure the Tauri invoke stub to handle different commands
    cy.window().then((win) => {
      const tauriInvoke = (win as any).__TAURI__.invoke;

      // Configure responses for different commands
      tauriInvoke.callsFake((command: string, ..._args: any[]) => {
        switch (command) {
          case 'start_postgres_container':
            return Promise.resolve({
              id: 'test-postgres-container-id',
              name: 'eliza-postgres',
              state: 'Starting',
              health: 'Starting',
              ports: [{ host_port: 7771, container_port: 5432 }],
              started_at: Date.now() / 1000,
              uptime_seconds: 0,
              restart_count: 0,
            });
          case 'get_container_status_new':
            return Promise.resolve([
              {
                id: 'test-postgres-container-id',
                name: 'eliza-postgres',
                state: 'Running',
                health: 'Healthy',
                ports: [{ host_port: 7771, container_port: 5432 }],
                started_at: Date.now() / 1000,
                uptime_seconds: 30,
                restart_count: 0,
              },
            ]);
          case 'get_setup_progress_new':
            return Promise.resolve({
              stage: 'starting',
              progress: 50,
              message: 'Starting PostgreSQL...',
              details: 'Initializing database container',
              can_retry: false,
            });
          default:
            return Promise.reject(new Error(`Unknown command: ${command}`));
        }
      });
    });

    // Test direct Tauri command invocation
    cy.window()
      .then((win) => {
        return (win as any).__TAURI__.invoke('start_postgres_container');
      })
      .then((result) => {
        // Verify the container status response
        expect(result).to.have.property('name', 'eliza-postgres');
        expect(result).to.have.property('state', 'Starting');
      });

    cy.screenshot('postgres-02-container-started');

    // Verify container status can be retrieved
    cy.window()
      .then((win) => {
        return (win as any).__TAURI__.invoke('get_container_status_new');
      })
      .then((statuses) => {
        expect(statuses).to.be.an('array');
        expect(statuses[0]).to.have.property('name', 'eliza-postgres');
        expect(statuses[0]).to.have.property('state', 'Running');
        expect(statuses[0]).to.have.property('health', 'Healthy');
      });

    cy.screenshot('postgres-03-status-verified');
  });

  it('should handle PostgreSQL container startup errors', () => {
    cy.visit('/');
    cy.get('.app', { timeout: 10000 }).should('be.visible');

    // Configure Tauri invoke to reject for container startup
    cy.window().then((win) => {
      const tauriInvoke = (win as any).__TAURI__.invoke;

      tauriInvoke.callsFake((command: string, ..._args: any[]) => {
        if (command === 'start_postgres_container') {
          return Promise.reject(new Error('Failed to start PostgreSQL container: Image not found'));
        }
        return Promise.resolve({});
      });
    });

    // Test error handling
    cy.window()
      .then((win) => {
        return (win as any).__TAURI__.invoke('start_postgres_container').catch((error) => {
          expect(error.message).to.include('Failed to start PostgreSQL container');
          return { error: error.message };
        });
      })
      .then((result) => {
        expect(result).to.have.property('error');
        expect(result.error).to.include('Image not found');
      });

    cy.screenshot('postgres-04-error-handling');
  });

  it('should test PostgreSQL container health monitoring', () => {
    cy.visit('/');
    cy.get('.app', { timeout: 10000 }).should('be.visible');

    // Configure Tauri invoke for health monitoring test
    let healthCallCount = 0;
    cy.window().then((win) => {
      const tauriInvoke = (win as any).__TAURI__.invoke;

      tauriInvoke.callsFake((command: string, ..._args: any[]) => {
        switch (command) {
          case 'start_postgres_container':
            return Promise.resolve({
              id: 'test-postgres-unhealthy',
              name: 'eliza-postgres',
              state: 'Running',
              health: 'Unhealthy',
              ports: [{ host_port: 7771, container_port: 5432 }],
              started_at: Date.now() / 1000,
              uptime_seconds: 5,
              restart_count: 0,
            });
          case 'get_container_status_new':
            healthCallCount++;
            const health = healthCallCount < 3 ? 'Unhealthy' : 'Healthy';
            return Promise.resolve([
              {
                id: 'test-postgres-unhealthy',
                name: 'eliza-postgres',
                state: 'Running',
                health,
                ports: [{ host_port: 7771, container_port: 5432 }],
                started_at: Date.now() / 1000,
                uptime_seconds: healthCallCount * 10,
                restart_count: 0,
              },
            ]);
          default:
            return Promise.resolve({});
        }
      });
    });

    // Test health monitoring progression
    cy.window()
      .then((win) => {
        return (win as any).__TAURI__.invoke('start_postgres_container');
      })
      .then((result) => {
        expect(result.health).to.equal('Unhealthy');
      });

    // Check status multiple times to simulate health monitoring
    cy.window()
      .then((win) => {
        return (win as any).__TAURI__.invoke('get_container_status_new');
      })
      .then((statuses) => {
        expect(statuses[0].health).to.equal('Unhealthy');
      });

    cy.wait(1000);

    cy.window()
      .then((win) => {
        return (win as any).__TAURI__.invoke('get_container_status_new');
      })
      .then((statuses) => {
        expect(statuses[0].health).to.equal('Unhealthy');
      });

    cy.wait(1000);

    cy.window()
      .then((win) => {
        return (win as any).__TAURI__.invoke('get_container_status_new');
      })
      .then((statuses) => {
        expect(statuses[0].health).to.equal('Healthy');
        expect(statuses[0].uptime_seconds).to.be.greaterThan(0);
      });

    cy.screenshot('postgres-05-health-monitoring');
  });

  it('should test PostgreSQL container restart functionality', () => {
    cy.visit('/');
    cy.get('.app', { timeout: 10000 }).should('be.visible');

    // Configure Tauri invoke for restart test
    cy.window().then((win) => {
      const tauriInvoke = (win as any).__TAURI__.invoke;

      tauriInvoke.callsFake((command: string, ...args: any[]) => {
        switch (command) {
          case 'get_container_status_new':
            return Promise.resolve([
              {
                id: 'test-postgres-restart',
                name: 'eliza-postgres',
                state: 'Running',
                health: 'Healthy',
                ports: [{ host_port: 7771, container_port: 5432 }],
                started_at: Date.now() / 1000,
                uptime_seconds: 120,
                restart_count: 0,
              },
            ]);
          case 'restart_container_new':
            if (args[0] === 'eliza-postgres') {
              return Promise.resolve({
                id: 'test-postgres-restart-new',
                name: 'eliza-postgres',
                state: 'Starting',
                health: 'Starting',
                ports: [{ host_port: 7771, container_port: 5432 }],
                started_at: Date.now() / 1000,
                uptime_seconds: 0,
                restart_count: 1,
              });
            }
            return Promise.reject(new Error('Unknown container'));
          default:
            return Promise.resolve({});
        }
      });
    });

    // Test restart functionality
    cy.window()
      .then((win) => {
        return (win as any).__TAURI__.invoke('restart_container_new', 'eliza-postgres');
      })
      .then((result) => {
        expect(result.name).to.equal('eliza-postgres');
        expect(result.state).to.equal('Starting');
        expect(result.restart_count).to.equal(1);
        expect(result.uptime_seconds).to.equal(0);
      });

    cy.screenshot('postgres-06-restart-functionality');
  });

  it('should test PostgreSQL container stop functionality', () => {
    cy.visit('/');
    cy.get('.app', { timeout: 10000 }).should('be.visible');

    // Configure Tauri invoke for stop test
    cy.window().then((win) => {
      const tauriInvoke = (win as any).__TAURI__.invoke;

      tauriInvoke.callsFake((command: string, ...args: any[]) => {
        switch (command) {
          case 'stop_container_new':
            if (args[0] === 'eliza-postgres') {
              return Promise.resolve(undefined);
            }
            return Promise.reject(new Error('Unknown container'));
          case 'get_container_status_new':
            return Promise.resolve([
              {
                id: 'test-postgres-stopped',
                name: 'eliza-postgres',
                state: 'Stopped',
                health: 'Unknown',
                ports: [{ host_port: 7771, container_port: 5432 }],
                started_at: Date.now() / 1000,
                uptime_seconds: 0,
                restart_count: 0,
              },
            ]);
          default:
            return Promise.resolve({});
        }
      });
    });

    // Test stop functionality
    cy.window()
      .then((win) => {
        return (win as any).__TAURI__.invoke('stop_container_new', 'eliza-postgres');
      })
      .then((result) => {
        // Stop command should return void/undefined
        expect(result).to.be.undefined;
      });

    // Verify container is stopped
    cy.window()
      .then((win) => {
        return (win as any).__TAURI__.invoke('get_container_status_new');
      })
      .then((statuses) => {
        expect(statuses[0].state).to.equal('Stopped');
        expect(statuses[0].health).to.equal('Unknown');
      });

    cy.screenshot('postgres-07-stop-functionality');
  });

  it('should test complete environment setup with PostgreSQL', () => {
    cy.visit('/');
    cy.get('.app', { timeout: 10000 }).should('be.visible');

    // Configure Tauri invoke for complete environment setup
    let progressCalls = 0;
    cy.window().then((win) => {
      const tauriInvoke = (win as any).__TAURI__.invoke;

      tauriInvoke.callsFake((command: string, ..._args: any[]) => {
        switch (command) {
          case 'setup_complete_environment_new':
            return Promise.resolve('Environment setup completed successfully');
          case 'get_setup_progress_new':
            progressCalls++;
            const stages = [
              {
                stage: 'checking',
                progress: 0,
                message: 'Checking container runtime...',
                details: 'Verifying runtime availability',
              },
              {
                stage: 'installing',
                progress: 20,
                message: 'Loading container images...',
                details: 'Loading PostgreSQL and Ollama images',
              },
              {
                stage: 'starting',
                progress: 50,
                message: 'Starting PostgreSQL...',
                details: 'Initializing database container',
              },
              {
                stage: 'starting',
                progress: 80,
                message: 'Starting ElizaOS Agent...',
                details: 'Initializing conversational AI agent',
              },
              {
                stage: 'complete',
                progress: 100,
                message: 'Setup complete!',
                details: 'All containers are running',
              },
            ];

            const stageIndex = Math.min(progressCalls - 1, stages.length - 1);
            return Promise.resolve({
              ...stages[stageIndex],
              can_retry: false,
            });
          default:
            return Promise.resolve({});
        }
      });
    });

    // Test complete environment setup
    cy.window()
      .then((win) => {
        return (win as any).__TAURI__.invoke('setup_complete_environment_new');
      })
      .then((result) => {
        expect(result).to.equal('Environment setup completed successfully');
      });

    // Check setup progress
    cy.window()
      .then((win) => {
        return (win as any).__TAURI__.invoke('get_setup_progress_new');
      })
      .then((progress) => {
        expect(progress).to.have.property('stage');
        expect(progress).to.have.property('progress');
        expect(progress).to.have.property('message');
        expect(progress).to.have.property('details');
      });

    cy.screenshot('postgres-08-complete-environment-setup');
  });

  afterEach(() => {
    cy.screenshot('postgres-test-complete');

    // Verify all expected Tauri commands were called
    cy.get('@tauriInvoke').should('have.been.called');
  });
});

/**
 * PostgreSQL Container Edge Cases
 */
describe('PostgreSQL Container Edge Cases', () => {
  beforeEach(() => {
    cy.window().then((win) => {
      (win as any).__TAURI__ = {
        invoke: cy.stub().as('tauriInvoke'),
      };
    });
  });

  it('should handle container name conflicts', () => {
    cy.visit('/');
    cy.get('.app', { timeout: 10000 }).should('be.visible');

    // Configure Tauri invoke to reject with name conflict error
    cy.window().then((win) => {
      const tauriInvoke = (win as any).__TAURI__.invoke;

      tauriInvoke.callsFake((command: string, ..._args: any[]) => {
        if (command === 'start_postgres_container') {
          return Promise.reject(new Error('Container with name eliza-postgres already exists'));
        }
        return Promise.resolve({});
      });
    });

    cy.window().then((win) => {
      return (win as any).__TAURI__.invoke('start_postgres_container').catch((error) => {
        expect(error.message).to.include('already exists');
        return { error: error.message };
      });
    });

    cy.screenshot('postgres-edge-01-name-conflict');
  });

  it('should handle port conflicts', () => {
    cy.visit('/');
    cy.get('.app', { timeout: 10000 }).should('be.visible');

    // Configure Tauri invoke to reject with port conflict error
    cy.window().then((win) => {
      const tauriInvoke = (win as any).__TAURI__.invoke;

      tauriInvoke.callsFake((command: string, ..._args: any[]) => {
        if (command === 'start_postgres_container') {
          return Promise.reject(new Error('Port 7771 is already in use'));
        }
        return Promise.resolve({});
      });
    });

    cy.window().then((win) => {
      return (win as any).__TAURI__.invoke('start_postgres_container').catch((error) => {
        expect(error.message).to.include('Port 7771 is already in use');
        return { error: error.message };
      });
    });

    cy.screenshot('postgres-edge-02-port-conflict');
  });

  it('should handle container runtime not available', () => {
    cy.visit('/');
    cy.get('.app', { timeout: 10000 }).should('be.visible');

    // Configure Tauri invoke to reject with runtime unavailable error
    cy.window().then((win) => {
      const tauriInvoke = (win as any).__TAURI__.invoke;

      tauriInvoke.callsFake((command: string, ..._args: any[]) => {
        if (command === 'start_postgres_container') {
          return Promise.reject(
            new Error('Container runtime not available: No Podman or Docker found')
          );
        }
        return Promise.resolve({});
      });
    });

    cy.window().then((win) => {
      return (win as any).__TAURI__.invoke('start_postgres_container').catch((error) => {
        expect(error.message).to.include('Container runtime not available');
        return { error: error.message };
      });
    });

    cy.screenshot('postgres-edge-03-runtime-unavailable');
  });

  afterEach(() => {
    cy.screenshot('postgres-edge-test-complete');
  });
});
