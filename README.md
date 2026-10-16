# Calendar V2 Demo (Next.js)

A Next.js (App Router) version of the [`calendar_v2`](../calendar_v2) sample app, showing how to integrate [Recall.ai's Calendar V2 API](https://docs.recall.ai/docs/calendar-v2-integration-guide) to schedule meeting bots for calendar events.

> This is currently a scaffold — calendar OAuth, webhooks, and bot scheduling are not implemented yet.

## Getting started

1. Copy `.env.sample` to `.env` and fill in your values.
2. Install dependencies and start the dev server:

```sh
npm install
npm run dev
```

The app runs at http://localhost:3000.

## Project structure

```
src/
  app/
    layout.tsx    # Root layout
    page.tsx      # Home page
    globals.css   # Tailwind v4 + theme tokens (shared with calendar_v2)
```

## Webhooks

Recall.ai sends Calendar V2 webhooks (`calendar.update`, `calendar.sync_events`) to `POST /api/webhooks/recall`. Every request is verified against `RECALL_WEBHOOK_SECRET` before it is processed, and unverified requests get a `401`.

To receive webhooks locally:

1. Expose the app with ngrok: `ngrok http 3000`
2. In the Recall.ai dashboard, add a webhook endpoint at `https://<NGROK_DOMAIN>/api/webhooks/recall` subscribed to `calendar.update` and `calendar.sync_events`.
3. Copy that endpoint's signing secret (`whsec_...`) into `.env` as `RECALL_WEBHOOK_SECRET`.

## Connecting a calendar (OAuth)

Users connect a calendar from the home page. Each provider has its own routes:

| Route | Purpose |
| --- | --- |
| `GET /api/auth/sign-in/google` | Redirect to Google's consent screen |
| `GET /api/auth/callback/google` | Google redirects back here |
| `GET /api/auth/sign-in/microsoft` | Redirect to Microsoft's consent screen |
| `GET /api/auth/callback/microsoft` | Microsoft redirects back here |

The callback exchanges the code for a refresh token and creates the calendar in Recall.ai, or updates the existing calendar for that email so calendars aren't duplicated. A random `state` cookie protects the callback against CSRF.

Provider code lives in `src/lib/oauth/` (`google.ts`, `microsoft.ts`), with shared state-cookie helpers in `state.ts` and the Recall.ai create/update logic in `connect-calendar.ts`. A provider's button only shows on the home page once its OAuth variables are set.

OAuth redirects happen in the user's browser, so `localhost` redirect URIs work. ngrok is only needed for Recall.ai webhooks.

### Google setup

1. Enable the Google Calendar API and create an OAuth client ([Recall.ai guide](https://docs.recall.ai/docs/calendar-v2-google-calendar)) with the `calendar.events.readonly` and `userinfo.email` scopes.
2. Add `http://localhost:3000/api/auth/callback/google` as an **Authorized redirect URI**.
3. Set `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` and `GOOGLE_OAUTH_REDIRECT_URI` (the URI from step 2) in `.env`.

### Microsoft Outlook setup

1. Register an app in Microsoft Entra ([Recall.ai guide](https://docs.recall.ai/docs/calendar-v2-microsoft-outlook)) that supports "Any Entra ID Tenant + Personal Microsoft accounts", with a **Web** redirect URI of `http://localhost:3000/api/auth/callback/microsoft`.
2. Create a client secret, and add the delegated Microsoft Graph `Calendars.Read` permission.
3. Set `OUTLOOK_OAUTH_CLIENT_ID`, `OUTLOOK_OAUTH_CLIENT_SECRET` and `OUTLOOK_OAUTH_REDIRECT_URI` (the URI from step 1) in `.env`.
