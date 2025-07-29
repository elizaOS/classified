'use client';

import * as React from 'react';

interface Toast {
  id: string;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  variant?: 'default' | 'destructive';
}

interface ToastState {
  toasts: Toast[];
}

interface ToastAction {
  type: 'ADD_TOAST' | 'REMOVE_TOAST';
  toast?: Toast;
  id?: string;
}

const toastReducer = (state: ToastState, action: ToastAction): ToastState => {
  switch (action.type) {
    case 'ADD_TOAST':
      return {
        toasts: [...state.toasts, action.toast!],
      };
    case 'REMOVE_TOAST':
      return {
        toasts: state.toasts.filter((t) => t.id !== action.id),
      };
    default:
      return state;
  }
};

const ToastContext = React.createContext<{
  state: ToastState;
  dispatch: React.Dispatch<ToastAction>;
} | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = React.useReducer(toastReducer, { toasts: [] });

  return (
    <ToastContext.Provider value={{ state, dispatch }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);

  const toast = React.useCallback(
    (props: Omit<Toast, 'id'>) => {
      if (!context) {
        console.warn('useToast must be used within a ToastProvider');
        return;
      }

      const { dispatch } = context;
      const id = Date.now().toString();
      const toastData = { ...props, id };

      dispatch({ type: 'ADD_TOAST', toast: toastData });

      // Auto-dismiss after 5 seconds
      setTimeout(() => {
        dispatch({ type: 'REMOVE_TOAST', id });
      }, 5000);
    },
    [context],
  );

  const dismiss = React.useCallback(
    (id: string) => {
      if (!context) {
        console.warn('useToast must be used within a ToastProvider');
        return;
      }

      const { dispatch } = context;
      dispatch({ type: 'REMOVE_TOAST', id });
    },
    [context],
  );

  if (!context) {
    // Return a no-op implementation if context is not available
    return {
      toast,
      toasts: [],
      dismiss,
    };
  }

  const { state } = context;

  return {
    toast,
    toasts: state.toasts,
    dismiss,
  };
}
