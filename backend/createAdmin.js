require("dotenv").config();

const mongoose = require("mongoose");
const User = require("./models/User");

async function createAdmin() {
  try {
    // Check if Mongo URI exists
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI not found in .env file");
    }

    // Connect MongoDB
    await mongoose.connect(process.env.MONGO_URI);

    console.log("✅ MongoDB Connected");

    // Check existing admin
    const existingAdmin = await User.findOne({
      email: "admin@nimbus.com",
    });

    if (existingAdmin) {
      console.log("⚠️ Admin already exists");
      console.log("Email: admin@nimbus.com");
      process.exit(0);
    }

    // Create admin
    const admin = await User.create({
      name: "Admin",
      email: "admin@nimbus.com",
      password: "123456",
      role: "admin",
      isVerified: true,
      isActive: true,
    });

    console.log("\n🎉 Admin Created Successfully!");
    console.log("-----------------------------");
    console.log("Email    : admin@nimbus.com");
    console.log("Password : 123456");
    console.log("Role     : admin");
    console.log("-----------------------------");

    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err.message);
    await mongoose.connection.close().catch(() => {});
    process.exit(1);
  }
}

createAdmin();
