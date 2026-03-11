export const formatChatTime = (date: Date) => {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  const year = 365 * day;

  if (diff < hour) {
    const minutes = Math.floor(diff / minute);
    return `${minutes}m ago`;
  }

  if (diff < day) {
    const hours = Math.floor(diff / hour);
    return `${hours}h ago`;
  }

  if (diff < week) {
    return new Date(date).toLocaleDateString("en-US", {
      weekday: "short",
    });
  }

  if (diff < year) {
    return new Date(date).toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
    });
  }

  return "";
};