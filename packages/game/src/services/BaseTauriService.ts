/**
 * Base Tauri Service
 * Provides common Tauri initialization and invocation functionality
 * All domain-specific services extend this base class
 */

import { v4 as uuidv4 } from 'uuid';
import { CONFIG } from '../config/constants';

export type TauriInvokeFunction = (
  command: string,
  args?: Record<string, unknown>
) => Promise<unknown>;
export type TauriListenFunction = <T>(
  event: string,
  handler: (event: { payload: T }) => void | Promise<void>
) => Promise<() => void>;

export abstract class BaseTauriService {
  protected tauriInvoke: TauriInvokeFunction | null = null;
  protected tauriListen: TauriListenFunction | null = null;
  protected isTauri: boolean = false;
  protected isInitialized: boolean = false;
  protected unlistenFns: Array<() => void> = [];
  protected userId: string;
  protected agentId: string = CONFIG.AGENT_ID;

  constructor() {
    this.userId = localStorage.getItem('game-user-id') || uuidv4();
    localStorage.setItem('game-user-id', this.userId);

    // Initialize Tauri functionality
    this.initializeTauri();
  }

  private async initializeTauri(): Promise<void> {
    try {
      // Try to import Tauri v2 APIs
      const { invoke } = await import('@tauri-apps/api/core');
      const { listen } = await import('@tauri-apps/api/event');

      // If imports succeed, we're in Tauri environment
      this.tauriInvoke = invoke;
      this.tauriListen = listen;
      this.isTauri = true;
      this.isInitialized = true;

      // Allow subclasses to set up their specific event listeners
      await this.setupEventListeners();
    } catch (_error) {
      // Import failed - not in Tauri environment
      this.isTauri = false;
      this.isInitialized = false;
    }
  }

  protected async setupEventListeners(): Promise<void> {
    // Override in subclasses to set up specific event listeners
  }

  protected async ensureInitializedAndInvoke(
    command: string,
    args?: Record<string, unknown>
  ): Promise<unknown> {
    if (!this.isInitialized && this.isTauri) {
      await this.initializeTauri();
    }

    if (!this.tauriInvoke) {
      throw new Error(
        'Tauri is not available. Please ensure you are running this application through Tauri.'
      );
    }

    return this.tauriInvoke(command, args);
  }

  public isRunningInTauri(): boolean {
    return this.isTauri;
  }

  public getInitializationStatus(): { isTauri: boolean; isInitialized: boolean } {
    return {
      isTauri: this.isTauri,
      isInitialized: this.isInitialized,
    };
  }

  public async ensureInitialized(): Promise<boolean> {
    if (!this.isInitialized && this.isTauri) {
      await this.initializeTauri();
    }
    return this.isInitialized;
  }

  public getUserId(): string {
    return this.userId;
  }

  public getAgentId(): string {
    return this.agentId;
  }

  public destroy(): void {
    // Clean up all event listeners
    this.unlistenFns.forEach((unlisten) => unlisten());
    this.unlistenFns = [];
  }
}
