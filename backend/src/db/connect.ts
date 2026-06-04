import mongoose from "mongoose";

export async function connectMongo(primaryUri: string): Promise<void> {
  const fallbackUri = process.env.MONGODB_URI_DIRECT;
  const options = {
    serverSelectionTimeoutMS: 15000,
    socketTimeoutMS: 45000,
  };

  try {
    await mongoose.connect(primaryUri, options);
    return;
  } catch (firstError) {
    if (fallbackUri && fallbackUri !== primaryUri) {
      console.warn("[Backend] Primary MongoDB URI failed, trying MONGODB_URI_DIRECT...");
      await mongoose.connect(fallbackUri, options);
      return;
    }
    throw firstError;
  }
}
