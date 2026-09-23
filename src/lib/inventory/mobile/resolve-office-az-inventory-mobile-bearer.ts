import "server-only";

export type MobileBearerResolution =
  | { readonly tag: "authenticated"; readonly userId: string }
  | { readonly tag: "denied"; readonly code: "UNAUTHENTICATED" };

export type MobileBearerScopedClient = {
  readonly auth: {
    getUser(
      jwt?: string,
    ): Promise<{ data: { user: { id: string } | null }; error: unknown }>;
  };
  rpc(
    name: string,
    args: { p_actor_id: string; p_operator_id: string },
  ): Promise<{ data: unknown; error: unknown }>;
};

const BEARER_PREFIX = "Bearer ";

function parseExactBearer(headerValue: string | null): string | null {
  if (headerValue === null) return null;
  if (headerValue.includes(",") || headerValue.includes("\n")) return null;
  if (!headerValue.startsWith(BEARER_PREFIX)) return null;
  const token = headerValue.slice(BEARER_PREFIX.length);
  if (token.length === 0 || token !== token.trim() || token.includes(" ")) {
    return null;
  }
  return token;
}

export function parseAuthorizationBearerHeader(
  headerValue: string | null,
): string | null {
  return parseExactBearer(headerValue);
}

function publicSupabaseEnv(): { url: string; anonKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (typeof url !== "string" || url.length === 0) return null;
  if (typeof anonKey !== "string" || anonKey.length === 0) return null;
  return { url: url.replace(/\/$/, ""), anonKey };
}

/**
 * Cookie-free client: every auth and RPC call is scoped to the exact Bearer
 * token via Authorization. Never logs or returns the token.
 */
export function createOfficeAzInventoryMobileBearerClient(
  authorizationHeader: string | null,
): MobileBearerScopedClient | null {
  const token = parseExactBearer(authorizationHeader);
  const env = publicSupabaseEnv();
  if (token === null || env === null) return null;
  const headers = {
    Authorization: `Bearer ${token}`,
    apikey: env.anonKey,
  };
  return {
    auth: {
      async getUser(jwt?: string) {
        if (jwt !== undefined && jwt !== token) {
          return { data: { user: null }, error: { code: "UNAUTHENTICATED" } };
        }
        const response = await fetch(`${env.url}/auth/v1/user`, {
          method: "GET",
          headers,
        });
        if (!response.ok) {
          return { data: { user: null }, error: { code: "UNAUTHENTICATED" } };
        }
        const body: unknown = await response.json();
        const userId =
          typeof body === "object" &&
          body !== null &&
          "id" in body &&
          typeof body.id === "string"
            ? body.id
            : null;
        if (userId === null || userId.trim().length === 0) {
          return { data: { user: null }, error: { code: "UNAUTHENTICATED" } };
        }
        return { data: { user: { id: userId } }, error: null };
      },
    },
    async rpc(name, args) {
      const response = await fetch(`${env.url}/rest/v1/rpc/${name}`, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(args),
      });
      if (!response.ok) {
        return { data: null, error: { code: "INVALID_AUTHORITY_RECORD" } };
      }
      return { data: await response.json(), error: null };
    },
  };
}

/**
 * Reads an exact Authorization: Bearer token and validates it with
 * a Bearer-scoped getUser. Never uses the cookie server client.
 * Never logs or returns token material.
 */
export async function resolveOfficeAzInventoryMobileBearer(
  authorizationHeader: string | null,
): Promise<MobileBearerResolution> {
  const token = parseExactBearer(authorizationHeader);
  const supabase = createOfficeAzInventoryMobileBearerClient(authorizationHeader);
  if (token === null || supabase === null) {
    return { tag: "denied", code: "UNAUTHENTICATED" };
  }
  try {
    const { data, error } = await supabase.auth.getUser(token);
    const userId = data?.user?.id;
    if (error || typeof userId !== "string" || userId.trim().length === 0) {
      return { tag: "denied", code: "UNAUTHENTICATED" };
    }
    return { tag: "authenticated", userId };
  } catch {
    return { tag: "denied", code: "UNAUTHENTICATED" };
  }
}
