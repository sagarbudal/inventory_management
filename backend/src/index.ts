import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import apiRoutes from "./routes/index.js";
import { runSeed } from "./seed.js";
import { connectMongo } from "./db/connect.js";

dotenv.config();

const PORT = parseInt(process.env.PORT || "3001", 10);
const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  console.error("[Backend] MONGODB_URI is required. Set it in backend/.env");
  process.exit(1);
}

const MONGODB_URI: string = mongoUri;

const frontendOrigins = (process.env.FRONTEND_URL || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const app = express();

app.use(
  cors({
    origin: frontendOrigins,
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", apiRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: "API route not found" });
});

async function start() {
  try {
    await connectMongo(MONGODB_URI);
    console.log("[Backend] Connected to MongoDB");

    await runSeed();

    app.listen(PORT, () => {
      console.log(`[Backend] API server running at http://localhost:${PORT}`);
      console.log(`[Backend] CORS allowed for: ${frontendOrigins.join(", ")}`);
    });
  } catch (err) {
    console.error("[Backend] Failed to start:", err);
    console.error(
      "[Backend] Check: 1) MongoDB Atlas cluster is running  2) Network Access allows your IP  3) MONGODB_URI in backend/.env is correct"
    );
    process.exit(1);
  }
}

start();
