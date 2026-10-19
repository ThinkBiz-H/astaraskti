const mongoose = require("mongoose");
const logger = require("../utils/logger");

const connectDB = async () => {
  try {
    mongoose.set("strictQuery", true);

    const conn = await mongoose.connect(process.env.MONGO_URI);

    logger.info(`MongoDB Connected: ${conn.connection.host}`);

    mongoose.connection.on("error", (err) => {
      logger.error(`MongoDB connection error: ${err.message}`);
    });

    mongoose.connection.on("disconnected", () => {
      logger.warn("MongoDB disconnected");
    });

    return conn;
  } catch (error) {
    logger.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
