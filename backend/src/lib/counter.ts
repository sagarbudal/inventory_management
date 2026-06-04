import { Counter } from "../models/index.js";

export async function getNextSequence(name: string): Promise<number> {
  const counter = await Counter.findOneAndUpdate(
    { key: name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter!.seq;
}

export async function setCounterFloor(name: string, floor: number): Promise<void> {
  const existing = await Counter.findOne({ key: name });
  if (!existing || existing.seq < floor) {
    await Counter.findOneAndUpdate({ key: name }, { seq: floor }, { upsert: true });
  }
}

export async function peekSequence(name: string): Promise<number> {
  const counter = await Counter.findOne({ key: name });
  return counter?.seq ?? 0;
}
