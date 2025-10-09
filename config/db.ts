import mongoose from "mongoose";

const uri = "mongodb+srv://vadic:vadic@vadic.v8uuhwt.mongodb.net/vadic";

const connectDB = async () => {
  try {
    await mongoose.connect(uri);
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
};

export default connectDB;