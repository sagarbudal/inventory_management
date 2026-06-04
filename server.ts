import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

interface Video {
  id: number;
  name: string;
  unique_code: string;
  duration: number;
  status: string; // 'uploaded' | 'not uploaded'
  category: string;
  sub_category?: string;
  created_at?: string;
}

interface Equipment {
  id: number;
  equipment_name: string;
  total_quantity: number;
  available_quantity: number;
  unique_prefix?: string;
  unit_ids?: string[];
}

interface Assignment {
  assignment_id: number;
  equipment_id: number;
  user_name: string;
  checkout_date: string;
  status: string; // 'Out' | 'Returned'
  unit_id?: string;
}

interface CustomFolder {
  id: number;
  category: string;
  sub_category?: string;
}

interface AuthorizedUser {
  email: string;
  password?: string;
  role: 'Admin' | 'Supervisor' | 'User';
  name?: string;
}

interface DbSchema {
  videos: Video[];
  equipment: Equipment[];
  assignments: Assignment[];
  custom_folders?: CustomFolder[];
  authorized_users?: AuthorizedUser[];
}

const DB_PATH = path.join(process.cwd(), "db.json");

function readDb(): DbSchema {
  try {
    if (!fs.existsSync(DB_PATH)) {
      const initial: DbSchema = { videos: [], equipment: [], assignments: [], authorized_users: [] };
      fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2), "utf8");
      return initial;
    }
    const raw = fs.readFileSync(DB_PATH, "utf8");
    const parsed: DbSchema = JSON.parse(raw);
    
    // Backfill existing equipment with prefix and sequence of unit IDs
    let isModified = false;
    if (parsed.equipment && Array.isArray(parsed.equipment)) {
      parsed.equipment.forEach((eq) => {
        let changed = false;
        if (!eq.unique_prefix) {
          const cleanName = eq.equipment_name
            .replace(/[^a-zA-Z0-9]/g, "")
            .toUpperCase()
            .slice(0, 4);
          eq.unique_prefix = `CANTOR-${cleanName || "EQ"}`;
          changed = true;
        }
        if (!eq.unit_ids) {
          eq.unit_ids = [];
          changed = true;
        }
        if (eq.unit_ids.length !== eq.total_quantity) {
          const currentCount = eq.unit_ids.length;
          if (currentCount < eq.total_quantity) {
            const additionalNeeded = eq.total_quantity - currentCount;
            for (let i = 0; i < additionalNeeded; i++) {
              const serialNum = currentCount + i + 1;
              const suffix = serialNum < 10 ? `0${serialNum}` : `${serialNum}`;
              eq.unit_ids.push(`${eq.unique_prefix}-${suffix}`);
            }
          } else {
            eq.unit_ids = eq.unit_ids.slice(0, eq.total_quantity);
          }
          changed = true;
        }
        if (changed) {
          isModified = true;
        }
      });
    }

    // Backfill missing unit_ids on active checkouts
    if (parsed.assignments && Array.isArray(parsed.assignments)) {
      parsed.assignments.forEach(asg => {
        if (asg.status === 'Out' && !asg.unit_id) {
          const eq = parsed.equipment?.find(e => e.id === asg.equipment_id);
          if (eq && eq.unit_ids && eq.unit_ids.length > 0) {
            const activeUnitIds = parsed.assignments!
              .filter(a => a.equipment_id === asg.equipment_id && a.status === 'Out' && a.unit_id)
              .map(a => a.unit_id);
            const found = eq.unit_ids.find(uid => !activeUnitIds.includes(uid));
            if (found) {
              asg.unit_id = found;
              isModified = true;
            } else {
              asg.unit_id = eq.unit_ids[0];
              isModified = true;
            }
          }
        }
      });
    }

    // Keep available_quantity in sync with physical assignments
    if (parsed.equipment && Array.isArray(parsed.equipment)) {
      const activeOutCountMap: Record<number, number> = {};
      
      if (parsed.assignments && Array.isArray(parsed.assignments)) {
        parsed.assignments.forEach(asg => {
          if (asg.status === 'Out') {
            activeOutCountMap[asg.equipment_id] = (activeOutCountMap[asg.equipment_id] || 0) + 1;
          }
        });
      }

      parsed.equipment.forEach((eq) => {
        const outCount = activeOutCountMap[eq.id] || 0;
        const computedAvailable = Math.max(0, eq.total_quantity - outCount);
        if (eq.available_quantity !== computedAvailable) {
          eq.available_quantity = computedAvailable;
          isModified = true;
        }
      });
    }

    // Seed authorized users
    if (!parsed.authorized_users || !Array.isArray(parsed.authorized_users) || parsed.authorized_users.length === 0) {
      parsed.authorized_users = [
        { email: "budalsagar2020@gmail.com", password: "password123", role: "Admin", name: "Sagar Budal" },
        { email: "admin@cantordust.com", password: "cantordust123", role: "Admin", name: "Cantor Admin" },
        { email: "supervisor@cantordust.com", password: "password123", role: "Supervisor", name: "Cantor Supervisor" },
        { email: "user@cantordust.com", password: "password123", role: "User", name: "Cantor Operator" }
      ];
      isModified = true;
    }

    if (isModified) {
      fs.writeFileSync(DB_PATH, JSON.stringify(parsed, null, 2), "utf8");
    }

    return parsed;
  } catch (error) {
    console.error("DB Read Error:", error);
    return { videos: [], equipment: [], assignments: [], authorized_users: [] };
  }
}

function writeDb(data: DbSchema) {
  try {
    // Keep available_quantity in sync with physical assignments before writing to file
    if (data.equipment && Array.isArray(data.equipment)) {
      const activeOutCountMap: Record<number, number> = {};
      if (data.assignments && Array.isArray(data.assignments)) {
        data.assignments.forEach(asg => {
          if (asg.status === 'Out') {
            activeOutCountMap[asg.equipment_id] = (activeOutCountMap[asg.equipment_id] || 0) + 1;
          }
        });
      }
      data.equipment.forEach((eq) => {
        const outCount = activeOutCountMap[eq.id] || 0;
        eq.available_quantity = Math.max(0, eq.total_quantity - outCount);
      });
    }

    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf8");
  } catch (error) {
    console.error("DB Write Error:", error);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // --- API ROUTING PANEL ---

  // 1. GET ALL VIDEOS
  app.get("/api/videos", (req, res) => {
    const db = readDb();
    res.json(db.videos);
  });

  // 2. ADD VIDEO
  app.post("/api/videos", (req, res) => {
    const db = readDb();
    const { name, unique_code, duration, status, category, sub_category, created_at } = req.body;

    if (!name || !unique_code || !duration || !status || !category) {
      return res.status(400).json({ error: "All parameters are required" });
    }

    const codeUpper = unique_code.trim().toUpperCase();

    // Check unique code constraint
    const exists = db.videos.some(
      (v) => v.unique_code.toUpperCase() === codeUpper
    );
    if (exists) {
      return res.status(400).json({ error: `A video with unique code '${codeUpper}' already exists.` });
    }

    const nextId = db.videos.reduce((max, v) => Math.max(max, v.id), 0) + 1;
    const newVideo: Video = {
      id: nextId,
      name: name.trim(),
      unique_code: codeUpper,
      duration: parseFloat(duration) || 0,
      status: status.toLowerCase(),
      category: category.trim(),
      sub_category: sub_category ? sub_category.trim() : "",
      created_at: created_at || new Date().toISOString(),
    };

    db.videos.push(newVideo);
    writeDb(db);

    res.status(201).json(newVideo);
  });

  // 2.5 UPDATE VIDEO (TRANSFER / MOVE)
  app.put("/api/videos/:id", (req, res) => {
    const db = readDb();
    const id = parseInt(req.params.id, 10);
    const video = db.videos.find((v) => v.id === id);

    if (!video) {
      return res.status(404).json({ error: "Video not found" });
    }

    const { name, unique_code, duration, status, category, sub_category } = req.body;

    if (name !== undefined) video.name = name.trim();
    if (unique_code !== undefined) video.unique_code = unique_code.trim().toUpperCase();
    if (duration !== undefined) video.duration = parseFloat(duration) || 0;
    if (status !== undefined) video.status = status.toLowerCase();
    if (category !== undefined) video.category = category.trim();
    if (sub_category !== undefined) video.sub_category = sub_category ? sub_category.trim() : "";

    writeDb(db);
    res.json(video);
  });

  // 2.55 SESSION LOGIN
  app.post("/api/login", (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }
    const db = readDb();
    const list = db.authorized_users || [];
    const user = list.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!user) {
      return res.status(401).json({ error: "Access Denied: This email does not have authorized access to view or edit this platform." });
    }
    if (user.password !== password) {
      return res.status(401).json({ error: "Incorrect password. Please verify and try again." });
    }
    res.json({
      success: true,
      email: user.email,
      name: user.name || "Operator Team",
      role: user.role
    });
  });

  // 2.56 DYNAMIC USER ACCESS REGISTRY (Allows adding more emails dynamically by admin)
  app.get("/api/users", (req, res) => {
    const db = readDb();
    res.json(db.authorized_users || []);
  });

  app.post("/api/users/add", (req, res) => {
    const { email, name, role, password } = req.body;
    if (!email || !role) {
      return res.status(400).json({ error: "Email and Role are required." });
    }
    const db = readDb();
    if (!db.authorized_users) {
      db.authorized_users = [];
    }
    const exists = db.authorized_users.some(u => u.email.toLowerCase() === email.trim().toLowerCase());
    if (exists) {
      return res.status(400).json({ error: "This email is already in the access list." });
    }
    const newUser: AuthorizedUser = {
      email: email.trim(),
      name: name ? name.trim() : "Team Member",
      password: password ? password.trim() : "password123",
      role: role
    };
    db.authorized_users.push(newUser);
    writeDb(db);
    res.status(201).json(newUser);
  });

  app.delete("/api/users", (req, res) => {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email parameter is required to delete." });
    }
    const db = readDb();
    if (!db.authorized_users) {
      db.authorized_users = [];
    }
    const initialLength = db.authorized_users.length;
    db.authorized_users = db.authorized_users.filter(
      u => u.email.toLowerCase() !== email.trim().toLowerCase()
    );
    if (db.authorized_users.length === initialLength) {
      return res.status(404).json({ error: "User with this email not found." });
    }
    writeDb(db);
    res.json({ success: true, message: `Removed access for ${email}` });
  });

  // 2.6 DELETE SINGLE VIDEO
  app.delete("/api/videos/:id", (req, res) => {
    const db = readDb();
    const id = parseInt(req.params.id, 10);
    const index = db.videos.findIndex((v) => v.id === id);
    if (index === -1) {
      return res.status(404).json({ error: "Video record not found." });
    }
    const deleted = db.videos.splice(index, 1)[0];
    writeDb(db);
    res.json({ success: true, deleted });
  });

  // 2.65 BULK DELETE VIDEOS
  app.post("/api/videos/bulk-delete", (req, res) => {
    const db = readDb();
    const { ids } = req.body;
    if (!Array.isArray(ids)) {
      return res.status(400).json({ error: "Invalid parameters. 'ids' must be an array of numbers." });
    }
    const filterIds = ids.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
    db.videos = db.videos.filter(v => !filterIds.includes(v.id));
    writeDb(db);
    res.json({ success: true, count: filterIds.length });
  });

  // 2.7 GET CUSTOM FOLDERS
  app.get("/api/custom-folders", (req, res) => {
    const db = readDb();
    res.json(db.custom_folders || []);
  });

  // 2.8 POST CUSTOM FOLDER
  app.post("/api/custom-folders", (req, res) => {
    const db = readDb();
    if (!db.custom_folders) {
      db.custom_folders = [];
    }
    const { category, sub_category } = req.body;
    if (!category || !category.trim()) {
      return res.status(400).json({ error: "Category/Folder name is required." });
    }

    const trimmedCat = category.trim();
    const trimmedSub = sub_category ? sub_category.trim() : "";

    const exists = db.custom_folders.some(
      (f) => f.category.toLowerCase() === trimmedCat.toLowerCase() && 
             (f.sub_category || "").toLowerCase() === trimmedSub.toLowerCase()
    );

    if (exists) {
      return res.status(400).json({ error: `Manual folder structure "${trimmedCat}${trimmedSub ? " > " + trimmedSub : ""}" already exists.` });
    }

    const nextId = db.custom_folders.reduce((max, f) => Math.max(max, f.id || 0), 0) + 1;
    const newFolder: CustomFolder = {
      id: nextId,
      category: trimmedCat,
      sub_category: trimmedSub
    };

    db.custom_folders.push(newFolder);
    writeDb(db);
    res.status(201).json(newFolder);
  });

  // 2.9 DELETE CUSTOM FOLDER
  app.delete("/api/custom-folders/:id", (req, res) => {
    const db = readDb();
    const id = parseInt(req.params.id, 10);
    if (!db.custom_folders) {
      db.custom_folders = [];
    }

    const index = db.custom_folders.findIndex((f) => f.id === id);
    if (index === -1) {
      return res.status(404).json({ error: "Custom folder not found" });
    }

    const deleted = db.custom_folders.splice(index, 1)[0];
    writeDb(db);
    res.json({ success: true, deleted });
  });

  // 3. GET EQUIPMENT INVENTORY
  app.get("/api/equipment", (req, res) => {
    const db = readDb();
    res.json(db.equipment);
  });

  // 4. ADD EQUIPMENT OR UPDATE QUANTITY
  app.post("/api/equipment", (req, res) => {
    const db = readDb();
    const { equipment_name, total_quantity, unique_prefix } = req.body;

    if (!equipment_name || total_quantity === undefined) {
      return res.status(400).json({ error: "equipment_name and total_quantity are required" });
    }

    const qty = parseInt(total_quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({ error: "Quantity must be a positive integer" });
    }

    const nameTrim = equipment_name.trim();
    const existing = db.equipment.find(
      (eq) => eq.equipment_name.toLowerCase() === nameTrim.toLowerCase()
    );

    const reqPrefix = (unique_prefix || "").trim().toUpperCase();

    if (existing) {
      const activePrefix = existing.unique_prefix || reqPrefix || `CANTOR-${nameTrim.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 4)}`;
      if (!existing.unique_prefix) {
        existing.unique_prefix = activePrefix;
      }
      if (!existing.unit_ids) {
        existing.unit_ids = [];
      }
      
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

      writeDb(db);
      return res.status(200).json(existing);
    } else {
      const activePrefix = reqPrefix || `CANTOR-${nameTrim.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 4)}`;
      const newUnitIds: string[] = [];
      for (let i = 0; i < qty; i++) {
        const serialNum = i + 1;
        const suffix = serialNum < 10 ? `0${serialNum}` : `${serialNum}`;
        newUnitIds.push(`${activePrefix}-${suffix}`);
      }

      const nextId = db.equipment.reduce((max, e) => Math.max(max, e.id), 0) + 1;
      const newEq: Equipment = {
        id: nextId,
        equipment_name: nameTrim,
        total_quantity: qty,
        available_quantity: qty,
        unique_prefix: activePrefix,
        unit_ids: newUnitIds
      };
      db.equipment.push(newEq);
      writeDb(db);
      return res.status(201).json(newEq);
    }
  });

  // 4b. DELETE EQUIPMENT PROFILE (ADMIN ONLY)
  app.delete("/api/equipment/:id", (req, res) => {
    const db = readDb();
    const id = parseInt(req.params.id, 10);
    const index = db.equipment.findIndex((eq) => eq.id === id);

    if (index === -1) {
      return res.status(404).json({ error: "Equipment stock model not found" });
    }

    // Filter out assignments for this equipment so we don't have orphan records
    db.assignments = db.assignments.filter((asg) => asg.equipment_id !== id);

    const deletedItem = db.equipment.splice(index, 1)[0];
    writeDb(db);

    res.json({ success: true, deleted: deletedItem });
  });

  // 4c. DELETE SINGLE UNIT ID (ADMIN ONLY)
  app.delete("/api/equipment/:id/unit/:unitId", (req, res) => {
    const db = readDb();
    const id = parseInt(req.params.id, 10);
    const unitId = req.params.unitId;

    const eq = db.equipment.find((e) => e.id === id);
    if (!eq) {
      return res.status(404).json({ error: "Equipment stock model not found" });
    }

    if (!eq.unit_ids || !eq.unit_ids.includes(unitId)) {
      return res.status(404).json({ error: "Specific unit ID not found in this model" });
    }

    // Check if this unit is currently checked out (status: 'Out')
    const isActiveCheckout = db.assignments && db.assignments.some(
      (asg) => asg.equipment_id === id && asg.unit_id === unitId && asg.status === "Out"
    );

    if (isActiveCheckout) {
      return res.status(400).json({ 
        error: `Cannot delete unit ${unitId} because it is currently checked out or claimed. Please reclaim it first.` 
      });
    }

    // Remove unitId
    eq.unit_ids = eq.unit_ids.filter((uid) => uid !== unitId);
    
    // Decrement total quantity
    eq.total_quantity = Math.max(0, eq.total_quantity - 1);
    
    // Recalculate available_quantity carefully
    const activeOutCountForThis = db.assignments 
      ? db.assignments.filter(asg => asg.equipment_id === id && asg.status === 'Out').length
      : 0;
    eq.available_quantity = Math.max(0, eq.total_quantity - activeOutCountForThis);

    writeDb(db);
    res.json({ success: true, updatedEquipment: eq });
  });

  // 5. GET ASSIGNMENTS
  app.get("/api/assignments", (req, res) => {
    const db = readDb();
    // Resolve equipment info along with each booking
    const populated = db.assignments.map((asg) => {
      const eq = db.equipment.find((e) => e.id === asg.equipment_id);
      return {
        ...asg,
        equipment_name: eq ? eq.equipment_name : "Unknown Equipment",
      };
    });
    res.json(populated);
  });

  // 6. CHECK OUT SYSTEM
  app.post("/api/assignments/checkout", (req, res) => {
    const db = readDb();
    const { equipment_id, user_name, checkout_date, unit_id, unit_ids } = req.body;

    if (!equipment_id || !user_name || !checkout_date) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const eqId = parseInt(equipment_id, 10);
    const item = db.equipment.find((e) => e.id === eqId);

    if (!item) {
      return res.status(404).json({ error: "Equipment stock item not found" });
    }

    // Determine out list of unit_ids to assign
    let unitsToCheckout: string[] = [];
    
    // Get active checkouts for this item to determine availability
    const outAssignmentsForEq = db.assignments.filter(
      (a) => a.equipment_id === eqId && a.status === "Out"
    );
    const activeCheckedOutUnits = outAssignmentsForEq.map((a) => a.unit_id).filter(Boolean);

    if (Array.isArray(unit_ids) && unit_ids.length > 0) {
      unitsToCheckout = unit_ids.map((id) => String(id).trim()).filter(Boolean);
      
      // Check if any selected unit is already checked out
      const alreadyCheckedOut = unitsToCheckout.filter((uid) => activeCheckedOutUnits.includes(uid));
      if (alreadyCheckedOut.length > 0) {
        return res.status(400).json({
          error: `The following units are already checked out: ${alreadyCheckedOut.join(", ")}`
        });
      }
    } else if (unit_id) {
      const trimmedUid = String(unit_id).trim();
      if (activeCheckedOutUnits.includes(trimmedUid)) {
        return res.status(400).json({ error: `Unit ID '${trimmedUid}' is already checked out.` });
      }
      unitsToCheckout = [trimmedUid];
    } else {
      // Pick first available unit ID
      const allUnitIds = item.unit_ids || [];
      const availableUnits = allUnitIds.filter(uid => !activeCheckedOutUnits.includes(uid));
      if (availableUnits.length > 0) {
        unitsToCheckout = [availableUnits[0]];
      } else if (allUnitIds.length > 0) {
        // Fallback
        unitsToCheckout = [allUnitIds[0]];
      } else {
        // Lazy generation if no IDs exist
        const prefix = item.unique_prefix || "CANTOR-EQ";
        const selectedUnitId = `${prefix}-01`;
        item.unit_ids = [selectedUnitId];
        item.total_quantity = 1;
        unitsToCheckout = [selectedUnitId];
      }
    }

    // Verify stock availability
    if (item.available_quantity < unitsToCheckout.length) {
      return res.status(400).json({
        error: `Not enough stock available. Requested ${unitsToCheckout.length} units, but only ${item.available_quantity} available.`
      });
    }

    // Successfully allocate each unit
    const createdAssignments: Assignment[] = [];
    let currentNextId = db.assignments.reduce((max, a) => Math.max(max, a.assignment_id), 0) + 1;

    for (const uid of unitsToCheckout) {
      // Decrement physical stock
      item.available_quantity = Math.max(0, item.available_quantity - 1);

      const newAsg: Assignment = {
        assignment_id: currentNextId++,
        equipment_id: eqId,
        user_name: user_name.trim(),
        checkout_date: checkout_date,
        status: "Out",
        unit_id: uid,
      };

      db.assignments.push(newAsg);
      createdAssignments.push(newAsg);
    }

    writeDb(db);

    res.status(201).json({
      assignments: createdAssignments,
      equipment_item: item,
    });
  });

  // 7. NIGHTLY DISTRIBUTION RECLAIM
  app.post("/api/assignments/reclaim/:id", (req, res) => {
    const db = readDb();
    const asgId = parseInt(req.params.id, 10);
    const booking = db.assignments.find((a) => a.assignment_id === asgId);

    if (!booking) {
      return res.status(404).json({ error: "Assignment record not found" });
    }

    if (booking.status === "Returned") {
      return res.status(400).json({ error: "This item has already been reclaimed and checked in." });
    }

    // Set statuses
    booking.status = "Returned";

    // Increment corresponding equipment availability
    const item = db.equipment.find((e) => e.id === booking.equipment_id);
    if (item) {
      item.available_quantity = Math.min(item.available_quantity + 1, item.total_quantity);
    }

    writeDb(db);
    res.json({ success: true, assignment: booking, equipment_item: item });
  });

  // --- INTEGRATE VITE COMPILE ASSETS ---

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[FULL-STACK DEV SERVER] Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
