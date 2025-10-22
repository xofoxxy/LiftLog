import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { useTranslate } from '@tolgee/react';
import { FlashList } from '@shopify/flash-list';
import { Divider, Searchbar } from 'react-native-paper';
import { FlatGrid } from 'react-native-super-grid';

import { useScroll } from '@/hooks/useScollListener';
import { spacing, type ColorChoice } from '@/hooks/useAppTheme';
import SingleValueStatisticCard from '@/components/presentation/single-value-statistic-card';
import { SurfaceText } from '@/components/presentation/surface-text';

const DAILY_GOAL = 2400;

type CalorieEntry = {
  id: string;
  title: string;
  description: string;
  calories: number;
  type: 'consumed' | 'burned';
  time: string;
};

type CalorieSummary = {
  goal: number;
  consumed: number;
  burned: number;
  net: number;
};

const SAMPLE_ENTRIES: CalorieEntry[] = [
  {
    id: 'breakfast',
    title: 'Breakfast',
    description: 'Greek yogurt, granola, blueberries',
    calories: 420,
    type: 'consumed',
    time: '08:00',
  },
  {
    id: 'run',
    title: 'Morning Run',
    description: '5 km tempo run',
    calories: 310,
    type: 'burned',
    time: '07:15',
  },
  {
    id: 'lunch',
    title: 'Lunch',
    description: 'Grilled chicken, quinoa, roasted vegetables',
    calories: 680,
    type: 'consumed',
    time: '12:30',
  },
  {
    id: 'snack',
    title: 'Afternoon Snack',
    description: 'Almonds and protein shake',
    calories: 260,
    type: 'consumed',
    time: '15:45',
  },
  {
    id: 'lifting',
    title: 'Strength Training',
    description: '45 minute compound lift session',
    calories: 210,
    type: 'burned',
    time: '17:00',
  },
  {
    id: 'dinner',
    title: 'Dinner',
    description: 'Salmon, sweet potato, asparagus',
    calories: 720,
    type: 'consumed',
    time: '19:00',
  },
];

export default function CaloriesPage() {
  const { t } = useTranslate();
  const { handleScroll } = useScroll();
  const [searchText, setSearchText] = useState('');

  const summary = useMemo<CalorieSummary>(() => {
    const consumed = SAMPLE_ENTRIES.filter((entry) => entry.type === 'consumed')
      .map((entry) => entry.calories)
      .reduce((acc, value) => acc + value, 0);
    const burned = SAMPLE_ENTRIES.filter((entry) => entry.type === 'burned')
      .map((entry) => entry.calories)
      .reduce((acc, value) => acc + value, 0);

    return {
      goal: DAILY_GOAL,
      consumed,
      burned,
      net: consumed - burned,
    };
  }, []);

  const filteredEntries = useMemo(() => {
    const lower = searchText.toLocaleLowerCase();
    return SAMPLE_ENTRIES.filter((entry) =>
      `${entry.title} ${entry.description}`.toLocaleLowerCase().includes(lower),
    );
  }, [searchText]);

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
          </View>
        )}
      />
    </>
  );
}

function ListHeader({
  summary,
  searchText,
  setSearchText,
}: {
  summary: CalorieSummary;
  searchText: string;
  setSearchText: (value: string) => void;
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

  return (
    <SingleValueStatisticCard title={entry.title}>
      <View style={{ alignItems: 'center', gap: spacing[1] }}>
        <SurfaceText color={highlightColor} font="text-2xl" weight="bold">
          {`${entry.calories.toLocaleString()} kcal`}
        </SurfaceText>
        <SurfaceText
          font="text-sm"
          color="onSurfaceVariant"
          style={{ textAlign: 'center' }}
        >
          {entry.description}
        </SurfaceText>
        <SurfaceText font="text-xs" color="onSurfaceVariant">
          {`${t(entry.type === 'consumed' ? 'Consumed' : 'Burned')} • ${entry.time}`}
        </SurfaceText>
      </View>
    </SingleValueStatisticCard>
  );
}
