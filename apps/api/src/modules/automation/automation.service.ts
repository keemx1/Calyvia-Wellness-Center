import { Injectable } from '@nestjs/common';

@Injectable()
export class AutomationService {

  private notConfigured(job: string) {
    return {
      job,
      executedAt: new Date().toISOString(),
      status: 'NOT_CONFIGURED',
      message: 'No scheduler or queue is connected. Nothing was evaluated or sent.',
      patientsEvaluated: 0,
      alertsDispatched: 0,
      remindersSent: 0,
    };
  }

  async triggerScheduledVitalsAlerts() {
    return this.notConfigured('DETOX_VITALS_MONITOR');
  }

  async triggerMedicationReminders() {
    return this.notConfigured('E_MAR_MEDICATION_REMINDER');
  }

  async triggerAftercareCadenceDispatches() {
    return this.notConfigured('AFTERCARE_CADENCE_DISPATCHER');
  }
}
