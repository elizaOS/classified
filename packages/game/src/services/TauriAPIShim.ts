/**
 * Tauri API Shim
 * Provides a fallback implementation when @tauri-apps/api is not available
 * Uses the window.__TAURI_INTERNALS__ directly
 */

declare global {
  interface Window {
    __TAURI_INTERNALS__: any;
    isTauri: boolean;
  }
}

// Fallback invoke function using window.__TAURI_INTERNALS__
export async function invoke(cmd: string, args?: Record<string, any>): Promise<any> {
  if (window.__TAURI_INTERNALS__?.invoke) {
    return window.__TAURI_INTERNALS__.invoke(cmd, args);
  }

  // Try alternative paths
  if (window.__TAURI_INTERNALS__?.core?.invoke) {
    return window.__TAURI_INTERNALS__.core.invoke(cmd, args);
  }

  // Try the postMessage API for Tauri v2
  if (window.__TAURI_INTERNALS__?.postMessage) {
    return new Promise((resolve, reject) => {
      const id = Math.random().toString(36).substring(7);

      // Listen for response
      const handler = (event: MessageEvent) => {
        if (event.data?.id === id) {
          window.removeEventListener('message', handler);
          if (event.data.error) {
            reject(new Error(event.data.error));
          } else {
            resolve(event.data.result);
          }
        }
      };

      window.addEventListener('message', handler);

      // Send command
      window.__TAURI_INTERNALS__.postMessage({
        id,
        cmd,
        args: args || {}
      });
    });
  }

  throw new Error('Tauri invoke API not available');
}

// Fallback event listener
export async function listen<T>(event: string, handler: (event: { payload: T }) => void): Promise<() => void> {
  if (window.__TAURI_INTERNALS__?.event?.listen) {
    return window.__TAURI_INTERNALS__.event.listen(event, handler);
  }

  if (window.__TAURI_INTERNALS__?.listen) {
    return window.__TAURI_INTERNALS__.listen(event, handler);
  }

  // Fallback: use custom event system
  const eventHandler = (e: CustomEvent) => {
    handler({ payload: e.detail });
  };

  window.addEventListener(`tauri:${event}`, eventHandler as any);

  return () => {
    window.removeEventListener(`tauri:${event}`, eventHandler as any);
  };
}

// Fallback event emitter
export async function emit(event: string, payload?: any): Promise<void> {
  if (window.__TAURI_INTERNALS__?.event?.emit) {
    return window.__TAURI_INTERNALS__.event.emit(event, payload);
  }

  if (window.__TAURI_INTERNALS__?.emit) {
    return window.__TAURI_INTERNALS__.emit(event, payload);
  }

  // Fallback: use custom event system
  window.dispatchEvent(new CustomEvent(`tauri:${event}`, { detail: payload }));
}

// Check if running in Tauri
export function checkTauriAvailable(): boolean {
  return !!(window.__TAURI_INTERNALS__ || window.isTauri);
}
