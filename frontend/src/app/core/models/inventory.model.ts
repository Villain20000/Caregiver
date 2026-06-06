export type InventoryCategory = 'PPE' | 'Wound' | 'Skin' | 'Med' | 'Equipment' | 'Hygiene' | 'Nutrition' | 'Other';

export interface InventoryItem {
  sku: string;
  name: string;
  category: InventoryCategory;
  onHand: number;
  par: number;
  reorderAt: number;
  expiresAt?: string;
  supplier: string;
  unitCost: number;          // USD
  lot?: string;
}
