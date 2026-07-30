const axios = require("axios");
const UrlSubmission = require("../models/UrlSubmission");
const Meta = require("../models/Meta");

const PING_TIMEOUT_MS = 15000;

/**
 * Pings a single URL and records the result on the document.
 */
async function pingOne(doc) {
  const startedAt = Date.now();
  let statusText;

  try {
    const res = await axios.get(doc.url, {
      timeout: PING_TIMEOUT_MS,
      // Some free-tier hosts respond with non-2xx while still "waking up" fine.
      // We don't want axios throwing on 4xx, only on network-level failures.
      validateStatus: () => true,
      headers: { "User-Agent": "render-pulse-keepalive/1.0" },
    });
    statusText = `${res.status} ${res.statusText || ""}`.trim();
  } catch (err) {
    statusText = `ERROR: ${err.code || err.message}`;
  }

  const tookMs = Date.now() - startedAt;

  doc.lastPingedAt = new Date();
  doc.lastStatus = statusText;
  doc.pingCount = (doc.pingCount || 0) + 1;
  await doc.save();

  console.log(`[PING] ${doc.url} -> ${statusText} (${tookMs}ms)`);
  return { url: doc.url, status: statusText, tookMs };
}

/**
 * Pings this backend's own public URL. This is what actually keeps a
 * Render free-tier service awake — an internal setInterval alone does
 * NOT count as inbound traffic once Render decides to spin the dyno
 * down, but a real external HTTP request to /health does.
 */
async function pingSelf() {
  const selfUrl = process.env.SELF_URL;
  if (!selfUrl) return null;

  try {
    const target = selfUrl.replace(/\/+$/, "") + "/api/health";
    const res = await axios.get(target, { timeout: PING_TIMEOUT_MS });
    console.log(`[SELF-PING] ${target} -> ${res.status}`);
    return { url: target, status: res.status };
  } catch (err) {
    console.log(`[SELF-PING] failed -> ${err.code || err.message}`);
    return { url: selfUrl, status: `ERROR: ${err.code || err.message}` };
  }
}

/**
 * Runs one full ping cycle: self-ping + every approved submitted URL.
 * Also stamps Meta.lastPulseAt so we know when the last cycle happened,
 * which is how we detect "we've been asleep/off" on the next boot.
 */
async function runPingCycle(reason = "scheduled") {
  console.log(`[CYCLE] starting ping cycle (reason: ${reason})`);

  await pingSelf();

  const approvedUrls = await UrlSubmission.find({ status: "approved" });
  const results = [];
  for (const doc of approvedUrls) {
    // sequential on purpose — gentle on free-tier hosts, avoids a thundering herd
    results.push(await pingOne(doc));
  }

  await Meta.findOneAndUpdate(
    { key: "pulse" },
    { lastPulseAt: new Date(), lastPulseCount: results.length },
    { upsert: true }
  );

  console.log(`[CYCLE] complete — pinged ${results.length} submitted url(s)`);
  return results;
}

/**
 * Pings a single freshly-approved submission immediately, without
 * waiting for the next scheduled cycle. Used right after admin approval.
 */
async function pingSubmissionNow(submissionId) {
  const doc = await UrlSubmission.findById(submissionId);
  if (!doc || doc.status !== "approved") return null;
  return pingOne(doc);
}

module.exports = { runPingCycle, pingOne, pingSelf, pingSubmissionNow };
