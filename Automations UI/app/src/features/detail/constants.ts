import type { EventStatus } from "@/model/types";

/* ---------------- constants (AutomationViewPage-CI_ytw7M.js var block, module lines 1204-1229) ---------------- */
export const COLOR_SUCCESS = "rgb(var(--text-green))";
export const COLOR_FAILURE = "rgb(var(--text-red))";
export const COLOR_SKIPPED = "rgb(var(--text-secondary))";
export const COLOR_PROGRESS = "rgb(var(--text-blue))";
/** `kr = 3e4` — activity polling interval while queued/running rows exist. */
export const POLL_INTERVAL_MS = 30_000;
/** `Ar = 5e3` — activity page cap. */
export const ACTIVITY_LIMIT = 5000;
/** `jr = 11520 * 60 * 1e3` — spans at or below eight days bucket hourly. */
export const HOURLY_MAX_MS = 11520 * 60 * 1000;
export const EVENTS_PAGE = 50;
/** Issue sheet linked-invocation request cap (module line 2527). */
export const INVOCATIONS_LIMIT = 100;
/** USD per ACU used when `consumptionDisplay === "usd"` (the shipped shared formatter is not in evidence). */
export const USD_PER_ACU = 2.25;
export const STATUS_ORDER: { value: EventStatus; labelKey: string }[] = [
  { value: "queued", labelKey: "statusQueued" }, { value: "running", labelKey: "statusRunning" }, { value: "succeeded", labelKey: "statusSucceeded" },
  { value: "failed", labelKey: "statusFailed" }, { value: "skipped", labelKey: "statusSkipped" }, { value: "canceled", labelKey: "statusCanceled" },
];
