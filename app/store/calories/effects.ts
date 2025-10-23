import { addEffect } from '@/store/store';
import {
  addEntry,
  initializeCaloriesStateSlice,
  removeEntry,
  setCaloriesHydrated,
  setDailyGoal,
  setEntries,
} from '@/store/calories';

export function applyCaloriesEffects() {
  addEffect(
    initializeCaloriesStateSlice,
    async (_, { dispatch, extra: { preferenceService } }) => {
      const [goal, entries] = await Promise.all([
        preferenceService.getCalorieGoal(),
        preferenceService.getCalorieEntries(),
      ]);

      dispatch(setDailyGoal(goal));
      dispatch(setEntries(entries));
      dispatch(setCaloriesHydrated(true));
    },
  );

  addEffect(
    [setDailyGoal, setEntries, addEntry, removeEntry],
    async (_, { stateAfterReduce, extra: { preferenceService } }) => {
      const { calories } = stateAfterReduce;
      if (!calories.isHydrated) {
        return;
      }

      await Promise.all([
        preferenceService.setCalorieGoal(calories.dailyGoal),
        preferenceService.setCalorieEntries(calories.entries),
      ]);
    },
  );
}
