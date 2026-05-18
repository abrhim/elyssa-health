import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type {
  OAuth1Token,
  OAuth2Token,
  ConsumerCredentials,
  StoredTokens,
} from "./types.ts";

const GARMIN_DOMAIN = "garmin.com";
const EXCHANGE_URL = `https://connectapi.${GARMIN_DOMAIN}/oauth-service/oauth/exchange/user/2.0`;
const USER_AGENT = "com.garmin.android.apps.connectmobile";

export function createSupabaseClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

export async function loadTokens(
  supabase: SupabaseClient
): Promise<StoredTokens> {
  const { data, error } = await supabase
    .schema("health")
    .from("garmin_tokens")
    .select("*")
    .eq("id", 1)
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to load tokens: ${error?.message ?? "no token row found"}`
    );
  }
  return data as StoredTokens;
}

export async function saveTokens(
  supabase: SupabaseClient,
  oauth2: OAuth2Token
): Promise<void> {
  const { error } = await supabase
    .schema("health")
    .from("garmin_tokens")
    .update({ oauth2_token: oauth2, updated_at: new Date().toISOString() })
    .eq("id", 1);

  if (error) {
    throw new Error(`Failed to save tokens: ${error.message}`);
  }
}

// OAuth1 signing using Web Crypto API (no npm dependencies)

function percentEncode(str: string): string {
  return encodeURIComponent(str).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSha1(key: string, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    encoder.encode(data)
  );
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

async function signOAuth1Request(
  consumer: ConsumerCredentials,
  oauth1: OAuth1Token,
  url: string,
  method: string
): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = generateNonce();

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumer.consumer_key,
    oauth_nonce: nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: timestamp,
    oauth_token: oauth1.oauth_token,
    oauth_version: "1.0",
  };

  // Build signature base string
  const sortedParams = Object.entries(oauthParams)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${percentEncode(k)}=${percentEncode(v)}`)
    .join("&");

  const baseString = [
    method.toUpperCase(),
    percentEncode(url),
    percentEncode(sortedParams),
  ].join("&");

  const signingKey = `${percentEncode(consumer.consumer_secret)}&${percentEncode(oauth1.oauth_token_secret)}`;
  const signature = await hmacSha1(signingKey, baseString);

  oauthParams.oauth_signature = signature;

  const headerParts = Object.entries(oauthParams)
    .map(([k, v]) => `${percentEncode(k)}="${percentEncode(v)}"`)
    .join(", ");

  return `OAuth ${headerParts}`;
}

export async function refreshOAuth2(
  consumer: ConsumerCredentials,
  oauth1: OAuth1Token
): Promise<OAuth2Token> {
  const authHeader = await signOAuth1Request(
    consumer,
    oauth1,
    EXCHANGE_URL,
    "POST"
  );

  const body = oauth1.mfa_token
    ? `mfa_token=${encodeURIComponent(oauth1.mfa_token)}`
    : "";

  const resp = await fetch(EXCHANGE_URL, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "User-Agent": USER_AGENT,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`OAuth2 exchange failed (${resp.status}): ${text}`);
  }

  const token = await resp.json();
  const now = Math.floor(Date.now() / 1000);
  return {
    ...token,
    expires_at: now + token.expires_in,
    refresh_token_expires_at: now + token.refresh_token_expires_in,
  } as OAuth2Token;
}

export async function getValidAccessToken(
  supabase: SupabaseClient
): Promise<{ accessToken: string; displayName: string | null }> {
  const stored = await loadTokens(supabase);
  const now = Math.floor(Date.now() / 1000);

  let oauth2 = stored.oauth2_token;

  if (oauth2.expires_at < now + 60) {
    console.log("[auth] OAuth2 token expired, refreshing via OAuth1...");
    oauth2 = await refreshOAuth2(
      stored.consumer_credentials,
      stored.oauth1_token
    );
    await saveTokens(supabase, oauth2);
    console.log("[auth] OAuth2 token refreshed successfully");
  }

  return {
    accessToken: oauth2.access_token,
    displayName: stored.display_name,
  };
}
