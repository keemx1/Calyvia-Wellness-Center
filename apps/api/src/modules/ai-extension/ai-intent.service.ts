import { Injectable } from '@nestjs/common';
import { AiChatMessageDto } from './dto/ai-chat.dto';

export type AiIntentId =
  | 'clinical_safety'
  | 'operational_summary'
  | 'appointments'
  | 'census'
  | 'billing'
  | 'detox_protocol'
  | 'staff'
  | 'navigation'
  | 'general';

export interface IntentAlternative {
  id: AiIntentId;
  label: string;
  confidence: number;
}

export interface IntentResolution {
  id: AiIntentId;
  label: string;
  score: number;
  confidence: number;
  matchedTerms: string[];
  alternatives: IntentAlternative[];
  isFollowUp: boolean;
  inheritedFromHistory: boolean;
  resolvedQuery?: string;
  needsClarification: boolean;
}

interface IntentDefinition {
  id: AiIntentId;
  label: string;
  aliases: string[];
  phrases: string[];
}

const INTENTS: IntentDefinition[] = [
  {
    id: 'clinical_safety',
    label: 'clinical safety boundary',
    aliases: [
      'prescribe',
      'prescription',
      'diagnose',
      'diagnosis',
      'medicine',
      'medication',
      'dose',
      'dosage',
      'drug',
    ],
    phrases: [
      'give medicine',
      'recommend dose',
      'recommend medication',
      'what medicine',
      'what drug',
    ],
  },
  {
    id: 'operational_summary',
    label: 'operational summary',
    aliases: ['summary', 'operational', 'overview', 'snapshot', 'report', 'happening'],
    phrases: [
      'operational summary',
      'daily summary',
      'center status',
      'what is happening today',
      'give me a summary',
      'overall status',
    ],
  },
  {
    id: 'appointments',
    label: 'appointments and schedule',
    aliases: [
      'appointment',
      'schedule',
      'scheduled',
      'calendar',
      'consultation',
      'session',
      'therapy',
      'followup',
    ],
    phrases: ['today schedule', 'clinical schedule', 'therapy session'],
  },
  {
    id: 'census',
    label: 'bed census and occupancy',
    aliases: [
      'bed',
      'census',
      'ward',
      'occupancy',
      'capacity',
      'room',
      'inpatient',
      'admission',
      'admitted',
    ],
    phrases: ['bed occupancy', 'ward occupancy', 'available beds', 'bed census'],
  },
  {
    id: 'billing',
    label: 'billing and revenue',
    aliases: [
      'billing',
      'invoice',
      'revenue',
      'mpesa',
      'm pesa',
      'payment',
      'daraja',
      'stk',
      'money',
      'receivable',
      'receivables',
      'outstanding',
      'balance',
      'account',
      'accounts',
    ],
    phrases: [
      'outstanding invoice',
      'money side',
      'stk push',
      'mpesa revenue',
      'accounts receivable',
    ],
  },
  {
    id: 'detox_protocol',
    label: 'detox protocols',
    aliases: [
      'detox',
      'ciwa',
      'cows',
      'withdrawal',
      'alcohol',
      'opioid',
      'protocol',
      'transfer',
      'emergency',
    ],
    phrases: [
      'ciwa ar',
      'alcohol withdrawal',
      'opioid withdrawal',
      'hospital transfer',
      'emergency transfer',
    ],
  },
  {
    id: 'staff',
    label: 'staff directory and roster',
    aliases: [
      'staff',
      'doctor',
      'nurse',
      'therapist',
      'roster',
      'duty',
      'pharmacist',
      'counsellor',
      'physician',
      'workload',
    ],
    phrases: ['who is on duty', 'staff roster', 'staff workload', 'doctor in charge'],
  },
  {
    id: 'navigation',
    label: 'module navigation help',
    aliases: [
      'module',
      'navigate',
      'help',
      'register',
      'admit',
      'workflow',
      'crm',
      'bed allocation',
    ],
    phrases: ['how do i', 'how to', 'where is', 'where can', 'how can i'],
  },
];

const STOP_WORDS = new Set([
  'a',
  'an',
  'again',
  'also',
  'and',
  'are',
  'at',
  'can',
  'did',
  'do',
  'does',
  'for',
  'from',
  'give',
  'given',
  'have',
  'here',
  'how',
  'i',
  'in',
  'is',
  'it',
  'me',
  'my',
  'of',
  'on',
  'our',
  'please',
  'show',
  'that',
  'the',
  'their',
  'there',
  'this',
  'to',
  'was',
  'were',
  'what',
  'when',
  'where',
  'which',
  'who',
  'with',
  'you',
  'your',
]);

const FOLLOW_UP_PATTERN = /^(and|also|what about|how about|tell me more|show me|same|again|that|then)\b/i;
const MATCH_THRESHOLD = 0.75;

@Injectable()
export class AiIntentService {
  private normalize(text: string): string {
    return String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .replace(/-/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private stem(token: string): string {
    return token.length > 3 && token.endsWith('s') ? token.slice(0, -1) : token;
  }

  private levenshtein(a: string, b: string): number {
    if (a === b) return 0;
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
    const current = new Array<number>(b.length + 1);

    for (let i = 1; i <= a.length; i += 1) {
      current[0] = i;
      for (let j = 1; j <= b.length; j += 1) {
        const substitution = previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
        current[j] = Math.min(
          previous[j] + 1,
          current[j - 1] + 1,
          substitution,
        );
      }
      for (let j = 0; j <= b.length; j += 1) {
        previous[j] = current[j];
      }
    }

    return previous[b.length];
  }

  private isFuzzyMatch(candidate: string, alias: string): boolean {
    if (candidate === alias) return true;
    if (candidate.length < 4 || alias.length < 4) return false;

    const distance = this.levenshtein(candidate, alias);
    const longest = Math.max(candidate.length, alias.length);
    const allowedDistance = longest >= 8 ? 2 : 1;

    return distance <= allowedDistance && 1 - distance / longest >= 0.7;
  }

  private scoreMessage(message: string) {
    const raw = this.normalize(message);
    const tokens = raw
      .split(' ')
      .filter((token) => token.length > 1 && !STOP_WORDS.has(token))
      .map((token) => this.stem(token));

    return INTENTS.map((intent) => {
      let score = 0;
      const matched = new Set<string>();

      for (const phrase of intent.phrases) {
        if (raw.includes(this.normalize(phrase))) {
          score += 1.6;
          matched.add(phrase);
        }
      }

      for (const alias of intent.aliases) {
        const stemmedAlias = this.stem(this.normalize(alias));
        if (tokens.includes(stemmedAlias)) {
          score += 1;
          matched.add(stemmedAlias);
          continue;
        }

        const fuzzyToken = tokens.find((token) => this.isFuzzyMatch(token, stemmedAlias));
        if (fuzzyToken) {
          score += 0.85;
          matched.add(`${stemmedAlias}~${fuzzyToken}`);
        }
      }

      return {
        id: intent.id,
        label: intent.label,
        score: Math.round(score * 100) / 100,
        matchedTerms: Array.from(matched),
      };
    }).sort((left, right) => right.score - left.score);
  }

  /**
   * Resolve a user message into a deterministic intent. Short follow-ups use
   * the previous user turn only when the current message has no topic of its
   * own, so "and appointments?" wins over the previous summary.
   */
  resolve(
    message: string,
    conversationHistory: AiChatMessageDto[] = [],
    _contextModule?: string,
  ): IntentResolution {
    const currentMessage = String(message || '').trim();
    const isFollowUp = FOLLOW_UP_PATTERN.test(currentMessage);
    let ranked = this.scoreMessage(currentMessage);
    let inheritedFromHistory = false;
    let resolvedQuery: string | undefined;

    if (ranked[0]?.score < MATCH_THRESHOLD && isFollowUp) {
      const previousUserMessage = [...conversationHistory]
        .reverse()
        .find((entry) => entry?.role === 'user' && String(entry.content || '').trim());

      if (previousUserMessage) {
        ranked = this.scoreMessage(previousUserMessage.content);
        inheritedFromHistory = true;
        resolvedQuery = previousUserMessage.content;
      }
    }

    const best = ranked[0] || { id: 'general' as AiIntentId, label: 'general query', score: 0, matchedTerms: [] as string[] };
    const fallbackDefinition = INTENTS.find((intent) => intent.id === best.id);
    const label = fallbackDefinition?.label || best.label;
    const id: AiIntentId = best.score < MATCH_THRESHOLD ? 'general' : best.id;
    const confidence = id === 'general' ? 0 : Math.min(1, best.score / 2);

    const alternatives = ranked
      .filter((candidate) => candidate.id !== id && candidate.score >= MATCH_THRESHOLD)
      .slice(0, 3)
      .map((candidate) => ({
        id: candidate.id,
        label: candidate.label,
        confidence: Math.min(1, candidate.score / 2),
      }));

    const secondScore = ranked.find((candidate) => candidate.id !== id)?.score || 0;
    const needsClarification =
      id !== 'general' &&
      secondScore >= MATCH_THRESHOLD &&
      best.score < 2.5 &&
      best.score - secondScore < 0.75;

    return {
      id,
      label,
      score: best.score,
      confidence: Math.round(confidence * 100) / 100,
      matchedTerms: best.matchedTerms,
      alternatives,
      isFollowUp,
      inheritedFromHistory,
      resolvedQuery,
      needsClarification,
    };
  }
}
