export type CalorieEntryType = 'consumed' | 'burned';

export type CalorieEntrySource = 'manual' | 'usda';

export type CalorieEntry = {
  id: string;
  name: string;
  calories: number;
  type: CalorieEntryType;
  note?: string;
  source: CalorieEntrySource;
  recordedAtIso: string;
};
