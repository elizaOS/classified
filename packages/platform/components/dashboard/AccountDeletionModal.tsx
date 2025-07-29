'use client';

import { useState } from 'react';
import Modal from '@/components/ui/modal';
import Button from '@/components/ui/button';
import { getResponseMessage, getErrorMessage } from '@/messages';
import toast from '@/lib/toast';

interface AccountDeletionModalProps {
  isOpen: boolean;
  user?: {
    name?: string;
    deleted_at?: string | Date;
  };
  onRestore: () => Promise<any>;
}

export function AccountDeletionModal({
  isOpen,
  user,
  onRestore,
}: AccountDeletionModalProps) {
  const [loading, setLoading] = useState(false);

  const handleRestore = async () => {
    setLoading(true);

    try {
      const resp = await onRestore();

      if (resp?.error) {
        toast({
          message: getErrorMessage(resp.code),
          mode: 'error',
        });
      } else {
        toast({
          message: getResponseMessage('user_restored'),
          mode: 'success',
        });
      }
    } catch (err: any) {
      if (err.code) {
        toast({
          message: getErrorMessage(err.code),
          mode: 'error',
        });
      } else {
        toast({
          message: getErrorMessage('internal_server_error'),
          mode: 'error',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const deletionDate = user?.deleted_at
    ? new Date(user.deleted_at).toLocaleString()
    : '';

  const permanentDeletionDate = user?.deleted_at
    ? new Date(
        new Date(user.deleted_at).getTime() + 30 * 24 * 60 * 60 * 1000,
      ).toLocaleString()
    : '';

  return (
    <Modal
      title="Your account has been deleted."
      open={isOpen}
      onClose={() => {}}
      canClose={false}
    >
      <div className="flex flex-col gap-6 py-2">
        <p>
          A deletion request was initiated on{' '}
          {deletionDate && <b>{deletionDate}.</b>}
        </p>

        <p>
          If no further action is taken, your account will be permanently
          deleted on <b>{permanentDeletionDate}</b>.
        </p>

        <p>
          If this was not you, please contact support immediately. After
          permanent deletion, any data associated with your account will no
          longer be recoverable.
        </p>

        <Button
          disabled={loading}
          className="w-full"
          handleClick={handleRestore}
          data-cy="restore-account-button"
        >
          {loading ? 'Restoring Account...' : 'Restore Account'}
        </Button>
      </div>
    </Modal>
  );
}
