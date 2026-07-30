const express = require("express");
const UrlSubmission = require("../models/UrlSubmission");
const User = require("../models/User");
const Meta = require("../models/Meta");
const { protect, adminOnly } = require("../middleware/auth");
const { runPingCycle, pingSubmissionNow } = require("../utils/pinger");
const { INTERVAL_MINUTES } = require("../utils/cron");

const router = express.Router();

router.use(protect, adminOnly);

// All submissions across all users, with owner info
router.get("/urls", async (req, res) => {
  const urls = await UrlSubmission.find()
    .populate("owner", "name email isAdmin")
    .sort({ createdAt: -1 });
  res.json({ urls });
});

// Approve a pending submission -> becomes actively pinged, and we ping it
// immediately rather than waiting for the next scheduled cycle.
router.patch("/urls/:id/approve", async (req, res) => {
  const doc = await UrlSubmission.findById(req.params.id);
  if (!doc) return res.status(404).json({ message: "Submission not found" });

  doc.status = "approved";
  await doc.save();

  pingSubmissionNow(doc._id).catch((err) =>
    console.error("[ADMIN] immediate ping after approval failed:", err.message)
  );

  res.json({ submission: doc });
});

router.patch("/urls/:id/reject", async (req, res) => {
  const doc = await UrlSubmission.findById(req.params.id);
  if (!doc) return res.status(404).json({ message: "Submission not found" });

  doc.status = "rejected";
  await doc.save();
  res.json({ submission: doc });
});

// Admin can add any number of URLs directly — auto-approved immediately,
// not counted against any user's free tier cap.
router.post("/urls", async (req, res) => {
  try {
    const { url, label } = req.body;
    if (!url) return res.status(400).json({ message: "url is required" });

    const doc = await UrlSubmission.create({
      owner: req.user._id,
      url,
      label: label || "",
      status: "approved",
      addedByAdmin: true,
    });

    pingSubmissionNow(doc._id).catch((err) =>
      console.error("[ADMIN] immediate ping after admin-add failed:", err.message)
    );

    res.status(201).json({ submission: doc });
  } catch (err) {
    res.status(500).json({ message: "Failed to add URL", error: err.message });
  }
});

router.delete("/urls/:id", async (req, res) => {
  const doc = await UrlSubmission.findById(req.params.id);
  if (!doc) return res.status(404).json({ message: "Submission not found" });
  await doc.deleteOne();
  res.json({ message: "Deleted" });
});

// All users (so admin can see who to promote in MongoDB, or just review accounts)
router.get("/users", async (req, res) => {
  const users = await User.find().select("-password").sort({ createdAt: -1 });
  res.json({ users });
});

// Manually force a full ping cycle right now
router.post("/trigger-now", async (req, res) => {
  const results = await runPingCycle("manual-admin-trigger");
  res.json({ message: "Ping cycle triggered", results });
});

// Quick status snapshot: last pulse time, interval config, counts
router.get("/status", async (req, res) => {
  const meta = await Meta.findOne({ key: "pulse" });
  const [approvedCount, pendingCount, rejectedCount] = await Promise.all([
    UrlSubmission.countDocuments({ status: "approved" }),
    UrlSubmission.countDocuments({ status: "pending" }),
    UrlSubmission.countDocuments({ status: "rejected" }),
  ]);

  res.json({
    intervalMinutes: INTERVAL_MINUTES,
    lastPulseAt: meta?.lastPulseAt || null,
    lastPulseCount: meta?.lastPulseCount || 0,
    approvedCount,
    pendingCount,
    rejectedCount,
  });
});

module.exports = router;
