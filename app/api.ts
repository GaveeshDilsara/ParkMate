// app/api.ts
export const API_BASE = "http://172.20.10.5/Parkmate"; // ⬅️ change to your PC LAN IP

export const API = {
  registerOwner: `${API_BASE}/register_owner.php`,
  loginOwner: `${API_BASE}/login_owner.php`,
};

async function request<T>(url: string, body: any): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = { success:false, message: text || "Server error" }; }
  if (!res.ok || data?.success === false) {
    throw new Error(data?.message || `HTTP ${res.status}`);
  }
  return data as T;
}

export function registerOwner(payload: {
  username: string; password: string; email: string; nic: string; phone: string;
}) {
  return request<{ success: true; owner_id: number; username: string }>(API.registerOwner, payload);
}

export function loginOwner(identifier: string, password: string) {
  return request<{ success: true; owner: any }>(API.loginOwner, { identifier, password });
}
