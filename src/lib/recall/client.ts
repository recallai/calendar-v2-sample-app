import { z } from "zod";
import { env } from "../env";

/**
 * Thrown when the Recall.ai API responds with an error, so callers can check the status.
 */
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

/**
 * Make an authenticated request to the Recall.ai API, retrying the statuses above with backoff.
 * `path` is a path such as "/api/v2/calendars/", or a full URL such as a `next` page link.
 */
export async function recall_fetch(args: {
    path: string,
    method?: "GET" | "POST" | "PATCH" | "DELETE",
    query?: Record<string, string | boolean | undefined>,
    body?: unknown,
}): Promise<unknown> {
    const { path, method = "GET", query = {}, body } = args;

    const url = new URL(path, `https://${env.RECALL_REGION}.recall.ai`);
    for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) url.searchParams.set(key, String(value));
    }

    for (let attempt = 1;;attempt++) {
        const response = await fetch(url, {
            method,
            headers: {
                "Authorization": env.RECALL_API_KEY,
                "Content-Type": "application/json",
            },
            body: body !== undefined ? JSON.stringify(body) : undefined,
            cache: "no-store",
        });

        if (RETRYABLE_STATUSES.has(response.status) && attempt < MAX_ATTEMPTS) {
            const retry_after_seconds = Number(response.headers.get("Retry-After")) || 2 ** (attempt - 1);
            console.log(`Recall API returned ${response.status}, retrying in ${retry_after_seconds} seconds`);
            await new Promise((resolve) => setTimeout(resolve, retry_after_seconds * 1000));
            continue;
        }
        if (!response.ok) {
            throw new RecallApiError(response.status, method, url.pathname, await response.text());
        }

        return response.status === 204 ? undefined : await response.json();
    }
}

/** One page of a list endpoint. */
// eslint-disable-next-line @typescript-eslint/naming-convention
const PageSchema = z.object({
    next: z.string().nullable(),
    results: z.unknown().array(),
});

/**
 * Fetch every page of a list endpoint by following its `next` links.
 */
export async function recall_fetch_all_pages(args: {
    path: string,
    query?: Record<string, string | boolean | undefined>,
}): Promise<unknown[]> {
    const results: unknown[] = [];

    let page = PageSchema.parse(await recall_fetch(args));
    results.push(...page.results);
    while (page.next) {
        // The `next` link already holds the query, so it's used as is.
        page = PageSchema.parse(await recall_fetch({ path: page.next }));
        results.push(...page.results);
    }
    return results;
}
