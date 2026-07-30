const mongoose = require("mongoose");

// Single-document collection used to remember the last time a full
// ping cycle ran. This is what lets the service "resume" correctly:
// when the process boots (fresh deploy, Render waking from sleep, crash
// restart, whatever), server.js reads lastPulseAt from here and, if it's
// older than the configured interval, fires an immediate ping cycle
// before falling back to the normal cron schedule.
const MetaSchema = new mongoose.Schema({
  key: { type: String, unique: true, default: "pulse" },
  lastPulseAt: { type: Date, default: null },
  lastPulseCount: { type: Number, default: 0 }, // how many urls were pinged last cycle
});

module.exports = mongoose.model("Meta", MetaSchema);
