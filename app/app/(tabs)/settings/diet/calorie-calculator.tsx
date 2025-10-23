import { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useTranslate } from '@tolgee/react';
import { HelperText, TextInput } from 'react-native-paper';
import { useDispatch } from 'react-redux';
import BigNumber from 'bignumber.js';
import { LocalDate } from '@js-joda/core';

import FullHeightScrollView from '@/components/presentation/full-height-scroll-view';
import SingleValueStatisticCard from '@/components/presentation/single-value-statistic-card';
import { SurfaceText } from '@/components/presentation/surface-text';
import Button from '@/components/presentation/gesture-wrappers/button';
import SelectButton, {
  SelectButtonOption,
} from '@/components/presentation/select-button';
import { spacing } from '@/hooks/useAppTheme';
import { useAppSelector } from '@/store';
import { setDailyGoal } from '@/store/calories';
import { selectSessions } from '@/store/stored-sessions';
import { localeFormatBigNumber } from '@/utils/locale-bignumber';

const KG_PER_LB = 0.45359237;
const CM_PER_INCH = 2.54;
const KCAL_PER_KG = 7700;

type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very';
type GoalType = 'loss' | 'maintain' | 'gain';

type Sex = 'male' | 'female';

export default function CalorieCalculatorScreen() {
  const { t } = useTranslate();
  const dispatch = useDispatch();
  const { push } = useRouter();
  const useImperial = useAppSelector(
    (state) => state.settings.useImperialUnits,
  );
  const sessions = useAppSelector(selectSessions);

  const [sex, setSex] = useState<Sex>('male');
  const [activity, setActivity] = useState<ActivityLevel>('moderate');
  const [goalType, setGoalType] = useState<GoalType>('loss');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [age, setAge] = useState('');
  const [changePerWeek, setChangePerWeek] = useState('0.5');
  const [error, setError] = useState<string | undefined>();
  const [calorieTarget, setCalorieTarget] = useState<number | undefined>();
  const [deltaPerDay, setDeltaPerDay] = useState<number | undefined>();
  const [applySuccess, setApplySuccess] = useState(false);

  const weightUnit = useImperial ? t('lb') : t('kg');
  const heightUnit = useImperial ? t('in') : t('cm');
  const changeUnit = weightUnit;

  const activityOptions: SelectButtonOption<ActivityLevel>[] = useMemo(
    () => [
      { label: t('Sedentary (little or no exercise)'), value: 'sedentary' },
      { label: t('Lightly active (1-3 days/week)'), value: 'light' },
      { label: t('Moderately active (3-5 days/week)'), value: 'moderate' },
      { label: t('Very active (6-7 days/week)'), value: 'active' },
      { label: t('Extra active (physical job + training)'), value: 'very' },
    ],
    [t],
  );

  const goalOptions: SelectButtonOption<GoalType>[] = useMemo(
    () => [
      { label: t('Lose weight'), value: 'loss' },
      { label: t('Maintain weight'), value: 'maintain' },
      { label: t('Gain weight'), value: 'gain' },
    ],
    [t],
  );

  const sexOptions: SelectButtonOption<Sex>[] = useMemo(
    () => [
      { label: t('GenderMale'), value: 'male' },
      { label: t('GenderFemale'), value: 'female' },
    ],
    [t],
  );

  const getActivityFactor = useCallback((level: ActivityLevel) => {
    switch (level) {
      case 'sedentary':
        return 1.2;
      case 'light':
        return 1.375;
      case 'moderate':
        return 1.55;
      case 'active':
        return 1.725;
      case 'very':
        return 1.9;
    }
  }, []);

  const latestBodyweight = useMemo(() => {
    let latestWeightValue: BigNumber | undefined;
    let latestDate: LocalDate | undefined;

    sessions.forEach((session) => {
      const weightValue = session.bodyweight;
      if (weightValue && !weightValue.isNaN()) {
        if (!latestDate || session.date.isAfter(latestDate)) {
          latestWeightValue = weightValue;
          latestDate = session.date;
        }
      }
    });

    return latestWeightValue;
  }, [sessions]);

  useEffect(() => {
    if (!weight.trim() && latestBodyweight) {
      setWeight(localeFormatBigNumber(latestBodyweight));
    }
  }, [latestBodyweight, weight]);

  const onCalculate = useCallback(() => {
    setError(undefined);
    setCalorieTarget(undefined);
    setDeltaPerDay(undefined);
    setApplySuccess(false);

    const weightValue = Number.parseFloat(weight.replace(',', ''));
    const heightValue = Number.parseFloat(height.replace(',', ''));
    const ageValue = Number.parseInt(age.replace(',', ''), 10);
    const changeValue = Number.parseFloat(changePerWeek.replace(',', ''));

    if (!Number.isFinite(weightValue) || weightValue <= 0) {
      setError(t('Please enter your weight.'));
      return;
    }

    if (!Number.isFinite(heightValue) || heightValue <= 0) {
      setError(t('Please enter your height.'));
      return;
    }

    if (!Number.isFinite(ageValue) || ageValue <= 0) {
      setError(t('Please enter your age.'));
      return;
    }

    if (
      goalType !== 'maintain' &&
      (!Number.isFinite(changeValue) || changeValue <= 0)
    ) {
      setError(t('Please enter a weekly change greater than zero.'));
      return;
    }

    const weightKg = useImperial ? weightValue * KG_PER_LB : weightValue;
    const heightCm = useImperial ? heightValue * CM_PER_INCH : heightValue;
    const weeklyChangeKg =
      goalType === 'maintain'
        ? 0
        : useImperial
          ? changeValue * KG_PER_LB
          : changeValue;

    const bmr =
      sex === 'male'
        ? 10 * weightKg + 6.25 * heightCm - 5 * ageValue + 5
        : 10 * weightKg + 6.25 * heightCm - 5 * ageValue - 161;
    const activityFactor = getActivityFactor(activity);
    const tdee = bmr * activityFactor;
    const dailyDelta =
      goalType === 'maintain' ? 0 : (weeklyChangeKg * KCAL_PER_KG) / 7;

    const targetCalories = Math.max(
      0,
      goalType === 'loss' ? tdee - dailyDelta : tdee + dailyDelta,
    );

    setCalorieTarget(Math.round(targetCalories));
    setDeltaPerDay(Math.round(dailyDelta));
  }, [
    activity,
    age,
    changePerWeek,
    getActivityFactor,
    goalType,
    height,
    setApplySuccess,
    sex,
    t,
    useImperial,
    weight,
  ]);

  const onApplyGoal = useCallback(() => {
    if (calorieTarget !== undefined) {
      dispatch(setDailyGoal(calorieTarget));
      setApplySuccess(true);
    }
  }, [calorieTarget, dispatch, setApplySuccess]);

  return (
    <FullHeightScrollView
      contentContainerStyle={{
        paddingHorizontal: spacing.pageHorizontalMargin,
        paddingVertical: spacing[4],
        gap: spacing[4],
      }}
    >
      <Stack.Screen options={{ title: t('Calorie calculator') }} />
      <SurfaceText color="onSurfaceVariant">
        {t(
          'Estimate maintenance calories using the Mifflin-St Jeor equation and apply an energy deficit or surplus based on your goals.',
        )}
      </SurfaceText>
      <Button
        mode="text"
        icon="info"
        onPress={() => push('/(tabs)/settings/diet/disclaimer')}
      >
        {t('Read the calculation disclaimer')}
      </Button>
      <View style={{ gap: spacing[3] }}>
        <View style={{ gap: spacing[1] }}>
          <SurfaceText color="onSurfaceVariant" font="text-sm">
            {t('WhatIsYourGender')}
          </SurfaceText>
          <SelectButton
            value={sex}
            options={sexOptions}
            onChange={(value) => {
              setSex(value);
              setApplySuccess(false);
            }}
          />
        </View>
        <TextInput
          label={t('Body weight ({0})', { 0: weightUnit })}
          value={weight}
          onChangeText={(value) => {
            setWeight(value);
            setApplySuccess(false);
          }}
          keyboardType="numeric"
          mode="outlined"
        />
        <TextInput
          label={t('Height ({0})', { 0: heightUnit })}
          value={height}
          onChangeText={(value) => {
            setHeight(value);
            setApplySuccess(false);
          }}
          keyboardType="numeric"
          mode="outlined"
        />
        <TextInput
          label={t('Age (years)')}
          value={age}
          onChangeText={(value) => {
            setAge(value);
            setApplySuccess(false);
          }}
          keyboardType="numeric"
          mode="outlined"
        />
        <View style={{ gap: spacing[1] }}>
          <SurfaceText color="onSurfaceVariant" font="text-sm">
            {t('Activity level')}
          </SurfaceText>
          <SelectButton
            value={activity}
            options={activityOptions}
            onChange={(value) => {
              setActivity(value);
              setApplySuccess(false);
            }}
          />
        </View>
        <View style={{ gap: spacing[1] }}>
          <SurfaceText color="onSurfaceVariant" font="text-sm">
            {t('Goal')}
          </SurfaceText>
          <SelectButton
            value={goalType}
            options={goalOptions}
            onChange={(value) => {
              setGoalType(value);
              setApplySuccess(false);
              if (value === 'maintain') {
                setChangePerWeek('0');
              }
            }}
          />
        </View>
        <TextInput
          label={t('Change per week ({0})', { 0: changeUnit })}
          value={changePerWeek}
          onChangeText={(value) => {
            setChangePerWeek(value);
            setApplySuccess(false);
          }}
          keyboardType="numeric"
          mode="outlined"
          disabled={goalType === 'maintain'}
        />
        {error ? (
          <HelperText type="error" visible>
            {error}
          </HelperText>
        ) : undefined}
        <Button mode="contained" onPress={onCalculate}>
          {t('Calculate calories')}
        </Button>
      </View>
      {calorieTarget !== undefined ? (
        <View style={{ gap: spacing[2] }}>
          <SingleValueStatisticCard title={t('Recommended daily calories')}>
            <SurfaceText font="text-2xl" weight="bold">
              {t('{0} kcal per day', { 0: calorieTarget.toLocaleString() })}
            </SurfaceText>
            {deltaPerDay !== undefined && deltaPerDay > 0 ? (
              <SurfaceText font="text-xs" color="onSurfaceVariant">
                {goalType === 'loss'
                  ? t('Approximate deficit: {0} kcal per day', {
                      0: deltaPerDay.toLocaleString(),
                    })
                  : t('Approximate surplus: {0} kcal per day', {
                      0: deltaPerDay.toLocaleString(),
                    })}
              </SurfaceText>
            ) : undefined}
          </SingleValueStatisticCard>
          <Button mode="contained-tonal" onPress={onApplyGoal}>
            {t('Use this calorie goal')}
          </Button>
          {applySuccess ? (
            <HelperText type="info" visible>
              {t('Goal updated successfully.')}
            </HelperText>
          ) : undefined}
        </View>
      ) : undefined}
      <SurfaceText color="onSurfaceVariant" font="text-sm">
        {t(
          'Actual calorie needs vary between individuals. Consult a registered dietitian or medical professional for personalized guidance.',
        )}
      </SurfaceText>
    </FullHeightScrollView>
  );
}
