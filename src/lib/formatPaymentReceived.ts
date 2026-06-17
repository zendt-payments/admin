/** User-readable date + time for last successful Zwitch credit (dashboard tile). */
export function formatPaymentReceivedAt(iso: string): {
  dateLine: string;
  timeLine: string;
  combined: string;
} {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return { dateLine: "", timeLine: "", combined: "" };
  }

  const dateLine = d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const timeLine = d
    .toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .toLowerCase()
    .replace(/\s/g, " ");

  return {
    dateLine,
    timeLine,
    combined: `${dateLine} at ${timeLine}`,
  };
}
