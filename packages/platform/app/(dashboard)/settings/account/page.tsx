'use client';

import Input from '@/components/ui/input';
import SettingsBox from '@/components/ui/settings-box';
import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import {
  ApiError as _ApiError,
  ApiResponse as _ApiResponse,
  User,
} from '@/types';
import Spinner from '@/components/ui/spinner';
import {
  resendUpdateEmailConfirmation,
  updateUser,
  updateUserEmail,
  verifyPassword,
  uploadAvatar,
  deleteAvatar,
  changePassword,
  deleteSessions,
} from './actions';
import Button from '@/components/ui/button';
import toast from '@/lib/toast';
import Modal from '@/components/ui/modal';
import AvatarUploader from '@/components/ui/avatar-uploader';
import Link from 'next/link';
import { isValidPassword } from '@/lib/validation';
import { useSearchParams } from 'next/navigation';
import { getErrorMessage, getResponseMessage } from '@/messages';
import { useRouter } from 'next/navigation';
import { Suspense } from 'react';

const apiUrl = process.env.NEXT_PUBLIC_API_URL;

function AccountSettingsContent() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [avatar, setAvatar] = useState<File | undefined>(undefined);
  const [editingEmail, setEditingEmail] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordVerifyLoading, setPasswordVerifyLoading] = useState(false);
  const [canUpdateEmail, setCanUpdateEmail] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const emailForm = useRef<HTMLFormElement>(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const [userValues, setUserValues] = useState<{
    firstName?: { initial: string; current: string };
    lastName?: { initial: string; current: string };
    email?: { initial: string; current: string };
    updatedEmail?: string;
    avatar?: { initial: string; current: string };
  }>({});

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmedNewPassword, setConfirmedNewPassword] = useState('');

  const searchParams = useSearchParams();
  const message = searchParams.get('message');

  const router = useRouter();

  const getUser = useCallback(async () => {
    const user = await axios
      .get(`${apiUrl}/auth/identity`, {
        withCredentials: true,
      })
      .then((response) => {
        return response.data;
      })
      .catch((error) => console.error(error));

    setUser({
      id: user?.id,
      firstName: user?.first_name,
      lastName: user?.last_name,
      email: user?.email,
      avatarUrl: user?.avatar_url,
      isAdmin: user?.is_admin,
    });

    setUserValues({
      firstName: { initial: user?.first_name, current: user?.first_name },
      lastName: { initial: user?.last_name, current: user?.last_name },
      email: { initial: user?.email, current: user?.email },
      updatedEmail: user?.updated_email,
      avatar: { initial: user?.avatar_url, current: user?.avatar_url },
    });
  }, []);

  useEffect(() => {
    setIsLoading(true);
    getUser().then(() => {
      setIsLoading(false);
    });
  }, [getUser]);

  useEffect(() => {
    if (!editingEmail) {
      setUserValues((prev) => ({
        ...prev,
        email: {
          initial: prev.email?.initial || '',
          current: prev.email?.initial || '',
        },
      }));
    }
  }, [editingEmail]);

  useEffect(() => {
    if (message) {
      toast({
        message: getResponseMessage(message),
        mode: 'success',
      });

      // Remove message query param
      const url = new URL(window.location.href);
      url.searchParams.delete('message');
      window.history.replaceState({}, '', url);
    }
  }, [message]);

  async function updateEmail() {
    try {
      const res = await updateUserEmail({
        user,
        email: userValues.email?.current || '',
      }).then((res) => res);

      console.log(res);

      if (res.error) {
        setUserValues((prev) => ({
          ...prev,
          email: {
            initial: prev.email?.initial || '',
            current: prev.email?.initial || '',
          },
        }));

        toast({
          message: getErrorMessage(res.code) || 'Something went wrong',
          mode: 'error',
        });
        return;
      }

      setCanUpdateEmail(false);

      setUserValues((prev) => ({
        ...prev,
        updatedEmail: res.data.updated_email || '',
        email: {
          initial: res.data.email || '',
          current: res.data.email || '',
        },
      }));

      toast({
        message: 'Email updated',
        description: 'Please check your email for a confirmation link.',
        mode: 'success',
      });
    } catch (error) {
      console.error('Error updating email:', error);
      setCanUpdateEmail(false);
      toast({
        message: 'Something went wrong',
        mode: 'error',
      });
    }
  }

  if (isLoading) {
    return <Spinner />;
  }

  return (
    <>
      <SettingsBox
        title="Your Name"
        description="This will be your display name in the dashboard."
        note="Max 32 characters."
        onSettingSubmit={async () => {
          await updateUser({
            user,
            firstName: userValues.firstName?.current,
            lastName: userValues.lastName?.current,
          });

          setUserValues((prev) => ({
            ...prev,
            firstName: {
              initial: prev.firstName?.current || '',
              current: prev.firstName?.current || '',
            },
            lastName: {
              initial: prev.lastName?.current || '',
              current: prev.lastName?.current || '',
            },
          }));

          toast({
            message: 'Profile updated',
            mode: 'success',
          });
        }}
        disabled={
          userValues.firstName?.initial === userValues.firstName?.current &&
          userValues.lastName?.initial === userValues.lastName?.current
        }
      >
        <div className="flex gap-4">
          <Input
            type="text"
            placeholder="First Name"
            value={userValues.firstName?.current}
            handleChange={(e) =>
              setUserValues((prev) => ({
                ...prev,
                firstName: {
                  initial: prev.firstName?.initial || '',
                  current: e.target.value,
                },
              }))
            }
          />
          <Input
            type="text"
            placeholder="Last Name"
            value={userValues.lastName?.current}
            handleChange={(e) =>
              setUserValues((prev) => ({
                ...prev,
                lastName: {
                  initial: prev.lastName?.initial || '',
                  current: e.target.value,
                },
              }))
            }
          />
        </div>
      </SettingsBox>
      <SettingsBox
        title="Your Email"
        description="This will be the email you use to log in to your dashboard and receive notifications."
        ref={emailForm}
        onSettingSubmit={async () => {
          if (canUpdateEmail) {
            await updateEmail();
          } else {
            if (editingEmail) {
              setEditingEmail(false);
            } else {
              setEditingEmail(true);
            }
          }
        }}
        note={
          userValues.updatedEmail &&
          userValues.email?.initial !== userValues.updatedEmail ? (
            <span className="text-sm">
              To update your email, click the confirmation link we sent to{' '}
              <strong>{userValues.updatedEmail}</strong>.{' '}
              <Button
                className="underline"
                variant="link"
                handleClick={() =>
                  resendUpdateEmailConfirmation({ user }).then((res: any) => {
                    console.log(res);
                    toast({
                      message: 'Email sent',
                      description:
                        'Please check your email for a confirmation link.',
                      mode: 'success',
                    });
                  })
                }
              >
                Resend
              </Button>
            </span>
          ) : (
            "Email changes require verification. You'll be logged out of all devices after confirming."
          )
        }
        disabled={
          userValues.email?.initial === userValues.email?.current ||
          userValues.email?.current === userValues.updatedEmail
        }
      >
        <Modal
          title="Confirm your password"
          open={editingEmail}
          setOpen={setEditingEmail}
          onClose={() => {
            setEditingEmail(false);
            setPassword('');
          }}
        >
          <p className="text-sm">
            Before you can update your email, please type in your password.
          </p>
          <form
            className="flex flex-col gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setPasswordVerifyLoading(true);

              try {
                const res = await verifyPassword({
                  password: password || '',
                });

                if (res.error) {
                  setPassword('');
                  toast({ message: 'Invalid password', mode: 'error' });
                  setCanUpdateEmail(false);
                  return;
                }

                setEditingEmail(false);
                setPassword('');
                setCanUpdateEmail(true);

                await updateEmail();
              } catch (error) {
                console.log(error);
                setPassword('');
                toast({
                  message: 'An error occurred verifying your password',
                  mode: 'error',
                });
              } finally {
                setPasswordVerifyLoading(false);
              }
            }}
          >
            <Input
              type="password"
              placeholder="Enter your password"
              value={password}
              handleChange={(e) => setPassword(e.target.value)}
            />
            <Button
              type="submit"
              className="w-full"
              disabled={password.length === 0 || passwordVerifyLoading}
              loading={passwordVerifyLoading}
            >
              Confirm
            </Button>
          </form>
        </Modal>
        <Input
          type="email"
          placeholder="Email"
          value={userValues.email?.current}
          handleChange={(e) =>
            setUserValues((prev) => ({
              ...prev,
              email: {
                initial: prev.email?.initial || '',
                current: e.target.value,
              },
            }))
          }
        />
      </SettingsBox>
      <SettingsBox
        title="Change Password"
        description="Passwords must be 8+ characters with at least one uppercase,
                lowercase, number, and symbol characters."
        onSettingSubmit={async () => {
          if (currentPassword === newPassword) {
            // validate not the same
            toast({
              message:
                'New password cannot be the same as the current password.',
              mode: 'error',
            });
            return;
          }

          // validate password strength
          if (newPassword.length < 8) {
            toast({
              message: 'Password must be at least 8 characters.',
              mode: 'error',
            });
            return;
          }

          if (!isValidPassword(newPassword)) {
            toast({
              message:
                'Password must be at least 8 characters with at least one uppercase, lowercase, number, and symbol characters.',
              mode: 'error',
            });
            return;
          }

          if (newPassword !== confirmedNewPassword) {
            toast({
              message: 'Passwords do not match.',
              mode: 'error',
            });
            return;
          }

          try {
            const res = await changePassword({
              oldPassword: currentPassword,
              newPassword,
              confirmNewPassword: confirmedNewPassword,
            }).then((r) => r);

            console.log(res.code);

            if (res.error) {
              toast({
                message: getErrorMessage(res.code) || 'Cannot update password',
                mode: 'error',
              });
              return;
            }

            toast({
              message:
                'Password updated successfully. You will now be securely logged out.',
              mode: 'success',
            });

            router.push('/auth/login');

            setCurrentPassword('');
            setNewPassword('');
            setConfirmedNewPassword('');
          } catch (err) {
            console.error('Error changing password:', err);
            toast({
              message: 'An error occurred while updating password',
              mode: 'error',
            });
          }
        }}
        note={
          <>
            <p>
              <span>
                For security purposes, password changes will log you out of all
                devices.
              </span>
              <span>
                {' '}
                <Link href="/auth/forgot-password">Forgot Password?</Link>
              </span>
            </p>
          </>
        }
        disabled={
          currentPassword.length === 0 ||
          newPassword.length === 0 ||
          confirmedNewPassword.length === 0
        }
      >
        <Input
          type="password"
          placeholder="Current Password"
          value={currentPassword}
          handleChange={(e) => setCurrentPassword(e.target.value)}
        />
        <Input
          type="password"
          placeholder="New Password"
          value={newPassword}
          handleChange={(e) => setNewPassword(e.target.value)}
        />
        <Input
          type="password"
          placeholder="Confirm New Password"
          value={confirmedNewPassword}
          handleChange={(e) => setConfirmedNewPassword(e.target.value)}
        />
      </SettingsBox>
      <SettingsBox
        title="Your Avatar"
        description="This is your avatar in the dashboard."
        onSettingSubmit={async () => {
          const formData = new FormData();
          formData.append('avatar', avatar || '');
          await uploadAvatar({ user, formData })
            .then((res) => {
              console.log(res);
              toast({
                message: 'Avatar updated.',
                mode: 'success',
              });
              setUserValues((prev) => ({
                ...prev,
                avatar: {
                  initial: res.location,
                  current: res.location,
                },
              }));
            })
            .catch((error) => {
              console.error(error);
              toast({
                message:
                  'There was a problem updating your avatar. Please try again.',
                mode: 'error',
              });
            });
        }}
        disabled={
          !avatar || userValues.avatar?.initial === userValues.avatar?.current
        }
        note="Square image recommended. Accepted file types: .png, .jpg. Max file size: 2MB."
      >
        <div className="flex pt-2">
          <AvatarUploader
            handleChange={(e) => {
              setAvatar(e);
              setUserValues((prev) => ({
                ...prev,
                avatar: {
                  initial: prev.avatar?.initial || '',
                  current: URL.createObjectURL(e),
                },
              }));
            }}
            initialAvatar={userValues.avatar?.initial || ''}
            handleDelete={async () => {
              if (userValues.avatar?.initial) {
                await deleteAvatar()
                  .then((res) => {
                    if (res === null) {
                      toast({ message: 'Avatar deleted.', mode: 'success' });

                      setUserValues((prev) => ({
                        ...prev,
                        avatar: {
                          initial: '',
                          current: '',
                        },
                      }));
                    } else {
                      toast({
                        message: 'There was a problem deleting your avatar.',
                        mode: 'error',
                      });
                    }
                  })
                  .catch((_err) => {
                    toast({
                      message: 'There was a problem deleting your avatar.',
                      mode: 'error',
                    });
                  });
              } else {
                setUserValues((prev) => ({
                  ...prev,
                  avatar: {
                    initial: '',
                    current: '',
                  },
                }));
              }
            }}
          />
        </div>
      </SettingsBox>
      <SettingsBox
        title="Session Management"
        description="Manage your active sessions and devices."
        note=""
        onSettingSubmit={async () => {}}
        disabled={false}
        showSubmitButton={false}
      >
        <Modal
          title="Log out of all devices"
          open={showLogoutModal}
          setOpen={setShowLogoutModal}
          onClose={() => {}}
          canClose={true}
          showCloseButton={false}
        >
          <div className="flex flex-col items-start justify-between gap-4">
            <p>Are you sure you want to log out of all devices?</p>

            <div className="flex w-full justify-end gap-4 pt-4">
              <Button
                variant="unstyled"
                className="btn btn-secondary bg-gray text-typography-strong"
                handleClick={() => setShowLogoutModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                handleClick={async () => {
                  await deleteSessions().then((res) => {
                    setShowLogoutModal(false);

                    console.log(res);

                    toast({
                      message: 'Logged out of all devices.',
                      mode: 'success',
                    });

                    router.push('/auth/login');
                  });
                }}
              >
                Log out
              </Button>
            </div>
          </div>
        </Modal>
        <div className="flex items-center justify-between gap-4 py-4">
          <p>Log out of all devices</p>
          <Button
            handleClick={async () => {
              setShowLogoutModal(true);
            }}
          >
            Log out
          </Button>
        </div>
      </SettingsBox>
      <SettingsBox
        submitText="Delete Account"
        disabled={false}
        variant="destructive"
        title="Delete Account"
        description="Permanently delete your account and all associated data. This action cannot be undone - please proceed with caution."
        onSettingSubmit={async () => {
          setShowDeleteModal(true);
        }}
      >
        <Modal
          title="Confirm Delete"
          hint={
            <span className="text-sm font-bold uppercase text-error">
              Danger Zone
            </span>
          }
          open={showDeleteModal}
          setOpen={setShowDeleteModal}
          onClose={() => setShowDeleteModal(false)}
        >
          <form
            className="flex flex-col gap-4 py-2"
            onSubmit={async (e) => {
              e.preventDefault();

              await axios
                .delete(`${apiUrl}/users`, {
                  data: { password: deletePassword },
                  withCredentials: true,
                })
                .then((_res) => {
                  toast({
                    message: 'Account deleted.',
                    mode: 'success',
                  });
                  router.push('/auth/login');
                })
                .catch((err) => {
                  toast({
                    message: getErrorMessage(err.response.data.code),
                    mode: 'error',
                  });
                });
            }}
          >
            <p>Are you sure you want to delete your account?</p>
            <p>
              This action is irreversible. All associated data will be
              permanently deleted.
            </p>
            <p>
              If you&apos;re sure you want to continue, please type in your
              password to confirm.
            </p>
            <Input
              type="password"
              placeholder="Enter your password"
              label="Confirm password"
              value={deletePassword}
              handleChange={(e) => setDeletePassword(e.target.value)}
            />
            <Button
              disabled={deletePassword.length === 0}
              type="submit"
              className="w-full"
              variant="destructive"
            >
              Request Permanent Account Deletion
            </Button>
            <span className="text-low-contrast-text text-sm">
              This will delete your account and all associated data.
            </span>
          </form>
        </Modal>
      </SettingsBox>
    </>
  );
}

export default function AccountSettingsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AccountSettingsContent />
    </Suspense>
  );
}
