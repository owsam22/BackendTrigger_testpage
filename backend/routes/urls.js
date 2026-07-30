const express = require("express");
const UrlSubmission = require("../models/UrlSubmission");
const { protect } = require("../middleware/auth");

const router = express.Router();

const FREE_TIER_LIMIT = 2;

const isValidUrl = (str) => {
  try {
    const u = new URL(str);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};

// List the logged-in user's own submissions
router.get("/", protect, async (req, res) => {
  const urls = await UrlSubmission.find({ owner: req.user._id }).sort({ createdAt: -1 });
  res.json({ urls });
});

// Submit a new URL (goes in as "pending" until admin approves)
router.post("/", protect, async (req, res) => {
  try {
    const { url, label } = req.body;

    if (!url || !isValidUrl(url)) {
      return res.status(400).json({ message: "Please provide a valid http/https URL" });
    }

    // Pro plan isn't wired up yet — everyone is capped at the free tier limit for now.
    const existingCount = await UrlSubmission.countDocuments({ owner: req.user._id });
    if (existingCount >= FREE_TIER_LIMIT) {
      return res.status(403).json({
        message: `Free tier is limited to ${FREE_TIER_LIMIT} URLs. Pro plan (unlimited) is coming soon.`,
      });
    }

    const submission = await UrlSubmission.create({
      owner: req.user._id,
      url,
      label: label || "",
      status: "pending",
    });

    res.status(201).json({ submission });
  } catch (err) {
    res.status(500).json({ message: "Failed to submit URL", error: err.message });
  }
});

// Delete own submission (only if it's still pending or rejected — approved ones
// should go through admin so the active ping list stays under admin control)
router.delete("/:id", protect, async (req, res) => {
  const doc = await UrlSubmission.findOne({ _id: req.params.id, owner: req.user._id });
  if (!doc) return res.status(404).json({ message: "Submission not found" });

  if (doc.status === "approved") {
    return res.status(403).json({ message: "Ask an admin to remove an approved URL" });
  }

  await doc.deleteOne();
  res.json({ message: "Submission removed" });
});

module.exports = router;
