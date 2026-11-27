import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SystemSettingsService } from './settings.service';

@Injectable()
export class SystemAdminService {
  private readonly logger = new Logger(SystemAdminService.name);

  constructor(
    private prisma: PrismaService,
    private settings: SystemSettingsService,
  ) {}

  async getFacilityConfig() {
    return {
      facilityName: 'Calyvia Wellness Center',
      tagline: 'Comprehensive Addiction Recovery & Mental Health Rehabilitation',
      location: 'Mugutha, Behind Full Gospel Church, Ruiru, Kiambu County, Kenya',
      gpsCoordinates: '-1.1193655, 36.9487542',
      primaryPhone: '+254700534306',
      officialEmail: 'calyviawellness@gmail.com',
      websiteUrl: 'https://calyviawellness.co.ke',
      servicesOffered: [
        'Comprehensive Clinical Assessment',
        'Medically Guided Detoxification',
        'Inpatient Rehabilitation (30 / 60 / 90 Days)',
        'Outpatient Rehabilitation',
        'Individual & Group Psychotherapy',
        'Family Therapy & Support',
        'Relapse Prevention & Aftercare Follow-up',
      ],
      compliance: {
        // Registration and statutory compliance are legal facts, not application
        // settings. They must be verified outside this system before publication.
        kdpa2019Compliant: null,
        dataControllerRegistered: null,
        auditTrailEnabled: true,
        verificationNote: 'KDPA registration and compliance status are not verified by this application.',
      },
    };
  }

  /**
   * Persist a system setting.
   *
   * NOTE: the columns are setting_key / setting_value / description / is_encrypted.
   * An earlier version wrote `key`, `value` and `category`, which matched no column,
   * so the upsert silently failed inside a bare `catch {}` and nothing was ever stored.
   */
  async updateSetting(
    key: string,
    value: string,
    category: string,
    isEncrypted = false,
  ) {
    try {
      const result = await this.settings.set(key, value, {
        description: category,
        isEncrypted,
      });
      return {
        key: result.key,
        category,
        // Never echo a secret back to the caller.
        value: isEncrypted ? '••••••••' : value,
        isEncrypted,
        stored: result.stored,
        updatedAt: new Date().toISOString(),
      };
    } catch (err: any) {
      // Surface the failure instead of pretending the write succeeded.
      this.logger.error(`Failed to update setting "${key}": ${err?.message || err}`);
      throw err;
    }
  }

  /** Read a single setting (decrypted when flagged). */
  async getSetting(key: string) {
    const value = await this.settings.readSetting(key);
    return { key, value };
  }
}
