'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import Header from '@/components/ui/header';
import Sidebar from '@/components/ui/sidebar';
import { AccountDeletionModal, UserMenu } from '@/components/dashboard';
import { handleLogout, handleRestoreUser } from './actions';
import { getErrorMessage, getResponseMessage } from '@/messages';
import toast from '@/lib/toast';
import Modal from '@/components/ui/modal';
import Button from '@/components/ui/button';

export default function Layout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [accountDeleted, setAccountDeleted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleUserLogout = async () => {
    await handleLogout();
  };

  async function handleRestore() {
    setLoading(true);

    await handleRestoreUser()
      .then((resp: any) => {
        console.log(resp.error);
        if (resp?.error) {
          console.log(resp?.code);
          toast({
            message: getErrorMessage(resp.code),
            mode: 'error',
          });
        } else {
          setUser(resp?.data?.user);
          setAccountDeleted(Boolean(resp.data?.deleted_at));
          toast({
            message: getResponseMessage('user_restored'),
            mode: 'success',
          });
        }
      })
      .catch((err: any) => {
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
      })
      .finally(() => {
        setLoading(false);
      });
  }

  useEffect(() => {
    axios
      .get(`${process.env.NEXT_PUBLIC_API_URL}/auth/identity`, {
        withCredentials: true,
      })
      .then((res: any) => {
        setUser(res.data);
        setAccountDeleted(Boolean(res.data?.deleted_at));
      })
      .catch((err: any) => {
        if (err.response.data.code === 'session_expired') {
          toast({
            message: getErrorMessage('session_expired'),
            mode: 'error',
          });

          router.push('/auth/login');
        }
      });
  }, [router]);

  return (
    <div className="flex h-screen w-full bg-background">
      {/* Skip Link for Accessibility */}
      <a href="#main-content" className="skip-link" data-cy="skip-link">
        Skip to main content
      </a>

      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <Header>
          <UserMenu
            sidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            onLogout={handleUserLogout}
          />
        </Header>

        {/* Main Content Area */}
        <main
          id="main-content"
          className="flex-1 overflow-y-auto bg-background"
          role="main"
          aria-label="Main content"
        >
          <div className="h-full px-4 py-6 md:px-6 md:py-8">{children}</div>
        </main>
      </div>

      {/* Account Deletion Modal */}
      {accountDeleted && (
        <Modal
          title="Your account has been deleted."
          open={accountDeleted}
          onClose={() => {}}
          canClose={!accountDeleted}
        >
          <div className="flex flex-col gap-6 py-2">
            <p>
              A deletion request was initiated on{' '}
              {user?.deleted_at ? (
                <b>{new Date(user.deleted_at).toLocaleString()}.</b>
              ) : (
                ''
              )}
            </p>
            <p>
              If no further action is taken, your account will be permanently
              deleted on{' '}
              <b>
                {new Date(
                  user?.deleted_at
                    ? new Date(user.deleted_at).getTime() +
                      30 * 24 * 60 * 60 * 1000
                    : Date.now(),
                ).toLocaleString()}
              </b>
              .
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
            >
              {loading ? 'Restoring Account...' : 'Restore Account'}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
