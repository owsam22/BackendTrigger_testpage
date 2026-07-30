require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const { initCronAndResume } = require("./utils/cron");
const User = require("./models/User");

const authRoutes = require("./routes/auth");
const urlRoutes = require("./routes/urls");
const adminRoutes = require("./routes/admin");

const app = express();

app.use(express.json());

// FRONTEND_URL can be a comma separated list for multiple allowed origins
// (e.g. your Vercel prod URL + preview deployments + localhost while developing)
const allowedOrigins = (process.env.FRONTEND_URL || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

// Health check — this is also the endpoint the self-pinger hits to keep
// the Render service awake.
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/urls", urlRoutes);
app.use("/api/admin", adminRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "Not found" });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("[ERROR]", err.message);
  res.status(500).json({ message: "Something went wrong", error: err.message });
});

const PORT = process.env.PORT || 5000;

async function bootstrapAdmin() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!email || !password) return;

  let user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    user = await User.create({ name: "Admin", email, password, isAdmin: true });
    console.log(`[BOOTSTRAP] created admin account for ${email}`);
  } else if (!user.isAdmin) {
    user.isAdmin = true;
    await user.save();
    console.log(`[BOOTSTRAP] promoted ${email} to admin`);
  }
}

async function start() {
  await connectDB();
  await bootstrapAdmin();
  await initCronAndResume();

  app.listen(PORT, () => {
    console.log(`[SERVER] listening on port ${PORT}`);
  });
}

start();
