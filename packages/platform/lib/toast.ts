import { toast as sonner } from 'sonner';

export type ToastMode =
  | 'default'
  | 'success'
  | 'undo'
  | 'error'
  | 'warning'
  | 'info';

export default function toast({
  message,
  mode = 'default',
  description,
  undoAction,
}: {
  message: string;
  mode?: ToastMode;
  description?: string;
  undoAction?: () => void;
}) {
  switch (mode) {
    case 'error': {
      sonner.error(message, {
        className: 'bg-error-fill border-error-stroke-weak text-error',
        description,
      });
      break;
    }
    case 'success': {
      sonner.success(message, {
        className: 'bg-success-fill border-success-stroke-weak text-success',
        description,
      });
      break;
    }
    case 'undo': {
      sonner.success(message, {
        className: 'bg-success-fill border-success-stroke-weak text-success',
        description,
        action: {
          label: 'Undo',
          onClick: () => {
            undoAction?.();
          },
        },
      });
      break;
    }
    case 'warning': {
      sonner.warning(message, {
        className: 'bg-light-yellow-bg border-yellow-bg-border text-warning',
        description,
      });
      break;
    }
    case 'info': {
      sonner.info(message, {
        className: 'bg-light-blue-bg border-blue-bg-border text-info',
        description,
      });
      break;
    }
    default: {
      sonner(message, {
        className: 'bg-fill border-stroke-weak text-typography-strong',
        description,
      });
      break;
    }
  }
}

export const dismissAll = () => sonner.dismiss();
