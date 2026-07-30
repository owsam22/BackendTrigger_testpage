const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("[DB] MongoDB connected");
  } catch (err) {
    console.error("[DB] MongoDB connection error:", err.message);
    // Retry after a delay instead of crashing the whole process forever
    setTimeout(connectDB, 5000);
  }
};

module.exports = connectDB;
