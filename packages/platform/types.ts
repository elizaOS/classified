import { ErrorCode, ResponseCode } from '@/messages';

export type User = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isAdmin: boolean;
  avatarUrl: string;
};

export type ApiResponse = {
  message: string;
  code: ResponseCode;
  error: null | undefined;
};

export type ApiError = {
  message: string;
  error: string;
  code: ErrorCode;
};
