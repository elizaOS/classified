import { Dialog, DialogPanel, DialogBackdrop } from '@headlessui/react';
import { Cross1Icon } from '@radix-ui/react-icons';
import Button from '@/components/ui/button';

export default function Modal({
  open = false,
  setOpen = () => {},
  children,
  onClose = () => {},
  title,
  hint,
  canClose = true,
  showCloseButton = true,
}: {
  open?: boolean;
  setOpen?: (open: boolean) => void;
  children?: React.ReactNode;
  onClose?: () => void;
  title?: string;
  hint?: React.ReactNode;
  canClose?: boolean;
  showCloseButton?: boolean;
}) {
  const handleClose = () => {
    onClose();
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onClose={canClose ? (value: boolean) => handleClose() : () => {}}
      className="relative z-50"
    >
      <DialogBackdrop
        className="fixed inset-0 bg-black/40"
        onClick={canClose ? handleClose : () => {}}
      />
      <div className="fixed inset-0 flex w-screen items-center justify-center p-4">
        <DialogPanel className="max-w-lg space-y-4 rounded-md border border-stroke-weak bg-background p-8">
          {hint && hint}
          {title ? (
            <div className="flex justify-between">
              <h3 className="text-lg font-bold text-typography-strong">
                {title}
              </h3>
              {canClose && showCloseButton && (
                <Button
                  handleClick={handleClose}
                  className="transition-effect hover:opacity-80"
                  variant="unstyled"
                >
                  <Cross1Icon />
                </Button>
              )}
            </div>
          ) : null}{' '}
          {children}
        </DialogPanel>
      </div>
    </Dialog>
  );
}
