import { AxiosError } from 'axios';
import type { APIError } from '../types';

export class APIErrorHandler {
  static handle(error: AxiosError): APIError {
    if (error.response) {
      // Server responded with error status
      const data = error.response.data as any;
      return {
        code: data?.error?.code || 'SERVER_ERROR',
        message: data?.error?.message || 'サーバーエラーが発生しました',
        details: data?.error?.details,
      };
    } else if (error.request) {
      // Network error
      return {
        code: 'NETWORK_ERROR',
        message: 'ネットワークエラーが発生しました。接続を確認してください。',
      };
    } else {
      // Other error
      return {
        code: 'UNKNOWN_ERROR',
        message: '予期しないエラーが発生しました。',
      };
    }
  }

  static isNetworkError(error: Error): boolean {
    return error.message.includes('ネットワークエラー') || error.message.includes('NETWORK_ERROR');
  }

  static isAuthError(error: Error): boolean {
    return error.message.includes('認証') || error.message.includes('AUTH');
  }

  static isValidationError(error: Error): boolean {
    return error.message.includes('検証') || error.message.includes('VALIDATION');
  }
}