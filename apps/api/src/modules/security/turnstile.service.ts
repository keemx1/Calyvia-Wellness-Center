import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const VERIFY_TIMEOUT_MS = 5000;

interface TurnstileVerifyResult {
  success?: boolean;
  'error-codes'?: string[];
}

/**
 * Server-side Cloudflare Turnstile verification.
 *
 * TURNSTILE_SITE_KEY is public and is returned to the login page by the API.
 * TURNSTILE_SECRET_KEY is read only here and is never sent to the browser.
 */
@Injectable()
export class TurnstileService {
  private readonly logger = new Logger(TurnstileService.name);

  getSiteKey(): string | null {
    const siteKey = process.env.TURNSTILE_SITE_KEY?.trim();
    return siteKey || null;
  }

  async verify(token: string | undefined, remoteIp?: string): Promise<void> {
    const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
    if (!secret) {
      throw new ServiceUnavailableException(
        'Login security verification is not configured. Please contact IT.',
      );
    }

    if (!token?.trim()) {
      throw new UnauthorizedException('Security verification is required. Please try again.');
    }

    const payload = new URLSearchParams({
      secret,
      response: token.trim(),
    });
    if (remoteIp) {
      payload.set('remoteip', remoteIp);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(SITEVERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: payload.toString(),
        signal: controller.signal,
      });
    } catch {
      // Never log the token or the secret.
      this.logger.warn('Turnstile siteverify request failed or timed out');
      throw new ServiceUnavailableException(
        'Security verification is temporarily unavailable. Please try again.',
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      this.logger.warn(`Turnstile siteverify returned HTTP ${response.status}`);
      throw new ServiceUnavailableException(
        'Security verification is temporarily unavailable. Please try again.',
      );
    }

    let result: TurnstileVerifyResult;
    try {
      result = (await response.json()) as TurnstileVerifyResult;
    } catch {
      this.logger.warn('Turnstile siteverify returned an unreadable response');
      throw new ServiceUnavailableException(
        'Security verification is temporarily unavailable. Please try again.',
      );
    }

    if (result.success === true) {
      return;
    }

    const codes = Array.isArray(result['error-codes']) ? result['error-codes'] : [];
    // Log only Cloudflare error codes, never the challenge token or secret.
    this.logger.warn(`Turnstile verification rejected: ${codes.join(', ') || 'unknown'}`);

    const configurationCodes = [
      'missing-input-secret',
      'invalid-input-secret',
      'bad-request',
      'internal-error',
    ];
    if (codes.some((code) => configurationCodes.includes(code))) {
      throw new ServiceUnavailableException(
        'Login security verification is misconfigured. Please contact IT.',
      );
    }

    if (codes.includes('timeout-or-duplicate')) {
      throw new UnauthorizedException(
        'Security verification expired. Please complete it again.',
      );
    }

    throw new UnauthorizedException('Security verification failed. Please try again.');
  }
}
