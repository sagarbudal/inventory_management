import {
  Video,
  Equipment,
  Assignment,
  CustomFolder,
  AuthorizedUser,
} from "./models/index.js";
import { backfillEquipment, syncEquipmentAvailability } from "./lib/equipmentHelpers.js";

const DEFAULT_USERS = [
  { email: "budalsagar2020@gmail.com", password: "password123", role: "Admin" as const, name: "Sagar Budal" },
  { email: "admin@cantordust.com", password: "cantordust123", role: "Admin" as const, name: "Cantor Admin" },
  { email: "supervisor@cantordust.com", password: "password123", role: "Supervisor" as const, name: "Cantor Supervisor" },
  { email: "user@cantordust.com", password: "password123", role: "User" as const, name: "Cantor Operator" },
];

/** Ensure MongoDB has default data when collections are empty. No file-based storage. */
export async function runSeed(): Promise<void> {
  const userCount = await AuthorizedUser.countDocuments();

  if (userCount === 0) {
    console.log("[MongoDB] Seeding default authorized users...");
    await AuthorizedUser.insertMany(DEFAULT_USERS);
  }

  const allEquipment = await Equipment.find();
  for (const eq of allEquipment) {
    await backfillEquipment(eq);
  }

  await syncEquipmentAvailability();

  const [videos, equipment, assignments, folders] = await Promise.all([
    Video.countDocuments(),
    Equipment.countDocuments(),
    Assignment.countDocuments(),
    CustomFolder.countDocuments(),
  ]);

  console.log(
    `[MongoDB] Ready — videos: ${videos}, equipment: ${equipment}, assignments: ${assignments}, folders: ${folders}, users: ${await AuthorizedUser.countDocuments()}`
  );
}
