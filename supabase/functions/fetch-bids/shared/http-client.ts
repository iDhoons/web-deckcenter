// shared/http-client.ts — HTTP 클라이언트

const FETCH_TIMEOUT_MS = 15000; // 15초

export function fetchWithTimeout(url: string, opts?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { ...opts, signal: controller.signal }).finally(() => clearTimeout(timeoutId));
}
