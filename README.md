# Calendar V2 Demo (Next.js)

A Next.js demo app showing how to integrate [Recall.ai's Calendar V2 API](https://docs.recall.ai/docs/calendar-v2-integration-guide) to automatically schedule meeting bots for calendar events. Unlike [`calendar_v2`](../calendar_v2), which sends a bot to every meeting, this app decides which meetings get a bot per calendar, which is how Calendar V2's app-managed scheduling is meant to be used.

## Features

-   **Calendar Integration**: Connects directly with a user's Google Calendar or Microsoft Outlook accounts
-   **Calendar Sync**: Automatically syncs calendar events via Recall.ai webhooks
-   **Schedule Modes**: Choose per calendar which meetings get a bot: every meeting, ones you organized, ones with external guests, ones with only internal guests, or none
-   **Bot Settings**: Customize each calendar's bots (name, joining early, a chat message, and when the bot leaves on its own)
-   **Per-Meeting Overrides**: Add, edit or remove the bot for a single meeting, whatever the calendar's setting

## Architecture & Request Flows

### 1. Connecting a Calendar

When a user clicks "Connect Google Calendar" or "Connect Microsoft Outlook":

```
  Client              Server          Calendar Provider        Recall.ai
    │                   │             (Google/Outlook)              │
    │                   │                      │                    │
    │ GET /api/auth/sign-in/google|microsoft   │                    │
    │──────────────────▶│                      │                    │
    │                   │                      │                    │
    │                   │ 302 Redirect to provider OAuth            │
    │                   │─────────────────────▶│                    │
    │                   │                      │                    │
    │                   │        User authorizes calendar access    │
    │                   │                      │                    │
    │   Redirect back with auth code           │                    │
    │◀─────────────────────────────────────────│                    │
    │                   │                      │                    │
    │ GET /api/auth/callback/google|microsoft?code=abc123           │
    │──────────────────▶│                      │                    │
    │                   │                      │                    │
    │                   │  Exchange code for   │                    │
    │                   │  OAuth tokens        │                    │
    │                   │─────────────────────▶│                    │
    │                   │                      │                    │
    │                   │  { refresh_token,    │                    │
    │                   │    email }           │                    │
    │                   │◀─────────────────────│                    │
    │                   │                      │                    │
    │                   │   GET https://REGION.recall.ai/api/v2/calendars?email=...
    │                   │   (is this account already connected?)    │
    │                   │──────────────────────────────────────────▶│
    │                   │                      │                    │
    │                   │   POST https://REGION.recall.ai/api/v2/calendars
    │                   │   or PATCH .../calendars/{id} to reconnect│
    │                   │   { oauth_refresh_token, oauth_client_id, ... }
    │                   │──────────────────────────────────────────▶│
    │                   │                      │                    │
    │                   │                      │   Calendar created │
    │                   │◀──────────────────────────────────────────│
    │                   │                      │                    │
    │   302 Redirect to home page              │                    │
    │◀──────────────────│                      │                    │
```

### 2. Calendar Sync & Scheduling (via Webhooks)

After OAuth (and on ongoing calendar changes), calendar providers notify Recall.ai, which then notifies your server. The server decides which meetings get a bot:

```
  Google/Outlook          Recall.ai                 Server
       │                      │                       │
       │  Calendar event      │                       │
       │  created/updated     │                       │
       │  (webhook push)      │                       │
       │─────────────────────▶│                       │
       │                      │                       │
       │                      │      POST /api/webhooks/recall
       │                      │      { event: "calendar.sync_events",
       │                      │        calendar_id, last_updated_ts }
       │                      │──────────────────────▶│
       │                      │                       │
       │                      │  200 OK (right away)  │
       │                      │◀──────────────────────│
       │                      │                       │
       │                      │ GET https://REGION.recall.ai/api/v2/calendar-events
       │                      │          ?calendar_id=...&updated_at__gte={last_updated_ts}
       │                      │◀──────────────────────│
       │                      │                       │
       │                      │ [only changed events] │
       │                      │──────────────────────▶│
       │                      │                       │
       │                      │       For each future event, decide whether it
       │                      │       should have a bot: meeting link, then the
       │                      │       meeting's override, then the calendar's
       │                      │       schedule mode
       │                      │                       │
       │                      │  POST .../calendar-events/{id}/bot    (add a bot,
       │                      │◀──────────────────────│  or move one whose
       │                      │                       │  meeting moved)
       │                      │  DELETE .../calendar-events/{id}/bot  (remove a bot
       │                      │◀──────────────────────│  that no longer matches)
```

### 3. Adding or Removing a Meeting's Bot (User Action)

When a user opens a meeting in the week calendar and adds, edits or removes its bot:

```
  Client                Server              Recall.ai
    │                     │                    │
    │  "Add bot" / "Save bot"                  │
    │                     │                    │
    │  save_meeting_bot (server action)        │
    │────────────────────▶│                    │
    │                     │                    │
    │                     │  POST https://REGION.recall.ai/api/v2/calendar-events/{id}/bot
    │                     │  { deduplication_key, bot_config }
    │                     │───────────────────▶│
    │                     │                    │
    │                     │   Bot scheduled    │
    │                     │◀───────────────────│
    │                     │                    │
    │                     │  Save an "always" override, so the
    │                     │  calendar's schedule mode keeps it
    │                     │                    │
    │  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
    │                     │                    │
    │  "Remove" / "Skip this meeting"          │
    │                     │                    │
    │  remove_meeting_bot_action (server action)
    │────────────────────▶│                    │
    │                     │                    │
    │                     │  DELETE https://REGION.recall.ai/api/v2/calendar-events/{id}/bot
    │                     │───────────────────▶│
    │                     │                    │
    │                     │   Bot unscheduled  │
    │                     │◀───────────────────│
    │                     │                    │
    │                     │  Save a "never" override, so the
    │                     │  calendar's schedule mode skips it
```

### Key Points

-   **Push-based sync**: Calendar providers send webhooks to Recall, which notifies your server via the `calendar.update` and `calendar.sync_events` webhooks. Use `last_updated_ts` to fetch only changed events on `calendar.sync_events` webhooks.
-   **App-managed scheduling**: With Calendar V2, your app decides which meetings get a bot. This app does it with a schedule mode per calendar and per-meeting overrides.
-   **Respond to webhooks quickly**: The webhook is acknowledged right away and the Recall.ai API calls happen after responding. Handling the same webhook twice is harmless: the second sync finds nothing to change.
-   **Verified webhooks**: Every webhook is checked against `RECALL_WEBHOOK_SECRET` before it's processed. Unverified requests get a `401`.
-   **Deduplication keys**: Prevent duplicate bots when multiple users have the same meeting
-   **Recall auto-manages some bots**: Recall unschedules bots when events are deleted or calendars are disconnected. It doesn't move a bot when its meeting moves, so the app schedules it again.

## Prerequisites

-   Node.js 18+
-   [ngrok](https://ngrok.com/) account (for webhooks)
-   Recall.ai API key

## Setup

### 1. Set up OAuth providers

Follow the official Recall.ai guides to create OAuth credentials (you'll need these for step 4):

-   **Google Calendar**: [Google Calendar Setup Guide](https://docs.recall.ai/docs/calendar-v2-google-calendar). Use `http://localhost:3000/api/auth/callback/google` as the redirect URI.
-   **Microsoft Outlook**: [Microsoft Outlook Setup Guide](https://docs.recall.ai/docs/calendar-v2-microsoft-outlook). Register a **Web** redirect URI of `http://localhost:3000/api/auth/callback/microsoft`, support "Any Entra ID Tenant + Personal Microsoft accounts", and add the delegated Microsoft Graph `Calendars.Read` permission.

OAuth redirects happen in the user's browser, so `localhost` redirect URIs work. ngrok is only needed for Recall.ai webhooks.

### 2. Install dependencies

```bash
cd calendar_v2_next
npm install
```

### 3. Start ngrok

```bash
ngrok http 3000
```

### 4. Set up env variables

Copy the sample environment file and fill in your values:

```bash
cp .env.sample .env
```

Then edit `.env` with your Recall API key, region, and OAuth credentials from step 1. A provider's connect button only shows once its OAuth variables are set.

### 5. Configure Recall.ai webhook

In your [Recall.ai webhooks dashboard](https://docs.recall.ai/reference/webhooks-overview), add a webhook endpoint subscribed to `calendar.update` and `calendar.sync_events`, with the URL:

```
https://YOUR_CUSTOM_NGROK_SUBDOMAIN.ngrok-free.app/api/webhooks/recall
```

Copy that endpoint's signing secret (`whsec_...`) into `.env` as `RECALL_WEBHOOK_SECRET`.

### 6. Run the app

```bash
npm run dev
```

This starts the app at http://localhost:3000. Database migrations run automatically when the server starts.

## Using the app

1. Open http://localhost:3000 in your browser
2. Click "Connect Google Calendar" or "Connect Microsoft Outlook" to authorize your calendar
3. Click the pencil on the calendar's card to choose which meetings get a bot, and what those bots are like
4. Your meetings for the next 7 days show in the week calendar. Click one to add, edit or remove its bot
5. A Recall.ai bot will join each meeting that has one at the scheduled time

To see every webhook Recall sent and whether it was delivered, open Webhooks in the Recall.ai dashboard.

## Schedule Modes

Each calendar has one setting for which meetings automatically get a bot:

| Mode                                | A meeting gets a bot when…                                            |
| ----------------------------------- | --------------------------------------------------------------------- |
| Manually (default)                  | never; bots are only added by hand                                    |
| Every meeting                       | it has a meeting link                                                 |
| When I organized it                 | you're the organizer                                                  |
| When there are external guests      | someone outside your email domain is invited                          |
| When there are only internal guests | other people from your domain are invited, and no one from outside it |

Changing the mode applies it to the calendar's upcoming meetings (the next 28 days) straight away; after that, the `calendar.sync_events` webhook applies it as meetings change. Bots added by hand are kept whatever the mode.

## Routes

| Method | Endpoint                       | Description                                     |
| ------ | ------------------------------ | ----------------------------------------------- |
| GET    | `/api/auth/sign-in/google`     | Start Google Calendar OAuth                     |
| GET    | `/api/auth/callback/google`    | Google OAuth callback; connects the calendar    |
| GET    | `/api/auth/sign-in/microsoft`  | Start Microsoft Outlook OAuth                   |
| GET    | `/api/auth/callback/microsoft` | Microsoft OAuth callback; connects the calendar |
| POST   | `/api/webhooks/recall`         | Recall.ai webhook receiver                      |

The UI calls server actions in `src/app/action.ts` for everything else:

| Server action               | Description                                                       |
| --------------------------- | ----------------------------------------------------------------- |
| `save_calendar_settings`    | Save a calendar's schedule mode and bot settings                  |
| `remove_calendar`           | Delete a calendar via Recall's `DELETE /api/v2/calendars/{id}`    |
| `save_meeting_bot`          | Add a bot to a meeting, or change its settings                    |
| `remove_meeting_bot_action` | Remove a meeting's bot and skip the meeting from now on           |
| `follow_schedule_mode`      | Drop a meeting's override so the calendar's schedule mode decides |

## Project Structure

```
calendar_v2_next/
├── drizzle/                    # Database migrations (run when the server starts)
├── src/
│   ├── app/
│   │   ├── action.ts           # Server actions (validate input, call lib/scheduling)
│   │   ├── api/auth/           # OAuth sign-in and callback routes
│   │   ├── api/webhooks/       # Recall.ai webhook receiver
│   │   └── page.tsx            # Home page
│   ├── components/             # UI components
│   ├── db/                     # Drizzle schema and queries (SQLite)
│   ├── lib/
│   │   ├── env.ts              # Environment validation
│   │   ├── oauth/              # Google and Microsoft OAuth
│   │   ├── recall/             # Recall.ai API calls (⬇ see table below)
│   │   ├── scheduling/         # Which meetings get a bot (⬇ see table below)
│   │   └── settings.ts         # Schedule mode labels and default settings
│   └── schemas/                # Data validation models
└── package.json
```

### `src/lib/recall/` — Recall.ai API

This is where the Recall.ai integration lives. It only depends on `src/lib/env.ts` and `src/schemas/`, so you can copy it into your own codebase:

| File           | Purpose                                                                                                                                                                                               |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `client.ts`    | Authenticated requests to Recall.ai, retrying `409`, `429` and `507` responses, and following pagination.                                                                                             |
| `calendar.ts`  | Calendars (`POST`/`GET`/`PATCH`/`DELETE /api/v2/calendars`), calendar events (`GET /api/v2/calendar-events`), and scheduling a bot for an event (`POST`/`DELETE /api/v2/calendar-events/{id}/bot`). |
| `bot.ts`       | Retrieving a bot, the deduplication key, and whether a scheduled bot still matches its event.                                                                                                         |
| `raw_event.ts` | Reading the provider's event in `raw`: its title, guests and organizer, which look different for Google Calendar and Outlook.                                                                         |
| `webhook.ts`   | Verifying that a webhook came from Recall.ai.                                                                                                                                                         |

### `src/lib/scheduling/` — Which Meetings Get a Bot

This app's logic on top of the API. Adapt it to how your app decides which meetings get a bot:

| File              | Purpose                                                                                                                                               |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `decision.ts`     | **Core logic.** Whether an event should have a bot: no meeting link means no bot, then the meeting's override, then the calendar's schedule mode. |
| `sync.ts`         | Makes an event's bot in Recall match that decision: adds, removes or moves it. Runs for each event a `calendar.sync_events` webhook reports.           |
| `bot_config.ts`   | Turns the app's bot settings into a Create Bot config, and reads them back from a scheduled bot.                                                      |
| `calendars.ts`    | Saves a calendar's settings (applying a changed schedule mode to upcoming meetings), and deletes a calendar.                                          |
| `meeting_bots.ts` | Adds, changes or removes one meeting's bot by hand, and saves the matching override.                                                                  |
| `upcoming.ts`     | The events the week calendar shows, with each one's bot and decision.                                                                                 |

## Local State

The app keeps its own state in a local SQLite database (`data/app.db`, git-ignored) using [Drizzle](https://orm.drizzle.team). Recall is the source of truth for calendars and events, so the app reads them from Recall and doesn't copy them. The database only holds what this app decides:

| Table               | What it stores                                                                                              |
| ------------------- | ----------------------------------------------------------------------------------------------------------- |
| `calendar_settings` | Each calendar's schedule mode and the settings for its bots. A calendar without a row uses the defaults.    |
| `event_overrides`   | Per-meeting "always" / "never" choices from adding or removing a bot by hand, which beat the schedule mode. |
| `bot_decisions`     | Every bot sent, moved or removed, with the reason and what triggered it. Shown in the activity feed.        |

```bash
npm run db:generate   # after changing src/db/schema.ts
npm run db:migrate    # apply migrations without starting the server
npm run db:studio     # browse the database
```

## Bot Deduplication

The app uses meeting-level deduplication:

```typescript
deduplication_key = `${start_time}-${meeting_url}`;
```

This ensures only one bot joins per meeting, even if multiple connected calendars have the same event. See `generate_bot_deduplication_key()` in `src/lib/recall/bot.ts`, and the [`calendar_v2`](../calendar_v2) README for user-level and domain-level strategies.

Each bot also records who added it in its `scheduled_by` metadata (`schedule_mode` or `manual`), so changing a calendar's schedule mode never removes a bot the user added by hand.
