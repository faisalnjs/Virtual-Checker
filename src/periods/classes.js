import classes from "./classes.json";

// Returns zero-indexed course
export function getCourse(seatCode) {
  return classes[Number(seatCode.slice(0, 1)) - 1];
}