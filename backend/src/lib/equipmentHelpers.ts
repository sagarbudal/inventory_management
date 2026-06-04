import { Equipment, Assignment } from "../models/index.js";

export async function syncEquipmentAvailability(equipmentId?: number): Promise<void> {
  const filter = equipmentId !== undefined ? { id: equipmentId } : {};
  const equipmentList = await Equipment.find(filter);

  for (const eq of equipmentList) {
    const outCount = await Assignment.countDocuments({
      equipment_id: eq.id,
      status: "Out",
    });
    const computedAvailable = Math.max(0, eq.total_quantity - outCount);
    if (eq.available_quantity !== computedAvailable) {
      eq.available_quantity = computedAvailable;
      await eq.save();
    }
  }
}

export function buildEquipmentPrefix(name: string): string {
  const cleanName = name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 4);
  return `CANTOR-${cleanName || "EQ"}`;
}

export async function backfillEquipment(eq: InstanceType<typeof Equipment>): Promise<void> {
  let changed = false;

  if (!eq.unique_prefix) {
    eq.unique_prefix = buildEquipmentPrefix(eq.equipment_name);
    changed = true;
  }
  if (!eq.unit_ids) {
    eq.unit_ids = [];
    changed = true;
  }
  if (eq.unit_ids.length !== eq.total_quantity) {
    const currentCount = eq.unit_ids.length;
    if (currentCount < eq.total_quantity) {
      const prefix = eq.unique_prefix!;
      for (let i = 0; i < eq.total_quantity - currentCount; i++) {
        const serialNum = currentCount + i + 1;
        const suffix = serialNum < 10 ? `0${serialNum}` : `${serialNum}`;
        eq.unit_ids.push(`${prefix}-${suffix}`);
      }
    } else {
      eq.unit_ids = eq.unit_ids.slice(0, eq.total_quantity);
    }
    changed = true;
  }

  if (changed) {
    await eq.save();
  }
}
