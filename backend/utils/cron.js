const cron = require("node-cron");
const Meta = require("../models/Meta");
const { runPingCycle } = require("./pinger");

const INTERVAL_MINUTES = parseInt(process.env.PING_INTERVAL_MINUTES || "13", 10);

/**
 * Sets up the recurring cron job AND handles the "resume after sleep /
 * restart" behaviour:
 *
 * On boot, we check Meta.lastPulseAt. If it's missing, or older than one
 * full interval, that means the service was asleep/down/freshly deployed
 * and missed cycles — so we fire a ping cycle immediately (this both
 * wakes up every submitted backend right away AND re-establishes the
 * self-ping so Render doesn't go back to sleep before the next scheduled
 * tick). After that immediate catch-up run, the normal cron schedule
 * takes over.
 */
async function initCronAndResume() {
  const meta = await Meta.findOne({ key: "pulse" });
  const now = Date.now();
  const intervalMs = INTERVAL_MINUTES * 60 * 1000;

  const isStale =
    !meta || !meta.lastPulseAt || now - new Date(meta.lastPulseAt).getTime() > intervalMs;

  if (isStale) {
    console.log("[CRON] no recent pulse found on boot — running an immediate catch-up cycle");
    runPingCycle("boot-resume").catch((err) =>
      console.error("[CRON] boot resume cycle failed:", err.message)
    );
  } else {
    console.log("[CRON] recent pulse found on boot — waiting for next scheduled tick");
  }

  // node-cron doesn't support "every N minutes" > 59 directly via a single
  // field cleanly for arbitrary N, so build the expression dynamically.
  const expression = `*/${INTERVAL_MINUTES} * * * *`;
  cron.schedule(expression, () => {
    runPingCycle("scheduled").catch((err) =>
      console.error("[CRON] scheduled cycle failed:", err.message)
    );
  });

  console.log(`[CRON] scheduled ping cycle every ${INTERVAL_MINUTES} minute(s) ("${expression}")`);
}

module.exports = { initCronAndResume, INTERVAL_MINUTES };
