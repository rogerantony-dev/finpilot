/** Today's date as YYYY-MM-DD (UTC). */
export const todayIso = () => new Date().toISOString().slice(0, 10);
