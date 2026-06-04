import mongoose, { Schema, Document } from "mongoose";

export interface IVideo extends Document {
  id: number;
  name: string;
  unique_code: string;
  duration: number;
  status: string;
  category: string;
  sub_category?: string;
  created_at?: string;
}

export interface IEquipment extends Document {
  id: number;
  equipment_name: string;
  total_quantity: number;
  available_quantity: number;
  unique_prefix?: string;
  unit_ids?: string[];
}

export interface IAssignment extends Document {
  assignment_id: number;
  equipment_id: number;
  user_name: string;
  checkout_date: string;
  until_date?: string;
  status: string;
  unit_id?: string;
}

export interface ICustomFolder extends Document {
  id: number;
  category: string;
  sub_category?: string;
}

export interface IAuthorizedUser extends Document {
  email: string;
  password?: string;
  role: "Admin" | "Supervisor" | "User";
  name?: string;
}

export interface ICounter extends Document {
  key: string;
  seq: number;
}

const VideoSchema = new Schema<IVideo>({
  id: { type: Number, required: true, unique: true },
  name: { type: String, required: true },
  unique_code: { type: String, required: true, unique: true },
  duration: { type: Number, required: true },
  status: { type: String, required: true },
  category: { type: String, required: true },
  sub_category: { type: String, default: "" },
  created_at: { type: String },
});

const EquipmentSchema = new Schema<IEquipment>({
  id: { type: Number, required: true, unique: true },
  equipment_name: { type: String, required: true, unique: true },
  total_quantity: { type: Number, required: true },
  available_quantity: { type: Number, required: true },
  unique_prefix: { type: String },
  unit_ids: { type: [String], default: [] },
});

const AssignmentSchema = new Schema<IAssignment>({
  assignment_id: { type: Number, required: true, unique: true },
  equipment_id: { type: Number, required: true },
  user_name: { type: String, required: true },
  checkout_date: { type: String, required: true },
  until_date: { type: String },
  status: { type: String, required: true },
  unit_id: { type: String },
});

const CustomFolderSchema = new Schema<ICustomFolder>({
  id: { type: Number, required: true, unique: true },
  category: { type: String, required: true },
  sub_category: { type: String, default: "" },
});

const AuthorizedUserSchema = new Schema<IAuthorizedUser>({
  email: { type: String, required: true, unique: true },
  password: { type: String },
  role: { type: String, required: true },
  name: { type: String },
});

const CounterSchema = new Schema<ICounter>({
  key: { type: String, required: true, unique: true },
  seq: { type: Number, default: 0 },
});

export const Video = mongoose.model<IVideo>("Video", VideoSchema);
export const Equipment = mongoose.model<IEquipment>("Equipment", EquipmentSchema);
export const Assignment = mongoose.model<IAssignment>("Assignment", AssignmentSchema);
export const CustomFolder = mongoose.model<ICustomFolder>("CustomFolder", CustomFolderSchema);
export const AuthorizedUser = mongoose.model<IAuthorizedUser>("AuthorizedUser", AuthorizedUserSchema);
export const Counter = mongoose.model<ICounter>("Counter", CounterSchema);
