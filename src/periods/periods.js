import schedule from "./schedule.json";
import extendedSchedule from "./extendedSchedule.json";

const timestamps = schedule.map((period) => {
  return [timeToMs(period[0]), timeToMs(period[1])];
});

const extendedTimestamps = extendedSchedule.map((period) => {
  return [timeToMs(period[0]), timeToMs(period[1])];
});

// Returns zero-indexed period
export function getPeriod(date) {
  date = date || Date.now();
  const period = timestamps.findIndex((periods) => {
    return date >= periods[0] && date < periods[1];
  });
  return period;
}

export function getExtendedPeriod(date) {
  date = date || Date.now();
  const period = extendedTimestamps.findIndex((periods) => {
    return date >= periods[0] && date < periods[1];
  });
  return period;
}

// Converts hh:mm to milliseconds
export function timeToMs(time) {
  const now = new Date();
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes).getTime();
}