export function getApiError(error, fallback = "Something went wrong") {
  return error?.response?.data?.message || fallback;
}

export function formatCurrency(value) {
  const num = Number(value || 0);
  return num.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });
}

export function formatDateTime(value) {
  if (!value) return "-";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return String(value);
  return dt.toLocaleString();
}
