export interface OAuth1Token {
  oauth_token: string;
  oauth_token_secret: string;
  mfa_token?: string | null;
  mfa_expiration_timestamp?: string | null;
  domain?: string;
}

export interface OAuth2Token {
  scope: string;
  jti: string;
  token_type: string;
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at: number;
  refresh_token_expires_in: number;
  refresh_token_expires_at: number;
}

export interface ConsumerCredentials {
  consumer_key: string;
  consumer_secret: string;
}

export interface StoredTokens {
  id: number;
  oauth1_token: OAuth1Token;
  oauth2_token: OAuth2Token;
  consumer_credentials: ConsumerCredentials;
  display_name: string | null;
  updated_at: string;
}

export interface SyncResult {
  endpoint: string;
  target_date: string;
  status: "success" | "error";
  error_message?: string;
  rows_affected: number;
}

// Garmin API response shapes

export interface Spo2Response {
  averageSpO2?: number;
  lowestSpO2?: number;
  latestSpO2?: number;
}

export interface SleepResponse {
  dailySleepDTO?: {
    sleepStartTimestampGMT?: number;
    sleepEndTimestampGMT?: number;
    sleepTimeSeconds?: number;
    deepSleepSeconds?: number;
    lightSleepSeconds?: number;
    remSleepSeconds?: number;
    awakeSleepSeconds?: number;
    sleepScores?: {
      overall?: { value?: number; qualifierKey?: string };
    };
    averageSpO2Value?: number;
    averageRespirationValue?: number;
    averageStressValue?: number;
  };
}

export interface RespirationResponse {
  avgWakingRespirationValue?: number;
  avgSleepRespirationValue?: number;
  highestRespirationValue?: number;
  lowestRespirationValue?: number;
}

export interface FloorsResponse {
  floorsAscended?: number;
  floorsDescended?: number;
}

export interface HeartrateResponse {
  restingHeartRate?: number;
  minHeartRate?: number;
  maxHeartRate?: number;
  lastSevenDaysAvgRestingHeartRate?: number;
}

export interface StressResponse {
  overallStressLevel?: number;
  restStressDuration?: number;
  lowStressDuration?: number;
  mediumStressDuration?: number;
  highStressDuration?: number;
}

export interface DailySummaryResponse {
  totalSteps?: number;
  totalDistanceMeters?: number;
  activeKilocalories?: number;
  bmrKilocalories?: number;
  totalKilocalories?: number;
  floorsAscended?: number;
  moderateIntensityMinutes?: number;
  vigorousIntensityMinutes?: number;
  averageStressLevel?: number;
  bodyBatteryChargedValue?: number;
  bodyBatteryDrainedValue?: number;
}

export interface MenstrualCycleResponse {
  daySummary?: {
    currentPhase?: number;
    dayInCycle?: number;
    daysUntilNextPhase?: number;
    startDate?: string;
    periodLength?: number;
    predictedCycleLength?: number;
    cycleType?: string;
    fertileWindowStart?: number;
    isPredicted?: boolean;
  };
  dayLog?: Record<string, unknown>;
}

export interface ActivityResponse {
  activityId: number;
  startTimeLocal?: string;
  startTimeGMT?: string;
  activityName?: string;
  activityType?: { typeKey?: string };
  duration?: number;
  movingDuration?: number;
  distance?: number;
  elevationGain?: number;
  averageSpeed?: number;
  maxSpeed?: number;
  calories?: number;
  averageHR?: number;
  maxHR?: number;
  steps?: number;
  vO2MaxValue?: number;
  startLatitude?: number;
  startLongitude?: number;
  locationName?: string;
  deviceId?: number;
  moderateIntensityMinutes?: number;
  vigorousIntensityMinutes?: number;
}
