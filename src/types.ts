export interface Video {
  id: number;
  name: string;
  unique_code: string;
  duration: number;
  status: 'uploaded' | 'not uploaded';
  category: string;
  sub_category?: string;
  created_at?: string;
}

export interface Equipment {
  id: number;
  equipment_name: string;
  total_quantity: number;
  available_quantity: number;
  unique_prefix?: string;
  unit_ids?: string[];
}

export interface Assignment {
  assignment_id: number;
  equipment_id: number;
  equipment_name?: string; // populated from endpoint
  user_name: string;
  checkout_date: string;
  until_date?: string; // optional return deadline
  status: 'Out' | 'Returned';
  unit_id?: string;
}

export type SidebarTab = 'Video Manager' | 'Inventory' | 'Distribution & Verification' | 'User Access Panel';

export interface CustomFolder {
  id: number;
  category: string;
  sub_category?: string;
}

export interface AuthorizedUser {
  email: string;
  name?: string;
  password?: string;
  role: 'Admin' | 'Supervisor' | 'User';
}
