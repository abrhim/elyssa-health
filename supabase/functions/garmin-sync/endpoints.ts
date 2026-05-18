import type {
  Spo2Response,
  SleepResponse,
  RespirationResponse,
  FloorsResponse,
  HeartrateResponse,
  StressResponse,
  DailySummaryResponse,
  MenstrualCycleResponse,
  ActivityResponse,
} from "./types.ts";

const BASE = "https://connectapi.garmin.com";
const USER_AGENT = "com.garmin.android.apps.connectmobile";

async function garminGet<T>(
  path: string,
  accessToken: string
): Promise<T | null> {
  const resp = await fetch(`${BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": USER_AGENT,
    },
  });

  if (!resp.ok) {
    if (resp.status === 404) return null;
    const text = await resp.text();
    throw new Error(`Garmin API ${resp.status}: ${text.slice(0, 200)}`);
  }

  return resp.json();
}

export async function getSpo2(
  accessToken: string,
  date: string
): Promise<Spo2Response | null> {
  return garminGet(`/wellness-service/wellness/daily/spo2/${date}`, accessToken);
}

export async function getSleep(
  accessToken: string,
  date: string,
  displayName?: string | null
): Promise<SleepResponse | null> {
  const name = displayName ?? "";
  return garminGet(
    `/wellness-service/wellness/dailySleepData/${name}?date=${date}&nonSleepBufferMinutes=60`,
    accessToken
  );
}

export async function getRespiration(
  accessToken: string,
  date: string
): Promise<RespirationResponse | null> {
  return garminGet(
    `/wellness-service/wellness/daily/respiration/${date}`,
    accessToken
  );
}

export async function getFloors(
  accessToken: string,
  date: string
): Promise<FloorsResponse | null> {
  return garminGet(
    `/wellness-service/wellness/floorsChartData/daily/${date}`,
    accessToken
  );
}

export async function getHeartrate(
  accessToken: string,
  date: string
): Promise<HeartrateResponse | null> {
  return garminGet(
    `/wellness-service/wellness/dailyHeartRate?date=${date}`,
    accessToken
  );
}

export async function getStress(
  accessToken: string,
  date: string
): Promise<StressResponse | null> {
  return garminGet(
    `/wellness-service/wellness/dailyStress/${date}`,
    accessToken
  );
}

export async function getDailySummary(
  accessToken: string,
  date: string
): Promise<DailySummaryResponse | null> {
  return garminGet(
    `/usersummary-service/usersummary/daily?calendarDate=${date}`,
    accessToken
  );
}

export async function getMenstrualCycle(
  accessToken: string,
  date: string
): Promise<MenstrualCycleResponse | null> {
  return garminGet(
    `/periodichealth-service/menstrualcycle/dayview/${date}`,
    accessToken
  );
}

export async function getActivities(
  accessToken: string,
  date: string
): Promise<ActivityResponse[] | null> {
  return garminGet(
    `/activitylist-service/activities/search/activities?startDate=${date}&endDate=${date}&start=0&limit=100`,
    accessToken
  );
}
