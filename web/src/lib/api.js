
const API_BASE =
  (import.meta.env.VITE_API_BASE_URL || "http://localhost:3000").replace(/\/$/, "");

export async function verifyBag({ tag, surname, pnr }) {
  const response = await fetch(`${API_BASE}/api/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tagNumber: tag, tag, surname, pnr }),
  });

  const data = await response.json();

  if (!response.ok) {
    const message =
      typeof data.error === "string"
        ? data.error
        : data.error?.message || "Verification failed.";
    throw new Error(message);
  }

  return {
    ...data,
    token: data.data?.verificationToken || data.verificationToken || data.token,
    verificationToken: data.data?.verificationToken || data.verificationToken || data.token,
  };
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
    const message =
      typeof data.error === "string"
        ? data.error
        : data.error?.message || "Report submission failed.";
    throw new Error(message);
  }

  return data;
}