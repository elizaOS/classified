import { Page } from 'playwright';
export interface CaptchaInfo {
  type: 'turnstile' | 'recaptcha-v2' | 'recaptcha-v3' | 'hcaptcha' | null;
  siteKey: string | null;
}
export declare function detectCaptchaType(page: Page): Promise<CaptchaInfo>;
export declare function injectCaptchaSolution(
  page: Page,
  captchaType: string,
  solution: string
): Promise<void>;
//# sourceMappingURL=captcha-handler.d.ts.map
