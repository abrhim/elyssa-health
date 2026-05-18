// Paste into DevTools console at https://connect.garmin.com/app/
// Pulls 2026-03-17 → 2026-04-07.
(async () => {
  const CSRF = '3ffda570-9025-4c9c-a9e3-a53fee5845e8'; // replace if 403
  const USER_GUID = '5f55db3e-a473-4ae6-a0da-4a85592608a5';

  const start = new Date('2026-03-17');
  const end   = new Date('2026-04-07');
  const dates = [];
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10));
  }

  const H = {
    credentials: 'include',
    headers: { 'Accept': 'application/json', 'connect-csrf-token': CSRF },
  };

  async function j(url) {
    try {
      const r = await fetch(url, H);
      if (!r.ok) return { __error: r.status };
      const t = await r.text();
      return t ? JSON.parse(t) : null;
    } catch (e) { return { __error: String(e) }; }
  }

  const out = { dates: {} };
  for (const ds of dates) {
    console.log('fetching', ds);
    out.dates[ds] = {
      sleep:       await j(`/gc-api/sleep-service/sleep/dailySleepData?date=${ds}&nonSleepBufferMinutes=60`),
      respiration: await j(`/gc-api/wellness-service/wellness/daily/respiration/${ds}`),
      floors:      await j(`/gc-api/wellness-service/wellness/floorsChartData/daily/${ds}`),
      stress:      await j(`/gc-api/wellness-service/wellness/dailyStress/${ds}`),
      heartrate:   await j(`/gc-api/wellness-service/wellness/dailyHeartRate?date=${ds}`),
      bodybattery: await j(`/gc-api/wellness-service/wellness/bodyBattery/events/${ds}`),
      summary:     await j(`/gc-api/usersummary-service/usersummary/daily/${USER_GUID}?calendarDate=${ds}`),
    };
    await new Promise(r => setTimeout(r, 150));
  }

  window.__gpull = out;
  const json = JSON.stringify(out);
  try { await navigator.clipboard.writeText(json); console.log('✅ copied', json.length, 'chars'); }
  catch(e) { console.log('clipboard blocked — run: copy(JSON.stringify(window.__gpull))'); }
  console.log(out);
  return out;
})();
