
const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

export async function verifyBag({ tag, surname, pnr }) {
  const response = await fetch(`${API_BASE}/api/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tag, surname, pnr }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Verification failed.");
  }

  return data;
}

export async function submitReport(report, token) {
  const response = await fetch(`${API_BASE}/api/report`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(report),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Report submission failed.");
  }

  return data;
}