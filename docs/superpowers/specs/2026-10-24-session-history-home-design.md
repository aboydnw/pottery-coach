# Session History Home Design

## Goal

Make it easy to leave a completed session, begin another session without deleting history, revisit recent sessions, and understand the product without crowding the home screen.

## Navigation and authentication

Cloudflare Access continues to protect the entire application hostname. Authentication therefore happens before the React application, including Home and About, loads. The app will not add a second login system.

The application has four user-visible destinations:

- Home at `/`, with the primary start action and recent sessions.
- About at `/about`, with the explanatory, privacy, safety, and storage copy removed from Home.
- Live session at `/session/live`.
- Completed-session review at `/session/review/:sessionId`.

History navigation uses the browser History API and restores the matching view on back/forward navigation. Unknown, expired, or deleted review IDs return the user to Home with a short unavailable message.

## Home

Home uses a compact header with the Pottery Coach name and an About link. A prominent **Start Session** button appears before a newest-first **Past Sessions** list.

Each retained detailed session row shows its date and time, duration when available, outcome, and number of recorded pieces. Selecting a row opens its detailed review. Sessions without an end time are described as interrupted rather than presented as successful completions. When no sessions exist, the list has a concise empty state.

Detailed session history follows the existing 30-day local retention policy. The app does not imply that expired detailed reviews can be restored from the longer-lived throw log.

## Completed-session review

The review begins with session details and an action group that remains near the top of the page:

1. **Start New Session** is the primary action. It preserves the completed session, resets transient live-session state, and enters a fresh live session.
2. **Delete Session** is secondary. It reveals a compact inline confirmation in the existing action area without pushing controls below the viewport. Confirmation deletes the selected session and its associated throw-log pieces, then returns Home with a deletion status.
3. **Go Home** is secondary. It preserves the completed session and returns Home.

The charts, timeline, marked moments, and piece notes remain below the actions.

## About

About contains the explanatory copy formerly on Home:

- voice-first operation and headphones;
- starting with an empty wheel;
- on-device camera processing and the fact that the app is not safety equipment;
- cloud voice processing when enabled;
- saved pot summaries and the detailed-session retention boundary.

It provides clear Home and Start Session actions.

## Data and state behavior

Starting another session and deleting a session become separate state-machine events. A new session resets the recorder, piece hook, completed bundle, and setup store, then starts voice from the user gesture. It does not call deletion services.

The repository remains the source of truth for retained detailed sessions. The home history view combines repository session records with throw-log pieces grouped by session ID. Opening a review loads the complete bundle by ID. Deleting a historical session targets that ID rather than the recorder's current session ID.

## Accessibility and responsive behavior

Actions remain at least 44 pixels high, have explicit button/link labels, and wrap without stacking hidden confirmation controls below the viewport. Status messages use appropriate live-region roles. The mobile layout keeps the primary action first and gives the action group deliberate spacing.

## Verification

Automated coverage will prove:

- the lifecycle distinguishes Home, About, new-session reset, and deletion;
- retained sessions are listed newest-first with grouped piece counts;
- a retained session can be loaded into review;
- starting a new session does not invoke deletion;
- deletion confirms inline, targets the selected session, and returns Home;
- About contains the moved explanatory content;
- formatting, lint, type checks, build, and browser tests remain green.
