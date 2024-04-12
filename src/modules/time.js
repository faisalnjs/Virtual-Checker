export function unixToString(timestamp) {
  let date = new Date(timestamp);
  if (timestamp) {
    let month = date.getMonth() + 1;
    let day = date.getDate();
    let hours = date.getHours();
    let minutes = date.getMinutes().toString().padStart(2, "0");
    let period;
    if (hours >= 12) {
      hours %= 12;
      period = "PM";
    } else {
      period = "AM";
    }
    if (hours == 0) {
      hours = 12;
    }
    return `${month}/${day} ${hours}:${minutes} ${period}`;
  }
}

export function unixToTimeString(timestamp) {
  let date = new Date(timestamp);
  if (timestamp) {
    let hours = date.getHours();
    let minutes = date.getMinutes().toString().padStart(2, "0");
    let period;
    if (hours >= 12) {
      hours %= 12;
      period = "PM";
    } else {
      period = "AM";
    }
    if (hours == 0) {
      hours = 12;
    }
    return `${hours}:${minutes} ${period}`;
  }
}
