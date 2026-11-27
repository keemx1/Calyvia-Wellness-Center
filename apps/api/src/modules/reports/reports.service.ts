import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async generateFinancialReport(month?: string) {
    let totalCollected = 0;
    let totalOutstanding = 0;

    try {
      if (this.prisma) {
        if (this.prisma.payment) {
          const payments = await this.prisma.payment.findMany();
          totalCollected = payments.reduce((sum: number, p: any) => sum + Number(p.amountPaid || p.amountKES || 0), 0);
        }
        if (this.prisma.invoice) {
          const invoices = await this.prisma.invoice.findMany();
          totalOutstanding = invoices.reduce((sum: number, inv: any) => sum + Number(inv.balanceDue || inv.balanceKES || 0), 0);
        }
      }
    } catch (err) {
      console.warn('Financial report aggregation error:', err);
    }

    return {
      reportTitle: `Calyvia Wellness Center - Financial Summary (${month || 'Current Month'})`,
      currency: 'KES',
      generatedAt: new Date().toISOString(),
      // Line items are not categorised in the database yet, so no fake category
      // totals are reported. Only the ledger-backed totals below are real.
      breakdown: [],
      totalCollectedKES: totalCollected,
      totalOutstandingKES: totalOutstanding,
    };
  }

  async generateClinicalOutcomesReport() {
    let completedEpisodes = 0;
    let totalDetoxEpisodes = 0;
    let totalDischarges = 0;

    try {
      if (this.prisma) {
        if (this.prisma.detoxEpisode) {
          totalDetoxEpisodes = await this.prisma.detoxEpisode.count();
          completedEpisodes = await this.prisma.detoxEpisode.count({ where: { isCompleted: true } });
        }
        if (this.prisma.dischargeRecord) {
          totalDischarges = await this.prisma.dischargeRecord.count();
        }
      }
    } catch (err) {
      console.warn('Clinical outcomes aggregation error:', err);
    }

    const detoxCompletionRate =
      totalDetoxEpisodes > 0
        ? Number(((completedEpisodes / totalDetoxEpisodes) * 100).toFixed(1))
        : null;

    return {
      reportTitle: 'Clinical Rehabilitation & Detoxification Outcomes',
      reportingFacility: 'Calyvia Wellness Center (Ruiru, Kenya)',
      generatedAt: new Date().toISOString(),
      metrics: {
        totalDetoxEpisodes,
        totalDetoxEpisodesCompleted: completedEpisodes,
        detoxCompletionRate,
        totalDischargesCompleted: totalDischarges,
        // These require structured CIWA/aftercare outcome data that is not yet
        // persisted; null means "no data", not a measured zero.
        averageDetoxDurationDays: null,
        uncomplicatedDetoxSuccessRate: null,
        averageCIWAScoreReduction: null,
        rehabProgramGraduationRate: null,
        aftercareSobrietyRetention90Days: null,
      },
    };
  }
}
