import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

/**
 * Scheduled Convex jobs.
 *
 * - **scrape-products** — runs every hour at minute 0 between 12:00 and 18:00
 *   server-time, matching the brief's `12:00–18:00 hourly`. Convex crons run
 *   in UTC; if you need RO local time, adjust the hour range here.
 *
 * - **refresh-fx** — pulls BNR rates once a day. Cheap, but we keep the
 *   cadence conservative because the data only updates ~once per business
 *   day anyway.
 */
const crons = cronJobs();

crons.cron(
  "scrape-products",
  "0 12,13,14,15,16,17,18 * * *",
  internal.scrape.runScrapeCron,
);

crons.daily("refresh-fx", { hourUTC: 6, minuteUTC: 30 }, internal.exchange.refreshFxCron);

export default crons;
