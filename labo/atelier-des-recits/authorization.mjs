export function authorizationEndpoint(value) {
  try {
    const url = new URL(value);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if ((url.protocol !== "https:" && !(local && url.protocol === "http:")) ||
        url.username || url.password || url.search || url.hash) return "";
    return url.href.replace(/\/$/, "");
  } catch { return ""; }
}

// Même clé que le lecteur : une autorisation mémorisée reste utilisable dans les deux applications.
export const authorizationKey = endpoint => `narrateur-generation-code:${authorizationEndpoint(endpoint)}`;

export async function verifyAuthorization(endpoint, code, fetcher = globalThis.fetch.bind(globalThis)) {
  const base = authorizationEndpoint(endpoint);
  if (!base) throw new Error("Le service d’autorisation n’est pas configuré.");
  const response = await fetcher(`${base}/authorize`, {
    method: "POST", headers: { Authorization: `Bearer ${code}` },
    credentials: "omit", cache: "no-store", signal: AbortSignal.timeout(15000),
  });
  if (response.status === 401) {
    const error = new Error("Le code est incorrect ou a été révoqué.");
    error.accessDenied = true;
    throw error;
  }
  if (!response.ok || (await response.json()).code !== "authorized") {
    throw new Error("Impossible de vérifier l’autorisation. Réessayez plus tard.");
  }
}
