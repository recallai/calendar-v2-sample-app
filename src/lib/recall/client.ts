import { getEnv } from "../env";


type PaginatedResponse<T> = {
    next: string | null;
    previous: string | null;
    results: T[];
};

export class RecallApiError extends Error {
    constructor(
        readonly status: number,
        readonly method: string,
        readonly path: string,
        readonly body: string,
    ) {
        super(`Recall API ${method} ${path} failed with ${status}: ${body}`);
    }
}

const MAX_ATTEMPTS = 5;

/**
 * Statuses worth retrying:
 * - 429: rate limited; wait for Retry-After (https://docs.recall.ai/reference/errors)
 * - 409: parallel bot add/remove requests for the same deduplication key (https://docs.recall.ai/docs/scheduling-guide)
 * - 507: no ad-hoc bot available yet, e.g. an event was moved to start within minutes (same guide)
 */
const RETRYABLE_STATUSES = new Set([409, 429, 507]);

function getBaseUrl(): string {
    return `https://${getEnv().RECALL_REGION}.recall.ai`;
}

/**
 * Make an authenticated request to the Recall.ai API, retrying the statuses above with backoff.
 */
export async function recallFetch<T>(pathOrUrl: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
    const method = init.method ?? "GET";
    const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${getBaseUrl()}${pathOrUrl}`;

    for (let attempt = 1; ; attempt++) {
        const response = await fetch(url, {
            method,
            headers: {
                Authorization: getEnv().RECALL_API_KEY,
                Accept: "application/json",
                ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
            },
            body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
            cache: "no-store",
        });

        if (RETRYABLE_STATUSES.has(response.status) && attempt < MAX_ATTEMPTS) {
            const retryAfterSeconds = Number(response.headers.get("Retry-After")) || 2 ** (attempt - 1);
            await new Promise((resolve) => setTimeout(resolve, retryAfterSeconds * 1000));
            continue;
        }

        if (!response.ok) {
            throw new RecallApiError(response.status, method, new URL(url).pathname, await response.text());
        }

        if (response.status === 204) {
            return undefined as T;
        }
        return (await response.json()) as T;
    }
}

/**
 * Follow `next` links until every page has been fetched.
 * The `next` URL is used as-is, without modifying its query parameters.
 */
export async function fetchAllPages<T>(path: string): Promise<T[]> {
    const results: T[] = [];
    let next: string | null = path;
    while (next) {
        const page: PaginatedResponse<T> = await recallFetch<PaginatedResponse<T>>(next);
        results.push(...page.results);
        next = page.next;
    }
    return results;
}

export function withQuery(path: string, query: Record<string, string | boolean | undefined>): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) params.set(key, String(value));
    }
    const qs = params.toString();
    return qs ? `${path}?${qs}` : path;
}
