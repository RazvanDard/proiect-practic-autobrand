import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

/**
 * Scheduled Convex jobs.
 *
 * - **scrape-products** — runs every hour at minute 0 for the UTC hours that
 *   can map to 12:00-18:00 in Europe/Bucharest. Convex crons run in UTC, so
 *   `runScrapeCron` also gates by Bucharest local time to handle DST.
 *
 * - **refresh-fx** — pulls BNR rates once a day. Cheap, but we keep the
 *   cadence conservative because the data only updates ~once per business
 *   day anyway.
 */
const crons = cronJobs();

crons.cron(
  "scrape-products",
  "0 9,10,11,12,13,14,15,16 * * *",
  internal.scrape.runScrapeCron,
);

crons.daily("refresh-fx", { hourUTC: 6, minuteUTC: 30 }, internal.exchange.refreshFxCron);

export default crons;
