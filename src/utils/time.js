export const addMinutes = (time, mins) => {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

export const isLunchTime = (time, lunchEnabled, lunchStart, lunchEnd) => {
  if (!lunchEnabled) return false;
  return time >= lunchStart && time < lunchEnd;
};

export const getNextAvailableTime = (time, lunchEnabled, lunchStart, lunchEnd) => {
  if (isLunchTime(time, lunchEnabled, lunchStart, lunchEnd)) {
    return lunchEnd;
  }
  return time;
};
