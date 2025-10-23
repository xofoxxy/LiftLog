import { useCallback, useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { useTranslate } from '@tolgee/react';
import { HelperText, TextInput } from 'react-native-paper';
import { View } from 'react-native';
import { useDispatch } from 'react-redux';

import FullHeightScrollView from '@/components/presentation/full-height-scroll-view';
import SingleValueStatisticCard from '@/components/presentation/single-value-statistic-card';
import { SurfaceText } from '@/components/presentation/surface-text';
import Button from '@/components/presentation/gesture-wrappers/button';
import { spacing } from '@/hooks/useAppTheme';
import { useAppSelector } from '@/store';
import { setDailyGoal } from '@/store/calories';

export default function CalorieGoalScreen() {
  const { t } = useTranslate();
  const dispatch = useDispatch();
  const currentGoal = useAppSelector((state) => state.calories.dailyGoal);
  const [inputValue, setInputValue] = useState(currentGoal.toString());
  const [error, setError] = useState<string | undefined>();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setInputValue(currentGoal.toString());
  }, [currentGoal]);

  const onSave = useCallback(() => {
    setSaved(false);
    const normalized = inputValue.replace(',', '');
    const goal = Number.parseInt(normalized, 10);

    if (!Number.isFinite(goal) || goal <= 0) {
      setError(t('Enter a positive calorie value.'));
      return;
    }

    setError(undefined);
    dispatch(setDailyGoal(goal));
    setSaved(true);
  }, [dispatch, inputValue, t]);

  return (
    <FullHeightScrollView
      contentContainerStyle={{
        paddingHorizontal: spacing.pageHorizontalMargin,
        paddingVertical: spacing[4],
        gap: spacing[4],
      }}
    >
      <Stack.Screen options={{ title: t('Calorie goal') }} />
      <SurfaceText color="onSurfaceVariant">
        {t(
          'Set your preferred calorie goal. This target powers the summary on the calories tab and helps track progress toward your plan.',
        )}
      </SurfaceText>
      <SingleValueStatisticCard title={t('Current goal')}>
        <SurfaceText font="text-2xl" weight="bold">
          {t('{0} kcal per day', { 0: currentGoal.toLocaleString() })}
        </SurfaceText>
      </SingleValueStatisticCard>
      <View style={{ gap: spacing[2] }}>
        <TextInput
          label={t('New daily goal (kcal)')}
          value={inputValue}
          onChangeText={(value) => {
            setInputValue(value);
            setSaved(false);
          }}
          keyboardType="numeric"
          mode="outlined"
        />
        {error ? (
          <HelperText type="error" visible>
            {error}
          </HelperText>
        ) : undefined}
        {saved ? (
          <HelperText type="info" visible>
            {t('Goal updated successfully.')}
          </HelperText>
        ) : undefined}
        <Button mode="contained" onPress={onSave}>
          {t('Save goal')}
        </Button>
      </View>
      <SurfaceText color="onSurfaceVariant" font="text-sm">
        {t(
          'You can adjust this number at any time. Consider recalculating it if your activity level or goals change.',
        )}
      </SurfaceText>
    </FullHeightScrollView>
  );
}
