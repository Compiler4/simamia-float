export type ApiBody = {
  success?: boolean;
  message?: string;
  error?: string;
};

export async function requestJson<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    credentials: "include",
    ...options,
    headers: {
      Accept: "application/json",
      ...options.headers,
    },
  });

  const raw = await response.text();
  let body: (ApiBody & T) | null = null;

  try {
    body = raw ? (JSON.parse(raw) as ApiBody & T) : ({} as ApiBody & T);
  } catch {
    body = null;
  }

  if (response.status === 401) {
    if (typeof window !== "undefined") {
      const current = `${window.location.pathname}${window.location.search}`;
      window.location.replace(
        `/login?reason=session-expired&returnTo=${encodeURIComponent(current)}`,
      );
    }

    throw new Error("Your session has expired. Please sign in again.");
  }

  if (!response.ok || body?.success === false) {
    throw new Error(
      body?.message ||
        body?.error ||
        `Request failed with status ${response.status}.`,
    );
  }

  if (!body) {
    throw new Error(
      `The server returned ${response.status} instead of valid JSON.`,
    );
  }

  return body;
}
