import { Router, Request, Response } from "express";
import {
  Video,
  Equipment,
  Assignment,
  CustomFolder,
  AuthorizedUser,
} from "../models/index.js";
import { getNextSequence } from "../lib/counter.js";
import {
  backfillEquipment,
  buildEquipmentPrefix,
  syncEquipmentAvailability,
} from "../lib/equipmentHelpers.js";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({ ok: true, database: "mongodb" });
});

router.get("/videos", async (_req, res) => {
  const videos = await Video.find().sort({ id: 1 }).lean();
  res.json(videos);
});

router.post("/videos", async (req, res) => {
  const { name, unique_code, duration, status, category, sub_category, created_at } = req.body;
  if (!name || !unique_code || !duration || !status || !category) {
    return res.status(400).json({ error: "All parameters are required" });
  }
  const codeUpper = String(unique_code).trim().toUpperCase();
  const exists = await Video.findOne({ unique_code: codeUpper });
  if (exists) {
    return res.status(400).json({ error: `A video with unique code '${codeUpper}' already exists.` });
  }
  const id = await getNextSequence("video_id");
  const newVideo = await Video.create({
    id,
    name: String(name).trim(),
    unique_code: codeUpper,
    duration: parseFloat(duration) || 0,
    status: String(status).toLowerCase(),
    category: String(category).trim(),
    sub_category: sub_category ? String(sub_category).trim() : "",
    created_at: created_at || new Date().toISOString(),
  });
  res.status(201).json(newVideo);
});

router.put("/videos/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const video = await Video.findOne({ id });
  if (!video) return res.status(404).json({ error: "Video not found" });

  const { name, unique_code, duration, status, category, sub_category } = req.body;
  if (name !== undefined) video.name = String(name).trim();
  if (unique_code !== undefined) video.unique_code = String(unique_code).trim().toUpperCase();
  if (duration !== undefined) video.duration = parseFloat(duration) || 0;
  if (status !== undefined) video.status = String(status).toLowerCase();
  if (category !== undefined) video.category = String(category).trim();
  if (sub_category !== undefined) video.sub_category = sub_category ? String(sub_category).trim() : "";

  await video.save();
  res.json(video);
});

router.delete("/videos/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const deleted = await Video.findOneAndDelete({ id });
  if (!deleted) return res.status(404).json({ error: "Video record not found." });
  res.json({ success: true, deleted });
});

router.post("/videos/bulk-delete", async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) {
    return res.status(400).json({ error: "Invalid parameters. 'ids' must be an array of numbers." });
  }
  const filterIds = ids.map((i: unknown) => parseInt(String(i), 10)).filter((i) => !isNaN(i));
  const result = await Video.deleteMany({ id: { $in: filterIds } });
  res.json({ success: true, count: result.deletedCount ?? filterIds.length });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }
  const normalized = String(email).trim();
  const user = await AuthorizedUser.findOne({
    email: { $regex: new RegExp(`^${normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
  });
  if (!user) {
    return res.status(401).json({
      error: "Access Denied: This email does not have authorized access to view or edit this platform.",
    });
  }
  if (user.password !== password) {
    return res.status(401).json({ error: "Incorrect password. Please verify and try again." });
  }
  res.json({
    success: true,
    email: user.email,
    name: user.name || "Operator Team",
    role: user.role,
  });
});

router.get("/users", async (_req, res) => {
  const users = await AuthorizedUser.find().sort({ email: 1 }).lean();
  res.json(users);
});

router.post("/users/add", async (req, res) => {
  const { email, name, role, password } = req.body;
  if (!email || !role) {
    return res.status(400).json({ error: "Email and Role are required." });
  }
  const normalized = String(email).trim();
  const exists = await AuthorizedUser.findOne({
    email: { $regex: new RegExp(`^${normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
  });
  if (exists) {
    return res.status(400).json({ error: "This email is already in the access list." });
  }
  const newUser = await AuthorizedUser.create({
    email: String(email).trim(),
    name: name ? String(name).trim() : "Team Member",
    password: password ? String(password).trim() : "password123",
    role,
  });
  res.status(201).json(newUser);
});

router.delete("/users", async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email parameter is required to delete." });
  }
  const normalized = String(email).trim();
  const deleted = await AuthorizedUser.findOneAndDelete({
    email: { $regex: new RegExp(`^${normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
  });
  if (!deleted) {
    return res.status(404).json({ error: "User with this email not found." });
  }
  res.json({ success: true, message: `Removed access for ${email}` });
});

router.get("/custom-folders", async (_req, res) => {
  const folders = await CustomFolder.find().sort({ id: 1 }).lean();
  res.json(folders);
});

router.post("/custom-folders", async (req, res) => {
  const { category, sub_category } = req.body;
  if (!category || !String(category).trim()) {
    return res.status(400).json({ error: "Category/Folder name is required." });
  }
  const trimmedCat = String(category).trim();
  const trimmedSub = sub_category ? String(sub_category).trim() : "";

  const exists = await CustomFolder.findOne({
    category: new RegExp(`^${trimmedCat.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
    sub_category: trimmedSub,
  });
  if (exists) {
    return res.status(400).json({
      error: `Manual folder structure "${trimmedCat}${trimmedSub ? " > " + trimmedSub : ""}" already exists.`,
    });
  }

  const id = await getNextSequence("custom_folder_id");
  const newFolder = await CustomFolder.create({
    id,
    category: trimmedCat,
    sub_category: trimmedSub,
  });
  res.status(201).json(newFolder);
});

router.delete("/custom-folders/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const deleted = await CustomFolder.findOneAndDelete({ id });
  if (!deleted) return res.status(404).json({ error: "Custom folder not found" });
  res.json({ success: true, deleted });
});

router.get("/equipment", async (_req, res) => {
  const equipment = await Equipment.find().sort({ id: 1 }).lean();
  res.json(equipment);
});

router.post("/equipment", async (req, res) => {
  const { equipment_name, total_quantity, unique_prefix } = req.body;
  if (!equipment_name || total_quantity === undefined) {
    return res.status(400).json({ error: "equipment_name and total_quantity are required" });
  }
  const qty = parseInt(String(total_quantity), 10);
  if (isNaN(qty) || qty <= 0) {
    return res.status(400).json({ error: "Quantity must be a positive integer" });
  }

  const nameTrim = String(equipment_name).trim();
  const existing = await Equipment.findOne({
    equipment_name: new RegExp(`^${nameTrim.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
  });

  const reqPrefix = (unique_prefix || "").trim().toUpperCase();

  if (existing) {
    const activePrefix =
      existing.unique_prefix || reqPrefix || buildEquipmentPrefix(nameTrim);
    if (!existing.unique_prefix) existing.unique_prefix = activePrefix;
    if (!existing.unit_ids) existing.unit_ids = [];

    const currentLength = existing.unit_ids.length;
    const newUnitIds: string[] = [];
    for (let i = 0; i < qty; i++) {
      const serialNum = currentLength + i + 1;
      const suffix = serialNum < 10 ? `0${serialNum}` : `${serialNum}`;
      newUnitIds.push(`${activePrefix}-${suffix}`);
    }

    existing.total_quantity += qty;
    existing.available_quantity += qty;
    existing.unit_ids = [...existing.unit_ids, ...newUnitIds];
    await existing.save();
    return res.status(200).json(existing);
  }

  const activePrefix = reqPrefix || buildEquipmentPrefix(nameTrim);
  const newUnitIds: string[] = [];
  for (let i = 0; i < qty; i++) {
    const serialNum = i + 1;
    const suffix = serialNum < 10 ? `0${serialNum}` : `${serialNum}`;
    newUnitIds.push(`${activePrefix}-${suffix}`);
  }

  const id = await getNextSequence("equipment_id");
  const newEq = await Equipment.create({
    id,
    equipment_name: nameTrim,
    total_quantity: qty,
    available_quantity: qty,
    unique_prefix: activePrefix,
    unit_ids: newUnitIds,
  });
  res.status(201).json(newEq);
});

router.delete("/equipment/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const deletedItem = await Equipment.findOneAndDelete({ id });
  if (!deletedItem) {
    return res.status(404).json({ error: "Equipment stock model not found" });
  }
  await Assignment.deleteMany({ equipment_id: id });
  res.json({ success: true, deleted: deletedItem });
});

router.delete("/equipment/:id/unit/:unitId", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const unitId = req.params.unitId;

  const eq = await Equipment.findOne({ id });
  if (!eq) return res.status(404).json({ error: "Equipment stock model not found" });
  if (!eq.unit_ids?.includes(unitId)) {
    return res.status(404).json({ error: "Specific unit ID not found in this model" });
  }

  const isActiveCheckout = await Assignment.exists({
    equipment_id: id,
    unit_id: unitId,
    status: "Out",
  });
  if (isActiveCheckout) {
    return res.status(400).json({
      error: `Cannot delete unit ${unitId} because it is currently checked out or claimed. Please reclaim it first.`,
    });
  }

  eq.unit_ids = eq.unit_ids.filter((uid) => uid !== unitId);
  eq.total_quantity = Math.max(0, eq.total_quantity - 1);
  await syncEquipmentAvailability(id);
  const refreshed = await Equipment.findOne({ id });
  res.json({ success: true, updatedEquipment: refreshed });
});

router.get("/assignments", async (_req, res) => {
  const assignments = await Assignment.find().sort({ assignment_id: 1 }).lean();
  const equipment = await Equipment.find().lean();
  const eqMap = new Map(equipment.map((e) => [e.id, e.equipment_name]));

  const populated = assignments.map((asg) => ({
    ...asg,
    equipment_name: eqMap.get(asg.equipment_id) || "Unknown Equipment",
  }));
  res.json(populated);
});

router.post("/assignments/checkout", async (req, res) => {
  const { equipment_id, user_name, checkout_date, until_date, unit_id, unit_ids } = req.body;
  if (!equipment_id || !user_name || !checkout_date) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  const trimmedUntil = until_date ? String(until_date).trim() : "";
  if (trimmedUntil && trimmedUntil < checkout_date) {
    return res.status(400).json({ error: "Return-until date cannot be before the dispatch date." });
  }

  const eqId = parseInt(String(equipment_id), 10);
  const item = await Equipment.findOne({ id: eqId });
  if (!item) return res.status(404).json({ error: "Equipment stock item not found" });

  const outAssignmentsForEq = await Assignment.find({ equipment_id: eqId, status: "Out" });
  const activeCheckedOutUnits = outAssignmentsForEq.map((a) => a.unit_id).filter(Boolean) as string[];

  let unitsToCheckout: string[] = [];

  if (Array.isArray(unit_ids) && unit_ids.length > 0) {
    unitsToCheckout = unit_ids.map((uid: unknown) => String(uid).trim()).filter(Boolean);
    const alreadyCheckedOut = unitsToCheckout.filter((uid) => activeCheckedOutUnits.includes(uid));
    if (alreadyCheckedOut.length > 0) {
      return res.status(400).json({
        error: `The following units are already checked out: ${alreadyCheckedOut.join(", ")}`,
      });
    }
  } else if (unit_id) {
    const trimmedUid = String(unit_id).trim();
    if (activeCheckedOutUnits.includes(trimmedUid)) {
      return res.status(400).json({ error: `Unit ID '${trimmedUid}' is already checked out.` });
    }
    unitsToCheckout = [trimmedUid];
  } else {
    const allUnitIds = item.unit_ids || [];
    const availableUnits = allUnitIds.filter((uid) => !activeCheckedOutUnits.includes(uid));
    if (availableUnits.length > 0) {
      unitsToCheckout = [availableUnits[0]];
    } else if (allUnitIds.length > 0) {
      unitsToCheckout = [allUnitIds[0]];
    } else {
      const prefix = item.unique_prefix || "CANTOR-EQ";
      const selectedUnitId = `${prefix}-01`;
      item.unit_ids = [selectedUnitId];
      item.total_quantity = 1;
      unitsToCheckout = [selectedUnitId];
    }
  }

  if (item.available_quantity < unitsToCheckout.length) {
    return res.status(400).json({
      error: `Not enough stock available. Requested ${unitsToCheckout.length} units, but only ${item.available_quantity} available.`,
    });
  }

  const createdAssignments = [];
  for (const uid of unitsToCheckout) {
    item.available_quantity = Math.max(0, item.available_quantity - 1);
    const assignment_id = await getNextSequence("assignment_id");
    const newAsg = await Assignment.create({
      assignment_id,
      equipment_id: eqId,
      user_name: String(user_name).trim(),
      checkout_date,
      ...(trimmedUntil ? { until_date: trimmedUntil } : {}),
      status: "Out",
      unit_id: uid,
    });
    createdAssignments.push(newAsg);
  }

  await item.save();
  res.status(201).json({ assignments: createdAssignments, equipment_item: item });
});

router.post("/assignments/reclaim/:id", async (req, res) => {
  const asgId = parseInt(req.params.id, 10);
  const booking = await Assignment.findOne({ assignment_id: asgId });
  if (!booking) return res.status(404).json({ error: "Assignment record not found" });
  if (booking.status === "Returned") {
    return res.status(400).json({ error: "This item has already been reclaimed and checked in." });
  }

  booking.status = "Returned";
  await booking.save();

  const item = await Equipment.findOne({ id: booking.equipment_id });
  if (item) {
    item.available_quantity = Math.min(item.available_quantity + 1, item.total_quantity);
    await item.save();
  }

  res.json({ success: true, assignment: booking, equipment_item: item });
});

export default router;
