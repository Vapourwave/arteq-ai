/**
 * Client-demo / kiosk presentation configuration.
 *
 * The kiosk normally runs with the development presence detector (no camera),
 * which is also the mode used to drive a live client demo. That must NOT mean
 * the client sees developer-only affordances. Dev tools are therefore gated
 * behind an explicit opt-in flag instead of the presence mode.
 *
 * Set `VITE_SHOW_DEV_TOOLS=true` in apps/kiosk/.env to bring them back for
 * local development; leave it unset (the default) for anything a client sees.
 */
export const SHOW_DEV_TOOLS = import.meta.env.VITE_SHOW_DEV_TOOLS === "true";
