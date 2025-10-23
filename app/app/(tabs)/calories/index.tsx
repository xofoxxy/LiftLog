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
  SegmentedButtons,
  TextInput,
} from 'react-native-paper';
import { FlatGrid } from 'react-native-super-grid';
import { v4 as uuidv4 } from 'uuid';
import { useDispatch } from 'react-redux';
import {
  Directions,
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import { Instant, LocalDate, ZoneId, ZonedDateTime } from '@js-joda/core';

import Button from '@/components/presentation/gesture-wrappers/button';
import IconButton from '@/components/presentation/gesture-wrappers/icon-button';
import SingleValueStatisticCard from '@/components/presentation/single-value-statistic-card';
import { SurfaceText } from '@/components/presentation/surface-text';
import { useAppSelector } from '@/store';
import { addEntry, removeEntry, updateEntry } from '@/store/calories';
import { CalorieEntry } from '@/models/diet';
import { useScroll } from '@/hooks/useScollListener';
import { spacing, type ColorChoice } from '@/hooks/useAppTheme';
import { formatDate } from '@/utils/format-date';

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

  const [selectedDate, setSelectedDate] = useState<LocalDate>(() =>
    LocalDate.now(),
  );
  const [searchText, setSearchText] = useState('');
  const [manualDialogType, setManualDialogType] = useState<
    CalorieEntry['type'] | null
  >(null);
  const [manualName, setManualName] = useState('');
  const [manualCalories, setManualCalories] = useState('');
  const [manualNote, setManualNote] = useState('');
  const [manualError, setManualError] = useState<string | undefined>();

  const [editingEntry, setEditingEntry] = useState<CalorieEntry | null>(null);
  const [editName, setEditName] = useState('');
  const [editCalories, setEditCalories] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editType, setEditType] = useState<CalorieEntry['type']>('consumed');
  const [editError, setEditError] = useState<string | undefined>();

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

  const zoneId = useMemo(() => ZoneId.systemDefault(), []);
  const today = LocalDate.now();
  const isToday = selectedDate.equals(today);

  const createRecordedAtIso = useCallback(() => {
    const now = ZonedDateTime.now(zoneId);
    const dateTime = ZonedDateTime.of(selectedDate, now.toLocalTime(), zoneId);
    return dateTime.toInstant().toString();
  }, [selectedDate, zoneId]);

  const entriesForSelectedDay = useMemo(() => {
    return entries
      .filter((entry) =>
        Instant.parse(entry.recordedAtIso)
          .atZone(zoneId)
          .toLocalDate()
          .equals(selectedDate),
      )
      .sort((a, b) =>
        Instant.parse(b.recordedAtIso).compareTo(
          Instant.parse(a.recordedAtIso),
        ),
      );
  }, [entries, selectedDate, zoneId]);

  const summary = useMemo<CalorieSummary>(() => {
    const consumed = entriesForSelectedDay
      .filter((entry) => entry.type === 'consumed')
      .reduce((acc, entry) => acc + entry.calories, 0);
    const burned = entriesForSelectedDay
      .filter((entry) => entry.type === 'burned')
      .reduce((acc, entry) => acc + entry.calories, 0);

    return {
      goal: dailyGoal,
      consumed,
      burned,
      net: consumed - burned,
    };
  }, [dailyGoal, entriesForSelectedDay]);

  const filteredEntries = useMemo(() => {
    if (!searchText) {
      return entriesForSelectedDay;
    }
    const query = searchText.toLocaleLowerCase();
    return entriesForSelectedDay.filter((entry) =>
      `${entry.name} ${entry.note ?? ''}`.toLocaleLowerCase().includes(query),
    );
  }, [entriesForSelectedDay, searchText]);

  const handleAddEntry = useCallback(
    (entry: Omit<CalorieEntry, 'id' | 'recordedAtIso'>) => {
      dispatch(
        addEntry({
          ...entry,
          id: uuidv4(),
          recordedAtIso: createRecordedAtIso(),
        }),
      );
    },
    [createRecordedAtIso, dispatch],
  );

  const goToPreviousDay = useCallback(() => {
    setSelectedDate((date) => date.minusDays(1));
  }, []);

  const goToNextDay = useCallback(() => {
    setSelectedDate((date) => date.plusDays(1));
  }, []);

  const goToToday = useCallback(() => {
    setSelectedDate(LocalDate.now());
  }, []);

  const resetManualDialog = useCallback(() => {
    setManualName('');
    setManualCalories('');
    setManualNote('');
    setManualError(undefined);
  }, []);

  const closeManualDialog = useCallback(() => {
    setManualDialogType(null);
    setManualError(undefined);
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

  const openEditEntry = useCallback((entry: CalorieEntry) => {
    setEditingEntry(entry);
    setEditName(entry.name);
    setEditCalories(entry.calories.toString());
    setEditNote(entry.note ?? '');
    setEditType(entry.type);
    setEditError(undefined);
  }, []);

  const closeEditEntry = useCallback(() => {
    setEditingEntry(null);
    setEditError(undefined);
  }, []);

  const saveEditedEntry = useCallback(() => {
    if (!editingEntry) {
      return;
    }

    const trimmedName = editName.trim();
    if (!trimmedName) {
      setEditError(t('Please provide a name for this entry.'));
      return;
    }

    const normalizedCalories = editCalories.replace(',', '.');
    const caloriesNumber = Number.parseFloat(normalizedCalories);
    if (!Number.isFinite(caloriesNumber) || caloriesNumber <= 0) {
      setEditError(t('Enter a positive calorie value.'));
      return;
    }

    const trimmedNote = editNote.trim();

    dispatch(
      updateEntry({
        ...editingEntry,
        name: trimmedName,
        calories: Math.round(caloriesNumber),
        note: trimmedNote ? trimmedNote : undefined,
        type: editType,
      }),
    );

    setEditingEntry(null);
  }, [dispatch, editCalories, editName, editNote, editType, editingEntry, t]);

  const deleteEditedEntry = useCallback(() => {
    if (!editingEntry) {
      return;
    }

    dispatch(removeEntry(editingEntry.id));
    setEditingEntry(null);
  }, [dispatch, editingEntry]);

  const previousDayGesture = useMemo(
    () =>
      Gesture.Fling()
        .direction(Directions.RIGHT)
        .runOnJS(true)
        .onEnd(() => {
          goToPreviousDay();
        }),
    [goToPreviousDay],
  );

  const nextDayGesture = useMemo(
    () =>
      Gesture.Fling()
        .direction(Directions.LEFT)
        .runOnJS(true)
        .onEnd(() => {
          goToNextDay();
        }),
    [goToNextDay],
  );

  const swipeGesture = useMemo(
    () => Gesture.Simultaneous(previousDayGesture, nextDayGesture),
    [nextDayGesture, previousDayGesture],
  );

  const handleEditTypeChange = useCallback((value: string) => {
    if (value === 'burned' || value === 'consumed') {
      setEditType(value);
    }
  }, []);

  return (
    <>
      <Stack.Screen
        options={{
          title: t('Calories'),
        }}
      />
      <GestureDetector gesture={swipeGesture}>
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
              selectedDate={selectedDate}
              onPreviousDay={goToPreviousDay}
              onNextDay={goToNextDay}
              onSelectToday={goToToday}
              isToday={isToday}
              hasEntries={entriesForSelectedDay.length > 0}
            />
          }
          ListHeaderComponentStyle={{ marginBottom: spacing[4] }}
          ItemSeparatorComponent={() => (
            <Divider style={{ marginVertical: spacing[4] }} />
          )}
          renderItem={({ item }) => (
            <CalorieEntryCard entry={item} onPress={openEditEntry} />
          )}
          ListEmptyComponent={() => (
            <View style={{ marginTop: spacing[8], gap: spacing[2] }}>
              <SurfaceText
                color="onSurfaceVariant"
                style={{ textAlign: 'center' }}
              >
                {searchText
                  ? t('No entries match your search for this day.')
                  : t('No calorie entries for this day yet.')}
              </SurfaceText>
              {!searchText ? (
                <SurfaceText
                  color="onSurfaceVariant"
                  style={{ textAlign: 'center' }}
                  font="text-sm"
                >
                  {t('Tap an entry to view or edit details.')}
                </SurfaceText>
              ) : undefined}
            </View>
          )}
        />
      </GestureDetector>

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
              onChangeText={(value) => {
                setManualName(value);
                setManualError(undefined);
              }}
              mode="outlined"
              style={{ marginBottom: spacing[2] }}
            />
            <TextInput
              label={t('Calories (kcal)')}
              keyboardType="numeric"
              value={manualCalories}
              onChangeText={(value) => {
                setManualCalories(value);
                setManualError(undefined);
              }}
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

                    return (
                      <List.Item
                        key={food.fdcId}
                        title={food.description}
                        description={
                          calories === undefined
                            ? t('Calorie information unavailable')
                            : t('{0} kcal', {
                                0: Math.round(calories).toLocaleString(),
                              })
                        }
                        onPress={() => handleSelectUsdaFood(food)}
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

        <Dialog visible={editingEntry !== null} onDismiss={closeEditEntry}>
          <Dialog.Title>{t('Edit calorie entry')}</Dialog.Title>
          <Dialog.Content>
            {editingEntry ? (
              <View style={{ gap: spacing[2] }}>
                <SurfaceText color="onSurfaceVariant" font="text-sm">
                  {t('Logged on {0}', {
                    0: new Intl.DateTimeFormat(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }).format(new Date(editingEntry.recordedAtIso)),
                  })}
                </SurfaceText>
                <SegmentedButtons
                  value={editType}
                  onValueChange={handleEditTypeChange}
                  buttons={[
                    { value: 'consumed', label: t('Consumed') },
                    { value: 'burned', label: t('Burned') },
                  ]}
                />
                <TextInput
                  label={t('Food or activity name')}
                  value={editName}
                  onChangeText={(value) => {
                    setEditName(value);
                    setEditError(undefined);
                  }}
                  mode="outlined"
                />
                <TextInput
                  label={t('Calories (kcal)')}
                  keyboardType="numeric"
                  value={editCalories}
                  onChangeText={(value) => {
                    setEditCalories(value);
                    setEditError(undefined);
                  }}
                  mode="outlined"
                />
                <TextInput
                  label={t('Optional details')}
                  value={editNote}
                  onChangeText={setEditNote}
                  mode="outlined"
                />
                {editError ? (
                  <HelperText type="error" visible>
                    {editError}
                  </HelperText>
                ) : undefined}
              </View>
            ) : undefined}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={closeEditEntry}>{t('Cancel')}</Button>
            <Button onPress={deleteEditedEntry} icon="delete">
              {t('Delete')}
            </Button>
            <Button mode="contained" onPress={saveEditedEntry}>
              {t('Save')}
            </Button>
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
  selectedDate,
  onPreviousDay,
  onNextDay,
  onSelectToday,
  isToday,
  hasEntries,
}: {
  summary: CalorieSummary;
  searchText: string;
  setSearchText: (value: string) => void;
  onAddConsumed: () => void;
  onAddBurned: () => void;
  onFindFood: () => void;
  onOpenDietSettings: () => void;
  selectedDate: LocalDate;
  onPreviousDay: () => void;
  onNextDay: () => void;
  onSelectToday: () => void;
  isToday: boolean;
  hasEntries: boolean;
}) {
  const { t } = useTranslate();
  const { goal, consumed, burned, net } = summary;
  const goalDifference = goal - net;

  const formattedDate = useMemo(
    () =>
      formatDate(selectedDate, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }),
    [selectedDate],
  );

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
      <View style={{ gap: spacing[1] }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <IconButton
            icon="chevronLeft"
            onPress={onPreviousDay}
            accessibilityLabel={t('Previous day')}
          />
          <View style={{ flex: 1, alignItems: 'center', gap: spacing[1] }}>
            <SurfaceText
              font="text-lg"
              weight="bold"
              style={{ textAlign: 'center' }}
            >
              {formattedDate}
            </SurfaceText>
            {isToday ? (
              <SurfaceText color="primary" font="text-xs">
                {t('Today')}
              </SurfaceText>
            ) : undefined}
          </View>
          <IconButton
            icon="chevronRight"
            onPress={onNextDay}
            accessibilityLabel={t('Next day')}
          />
        </View>
        <Button
          mode="text"
          onPress={onSelectToday}
          icon="calendarToday"
          disabled={isToday}
          accessibilityLabel={t('Go to today')}
          style={{ alignSelf: 'center' }}
        >
          {t('Today')}
        </Button>
        <SurfaceText
          color="onSurfaceVariant"
          font="text-xs"
          style={{ textAlign: 'center' }}
        >
          {t('Swipe left or right to change the day.')}
        </SurfaceText>
      </View>
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
      {hasEntries ? (
        <SurfaceText color="onSurfaceVariant" font="text-xs">
          {t('Tap an entry to view or edit details.')}
        </SurfaceText>
      ) : undefined}
    </View>
  );
}

function CalorieEntryCard({
  entry,
  onPress,
}: {
  entry: CalorieEntry;
  onPress: (entry: CalorieEntry) => void;
}) {
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
    <SingleValueStatisticCard
      title={entry.name}
      onPress={() => onPress(entry)}
      testID="calorie-entry-card"
    >
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
        <SurfaceText font="text-xs" color="primary">
          {t('Tap to edit entry')}
        </SurfaceText>
      </View>
    </SingleValueStatisticCard>
  );
}
