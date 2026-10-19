require("dotenv").config();

const app = require("./app");
const connectDB = require("./config/db");
const {
  startScheduler,
  stopScheduler,
} = require("./services/scheduler.service");
const seedAdmin = require("./seed/adminSeeder");

const PORT = process.env.PORT || 5000;

let server;

const startServer = async () => {
  try {
    console.clear();

    console.log("==========================================");
    console.log("🚀 E-COMMERCE BACKEND");
    console.log("==========================================");

    console.log(`🌍 Environment : ${process.env.NODE_ENV || "development"}`);
    console.log("🔌 Connecting MongoDB...");

    await connectDB();

    // ⭐ ADMIN CREATE
    await seedAdmin();

    server = app.listen(PORT, () => {
      console.log("✅ MongoDB Connected");
      console.log(`🚀 Server Running : http://localhost:${PORT}`);
      console.log(`❤️ Health Check : http://localhost:${PORT}/health`);
      console.log(`📦 API Base URL : http://localhost:${PORT}/api/v1`);
      console.log("==========================================");

      startScheduler();
    });
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

startServer();
