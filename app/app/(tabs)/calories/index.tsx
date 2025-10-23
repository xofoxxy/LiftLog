import { useCallback, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useTranslate } from '@tolgee/react';
import { FlashList } from '@shopify/flash-list';
import {
  ActivityIndicator,
  Dialog,
  Divider,
  HelperText,
  List,
  Portal,
  Searchbar,
  TextInput,
} from 'react-native-paper';
import { FlatGrid } from 'react-native-super-grid';
import { v4 as uuidv4 } from 'uuid';
import { useDispatch } from 'react-redux';

import Button from '@/components/presentation/gesture-wrappers/button';
import SingleValueStatisticCard from '@/components/presentation/single-value-statistic-card';
import { SurfaceText } from '@/components/presentation/surface-text';
import { useAppSelector } from '@/store';
import { addEntry } from '@/store/calories';
import { CalorieEntry } from '@/models/diet';
import { useScroll } from '@/hooks/useScollListener';
import { spacing, type ColorChoice } from '@/hooks/useAppTheme';

type CalorieSummary = {
  goal: number;
  consumed: number;
  burned: number;
  net: number;
};

type UsdaFoodResult = {
  fdcId: number;
  description: string;
  brandName?: string;
  foodNutrients?: {
    nutrientNumber?: string;
    nutrientName?: string;
    unitName?: string;
    value?: number;
  }[];
  servingSize?: number;
  servingSizeUnit?: string;
};

export default function CaloriesPage() {
  const { t } = useTranslate();
  const { push } = useRouter();
  const dispatch = useDispatch();
  const entries = useAppSelector((state) => state.calories.entries);
  const dailyGoal = useAppSelector((state) => state.calories.dailyGoal);
  const { handleScroll } = useScroll();

  const [searchText, setSearchText] = useState('');
  const [manualDialogType, setManualDialogType] = useState<
    CalorieEntry['type'] | null
  >(null);
  const [manualName, setManualName] = useState('');
  const [manualCalories, setManualCalories] = useState('');
  const [manualNote, setManualNote] = useState('');
  const [manualError, setManualError] = useState<string | undefined>();

  const defaultUsdaKey =
    typeof process.env.EXPO_PUBLIC_USDA_API_KEY === 'string'
      ? process.env.EXPO_PUBLIC_USDA_API_KEY
      : '';
  const [usdaDialogOpen, setUsdaDialogOpen] = useState(false);
  const [usdaQuery, setUsdaQuery] = useState('');
  const [usdaApiKey, setUsdaApiKey] = useState(defaultUsdaKey);
  const [usdaResults, setUsdaResults] = useState<UsdaFoodResult[]>([]);
  const [usdaLoading, setUsdaLoading] = useState(false);
  const [usdaError, setUsdaError] = useState<string | undefined>();

  const summary = useMemo<CalorieSummary>(() => {
    const consumed = entries
      .filter((entry) => entry.type === 'consumed')
      .reduce((acc, entry) => acc + entry.calories, 0);
    const burned = entries
      .filter((entry) => entry.type === 'burned')
      .reduce((acc, entry) => acc + entry.calories, 0);

    return {
      goal: dailyGoal,
      consumed,
      burned,
      net: consumed - burned,
    };
  }, [dailyGoal, entries]);

  const filteredEntries = useMemo(() => {
    if (!searchText) {
      return entries;
    }
    const query = searchText.toLocaleLowerCase();
    return entries.filter((entry) =>
      `${entry.name} ${entry.note ?? ''}`.toLocaleLowerCase().includes(query),
    );
  }, [entries, searchText]);

  const handleAddEntry = useCallback(
    (entry: Omit<CalorieEntry, 'id' | 'recordedAtIso'>) => {
      dispatch(
        addEntry({
          ...entry,
          id: uuidv4(),
          recordedAtIso: new Date().toISOString(),
        }),
      );
    },
    [dispatch],
  );

  const resetManualDialog = useCallback(() => {
    setManualName('');
    setManualCalories('');
    setManualNote('');
    setManualError(undefined);
  }, []);

  const closeManualDialog = useCallback(() => {
    setManualDialogType(null);
  }, []);

  const openManualDialog = useCallback(
    (type: CalorieEntry['type']) => {
      setManualDialogType(type);
      resetManualDialog();
    },
    [resetManualDialog],
  );

  const saveManualEntry = useCallback(() => {
    if (!manualDialogType) {
      return;
    }

    const trimmedName = manualName.trim();
    if (!trimmedName) {
      setManualError(t('Please provide a name for this entry.'));
      return;
    }

    const normalizedCalories = manualCalories.replace(',', '.');
    const caloriesNumber = Number.parseFloat(normalizedCalories);
    if (!Number.isFinite(caloriesNumber) || caloriesNumber <= 0) {
      setManualError(t('Enter a positive calorie value.'));
      return;
    }

    handleAddEntry({
      name: trimmedName,
      calories: Math.round(caloriesNumber),
      type: manualDialogType,
      note: manualNote.trim() ? manualNote.trim() : undefined,
      source: 'manual',
    });

    closeManualDialog();
  }, [
    closeManualDialog,
    handleAddEntry,
    manualCalories,
    manualDialogType,
    manualName,
    manualNote,
    t,
  ]);

  const closeUsdaDialog = useCallback(() => {
    setUsdaDialogOpen(false);
    setUsdaResults([]);
    setUsdaLoading(false);
    setUsdaError(undefined);
  }, []);

  const openUsdaDialog = useCallback(() => {
    setUsdaDialogOpen(true);
    setUsdaResults([]);
    setUsdaLoading(false);
    setUsdaError(undefined);
  }, []);

  const fetchUsdaFoods = useCallback(async () => {
    if (!usdaApiKey.trim()) {
      setUsdaError(t('Please enter a USDA API key.'));
      return;
    }

    if (!usdaQuery.trim()) {
      setUsdaError(t('Enter a food to search for.'));
      return;
    }

    try {
      setUsdaLoading(true);
      setUsdaError(undefined);
      const response = await fetch(
        `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(usdaApiKey.trim())}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: usdaQuery.trim(),
            pageSize: 25,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`USDA API error: ${response.statusText}`);
      }

      const data = (await response.json()) as { foods?: UsdaFoodResult[] };
      setUsdaResults(data.foods ?? []);
    } catch (error) {
      console.error(error);
      setUsdaError(
        t('We were unable to fetch foods. Check your key and try again.'),
      );
    } finally {
      setUsdaLoading(false);
    }
  }, [t, usdaApiKey, usdaQuery]);

  const handleSelectUsdaFood = useCallback(
    (food: UsdaFoodResult) => {
      const energyNutrient = food.foodNutrients?.find(
        (nutrient) =>
          nutrient.nutrientNumber === '208' ||
          nutrient.nutrientName?.toLocaleLowerCase() === 'energy',
      );

      const calories = energyNutrient?.value;
      if (calories === undefined) {
        setUsdaError(t('This food does not contain calorie information.'));
        return;
      }

      const servingDescription =
        food.servingSize && food.servingSizeUnit
          ? t('Per {0} {1}', {
              0: food.servingSize,
              1: food.servingSizeUnit,
            })
          : undefined;

      const noteParts = [servingDescription];
      if (food.brandName) {
        noteParts.push(t('Brand: {0}', { 0: food.brandName }));
      }

      handleAddEntry({
        name: food.description,
        calories: Math.round(calories),
        type: 'consumed',
        note: noteParts.filter(Boolean).join(' • ') || undefined,
        source: 'usda',
      });

      closeUsdaDialog();
    },
    [closeUsdaDialog, handleAddEntry, t],
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: t('Calories'),
        }}
      />
      <FlashList
        onScroll={handleScroll}
        data={filteredEntries}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingTop: spacing[4],
          paddingHorizontal: spacing.pageHorizontalMargin,
          paddingBottom: spacing[8],
        }}
        ListHeaderComponent={
          <ListHeader
            summary={summary}
            searchText={searchText}
            setSearchText={setSearchText}
            onAddConsumed={() => openManualDialog('consumed')}
            onAddBurned={() => openManualDialog('burned')}
            onFindFood={openUsdaDialog}
            onOpenDietSettings={() =>
              push('/(tabs)/settings/diet/calorie-goal')
            }
          />
        }
        ListHeaderComponentStyle={{ marginBottom: spacing[4] }}
        ItemSeparatorComponent={() => (
          <Divider style={{ marginVertical: spacing[4] }} />
        )}
        renderItem={({ item }) => <CalorieEntryCard entry={item} />}
        ListEmptyComponent={() => (
          <View style={{ marginTop: spacing[8] }}>
            <SurfaceText
              color="onSurfaceVariant"
              style={{ textAlign: 'center' }}
            >
              {t('No calorie entries yet')}
            </SurfaceText>
            <SurfaceText
              color="onSurfaceVariant"
              style={{ textAlign: 'center', marginTop: spacing[2] }}
              font="text-sm"
            >
              {t('Add your first calorie entry to get started.')}
            </SurfaceText>
          </View>
        )}
      />

      <Portal>
        <Dialog
          visible={manualDialogType !== null}
          onDismiss={closeManualDialog}
        >
          <Dialog.Title>
            {manualDialogType === 'burned'
              ? t('Add calories burned')
              : t('Add calories consumed')}
          </Dialog.Title>
          <Dialog.Content>
            <SurfaceText
              color="onSurfaceVariant"
              style={{ marginBottom: spacing[2] }}
            >
              {manualDialogType === 'burned'
                ? t(
                    'Track workouts or activities and estimate how many calories you burned.',
                  )
                : t('Log meals, snacks, or drinks with their calorie totals.')}
            </SurfaceText>
            <TextInput
              label={t('Food or activity name')}
              value={manualName}
              onChangeText={setManualName}
              mode="outlined"
              style={{ marginBottom: spacing[2] }}
            />
            <TextInput
              label={t('Calories (kcal)')}
              keyboardType="numeric"
              value={manualCalories}
              onChangeText={setManualCalories}
              mode="outlined"
              style={{ marginBottom: spacing[2] }}
            />
            <TextInput
              label={t('Optional details')}
              value={manualNote}
              onChangeText={setManualNote}
              mode="outlined"
            />
            {manualError ? (
              <HelperText type="error" visible>
                {manualError}
              </HelperText>
            ) : undefined}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={closeManualDialog}>{t('Cancel')}</Button>
            <Button mode="contained" onPress={saveManualEntry}>
              {t('Save')}
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={usdaDialogOpen} onDismiss={closeUsdaDialog}>
          <Dialog.Title>{t('Find USDA food')}</Dialog.Title>
          <Dialog.Content>
            <SurfaceText
              color="onSurfaceVariant"
              style={{ marginBottom: spacing[2] }}
            >
              {t('Look up foods using the USDA FoodData Central database.')}
            </SurfaceText>
            <TextInput
              label={t('Search term')}
              value={usdaQuery}
              onChangeText={setUsdaQuery}
              mode="outlined"
              style={{ marginBottom: spacing[2] }}
            />
            <TextInput
              label={t('USDA API key')}
              value={usdaApiKey}
              onChangeText={setUsdaApiKey}
              mode="outlined"
              secureTextEntry
              style={{ marginBottom: spacing[2] }}
            />
            {usdaError ? (
              <HelperText type="error" visible>
                {usdaError}
              </HelperText>
            ) : undefined}
            <Button
              mode="contained"
              onPress={() => {
                void fetchUsdaFoods();
              }}
              loading={usdaLoading}
              icon="search"
              style={{ marginBottom: spacing[2] }}
            >
              {t('Search foods')}
            </Button>
            {usdaLoading ? (
              <View
                style={{ alignItems: 'center', paddingVertical: spacing[4] }}
              >
                <ActivityIndicator animating size="small" />
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 280 }}>
                {usdaResults.length === 0 ? (
                  <SurfaceText
                    color="onSurfaceVariant"
                    style={{ textAlign: 'center' }}
                  >
                    {t('No foods found yet. Try searching above.')}
                  </SurfaceText>
                ) : (
                  usdaResults.map((food) => {
                    const energyNutrient = food.foodNutrients?.find(
                      (nutrient) =>
                        nutrient.nutrientNumber === '208' ||
                        nutrient.nutrientName?.toLocaleLowerCase() === 'energy',
                    );
                    const calories = energyNutrient?.value;

                    const parts: string[] = [];
                    if (calories !== undefined) {
                      parts.push(
                        t('{0} kcal', {
                          0: Math.round(calories).toLocaleString(),
                        }),
                      );
                    }
                    if (food.servingSize && food.servingSizeUnit) {
                      parts.push(
                        t('Per {0} {1}', {
                          0: food.servingSize,
                          1: food.servingSizeUnit,
                        }),
                      );
                    }
                    if (food.brandName) {
                      parts.push(t('Brand: {0}', { 0: food.brandName }));
                    }

                    return (
                      <List.Item
                        key={food.fdcId}
                        title={food.description}
                        description={parts.join(' • ')}
                        onPress={
                          calories !== undefined
                            ? () => handleSelectUsdaFood(food)
                            : undefined
                        }
                        disabled={calories === undefined}
                        left={(props) => (
                          <List.Icon {...props} icon="restaurant" />
                        )}
                        right={() => (
                          <View
                            style={{
                              minWidth: 88,
                              alignItems: 'flex-end',
                              justifyContent: 'center',
                            }}
                          >
                            <SurfaceText
                              color={
                                calories !== undefined ? 'primary' : 'error'
                              }
                              weight="bold"
                            >
                              {calories !== undefined
                                ? t('{0} kcal', {
                                    0: Math.round(calories).toLocaleString(),
                                  })
                                : t('No calorie data')}
                            </SurfaceText>
                          </View>
                        )}
                      />
                    );
                  })
                )}
              </ScrollView>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={closeUsdaDialog}>{t('Close')}</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}

function ListHeader({
  summary,
  searchText,
  setSearchText,
  onAddConsumed,
  onAddBurned,
  onFindFood,
  onOpenDietSettings,
}: {
  summary: CalorieSummary;
  searchText: string;
  setSearchText: (value: string) => void;
  onAddConsumed: () => void;
  onAddBurned: () => void;
  onFindFood: () => void;
  onOpenDietSettings: () => void;
}) {
  const { t } = useTranslate();
  const { goal, consumed, burned, net } = summary;
  const goalDifference = goal - net;

  type SummaryItem = {
    key: string;
    label: string;
    value: string;
    color: ColorChoice;
    helper?: string;
  };

  const summaryItems = useMemo<SummaryItem[]>(
    () => [
      {
        key: 'goal',
        label: t('Daily goal'),
        value: `${goal.toLocaleString()} kcal`,
        color: 'primary',
      },
      {
        key: 'consumed',
        label: t('Consumed'),
        value: `${consumed.toLocaleString()} kcal`,
        color: 'orange',
      },
      {
        key: 'burned',
        label: t('Burned'),
        value: `${burned.toLocaleString()} kcal`,
        color: 'green',
      },
      {
        key: 'net',
        label: t('Net calories'),
        value: `${net.toLocaleString()} kcal`,
        color: 'tertiary',
        helper:
          goalDifference > 0
            ? t('{0} kcal remaining to goal', {
                0: goalDifference.toLocaleString(),
              })
            : goalDifference === 0
              ? t('Goal reached')
              : t('Over goal by {0} kcal', {
                  0: Math.abs(goalDifference).toLocaleString(),
                }),
      },
    ],
    [burned, consumed, goal, goalDifference, net, t],
  );

  return (
    <View style={{ gap: spacing[3] }}>
      <FlatGrid
        scrollEnabled={false}
        data={summaryItems}
        keyExtractor={(item) => item.key}
        maxItemsPerRow={2}
        renderItem={({ item }) => (
          <SingleValueStatisticCard title={item.label}>
            <SurfaceText color={item.color} font="text-xl" weight="bold">
              {item.value}
            </SurfaceText>
            {item.helper ? (
              <SurfaceText font="text-xs" color="onSurfaceVariant">
                {item.helper}
              </SurfaceText>
            ) : undefined}
          </SingleValueStatisticCard>
        )}
      />
      <View style={{ gap: spacing[2] }}>
        <SurfaceText color="onSurfaceVariant">
          {t(
            'Track calories from meals and activities to understand your daily balance.',
          )}
        </SurfaceText>
        <Button mode="contained" icon="restaurant" onPress={onAddConsumed}>
          {t('Add calories consumed')}
        </Button>
        <Button
          mode="contained-tonal"
          icon="localFireDepartment"
          onPress={onAddBurned}
        >
          {t('Add calories burned')}
        </Button>
        <Button mode="outlined" icon="search" onPress={onFindFood}>
          {t('Find USDA food')}
        </Button>
        <Button mode="text" icon="settings" onPress={onOpenDietSettings}>
          {t('Manage diet settings')}
        </Button>
      </View>
      <Searchbar
        placeholder={t('Search')}
        value={searchText}
        onChangeText={setSearchText}
      />
    </View>
  );
}

function CalorieEntryCard({ entry }: { entry: CalorieEntry }) {
  const { t } = useTranslate();
  const highlightColor = entry.type === 'consumed' ? 'orange' : 'green';
  const recordedAt = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(entry.recordedAtIso)),
    [entry.recordedAtIso],
  );

  const sourceLabel =
    entry.source === 'usda' ? t('USDA FoodData Central') : t('Manual entry');

  return (
    <SingleValueStatisticCard title={entry.name}>
      <View style={{ alignItems: 'center', gap: spacing[1] }}>
        <SurfaceText color={highlightColor} font="text-2xl" weight="bold">
          {`${entry.calories.toLocaleString()} kcal`}
        </SurfaceText>
        {entry.note ? (
          <SurfaceText
            font="text-sm"
            color="onSurfaceVariant"
            style={{ textAlign: 'center' }}
          >
            {entry.note}
          </SurfaceText>
        ) : undefined}
        <SurfaceText font="text-xs" color="onSurfaceVariant">
          {`${t(entry.type === 'consumed' ? 'Consumed' : 'Burned')} • ${recordedAt}`}
        </SurfaceText>
        <SurfaceText font="text-xs" color="onSurfaceVariant">
          {sourceLabel}
        </SurfaceText>
      </View>
    </SingleValueStatisticCard>
  );
}
