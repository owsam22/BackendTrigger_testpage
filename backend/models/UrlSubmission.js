const mongoose = require("mongoose");

const UrlSubmissionSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    label: { type: String, trim: true, default: "" },
    url: { type: String, required: true, trim: true },

    // pending -> waiting for admin approval
    // approved -> actively pinged every PING_INTERVAL_MINUTES
    // rejected -> admin declined it, never pinged
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    // true for urls the admin added directly (auto-approved, bypasses the 2-link free cap)
    addedByAdmin: { type: Boolean, default: false },

    lastPingedAt: { type: Date, default: null },
    lastStatus: { type: String, default: null }, // e.g. "200 OK" or "ERROR: timeout"
    pingCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("UrlSubmission", UrlSubmissionSchema);
