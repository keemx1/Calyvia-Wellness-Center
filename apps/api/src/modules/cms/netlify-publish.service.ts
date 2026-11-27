import { Injectable, Logger } from '@nestjs/common';

/**
 * Triggers a Netlify production rebuild after public content changes.
 *
 * The build hook URL is a deployment secret: it is read from the environment
 * only, never logged, and never returned to clients or committed to a repo.
 */
@Injectable()
export class NetlifyPublishService {
  private readonly logger = new Logger(NetlifyPublishService.name);

  async trigger(reason: string): Promise<{ triggered: boolean; reason?: string }> {
    const url = process.env.NETLIFY_CMS_BUILD_HOOK_URL;
    if (!url) {
      this.logger.warn(
        `NETLIFY_CMS_BUILD_HOOK_URL is not set; website rebuild skipped (${reason}).`,
      );
      return { triggered: false, reason: 'not_configured' };
    }

    // Only official Netlify build hook endpoints are accepted. This prevents a
    // misconfigured environment variable from being used to POST to an
    // arbitrary host.
    if (!/^https:\/\/api\.netlify\.com\/build_hooks\//i.test(url)) {
      this.logger.error(
        `Invalid Netlify build hook configuration; website rebuild skipped (${reason}).`,
      );
      return { triggered: false, reason: 'invalid_hook_url' };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Netlify returned HTTP ${response.status}`);
      }
      return { triggered: true };
    } catch (error: any) {
      // Deliberately do not include the URL in the error log.
      this.logger.error(`Failed to trigger website rebuild: ${error?.message || 'unknown error'}`);
      return { triggered: false, reason: 'request_failed' };
    } finally {
      clearTimeout(timeout);
    }
  }
}
