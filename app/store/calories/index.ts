import { CalorieEntry } from '@/models/diet';
import { createAction, createSlice, PayloadAction } from '@reduxjs/toolkit';

export type CaloriesState = {
  entries: CalorieEntry[];
  dailyGoal: number;
  isHydrated: boolean;
};

const initialState: CaloriesState = {
  entries: [],
  dailyGoal: 2400,
  isHydrated: false,
};

const caloriesSlice = createSlice({
  name: 'calories',
  initialState,
  reducers: {
    setDailyGoal(state, action: PayloadAction<number>) {
      state.dailyGoal = action.payload;
    },
    setEntries(state, action: PayloadAction<CalorieEntry[]>) {
      state.entries = action.payload;
    },
    addEntry(state, action: PayloadAction<CalorieEntry>) {
      state.entries = [action.payload, ...state.entries];
    },
    removeEntry(state, action: PayloadAction<string>) {
      state.entries = state.entries.filter(
        (entry) => entry.id !== action.payload,
      );
    },
    setCaloriesHydrated(state, action: PayloadAction<boolean>) {
      state.isHydrated = action.payload;
    },
  },
});

export const initializeCaloriesStateSlice = createAction(
  'initializeCaloriesStateSlice',
);

export const {
  setDailyGoal,
  setEntries,
  addEntry,
  removeEntry,
  setCaloriesHydrated,
} = caloriesSlice.actions;

export const caloriesReducer = caloriesSlice.reducer;
