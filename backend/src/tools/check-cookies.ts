/**
 * Verifies the cookie-based session flow: sign in, then make an
 * authenticated request using only the cookies the API set.
 */
const API = process.env.API_BASE_URL ?? "http://localhost:4000";

const jar = new Map<string, string>();

function absorb(response: Response) {
  for (const entry of response.headers.getSetCookie?.() ?? []) {
    const [pair] = entry.split(";");
    const index = pair.indexOf("=");
    if (index === -1) continue;
    const name = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    if (value === "") jar.delete(name);
    else jar.set(name, value);
  }
}

const cookieHeader = () =>
  [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");

const login = await fetch(`${API}/api/v1/auth/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    email: "owner@dhanmondi.test",
    password: "ZevaPay#2026",
  }),
});
absorb(login);
console.log("login status:", login.status);
console.log("cookies set:", [...jar.keys()].join(", "));

const overview = await fetch(`${API}/api/v1/merchant/overview`, {
  headers: { cookie: cookieHeader() },
});
const overviewBody = (await overview.json()) as {
  stats?: Record<string, unknown>;
};
console.log("overview status:", overview.status);
console.log("stats:", JSON.stringify(overviewBody.stats));

const noAuth = await fetch(`${API}/api/v1/merchant/overview`);
console.log("no-auth status:", noAuth.status);
