import FullHeightScrollView from '@/components/presentation/full-height-scroll-view';
import { SurfaceText } from '@/components/presentation/surface-text';
import { spacing } from '@/hooks/useAppTheme';
import { Stack } from 'expo-router';
import { useTranslate } from '@tolgee/react';

export default function DietDisclaimerScreen() {
  const { t } = useTranslate();

  return (
    <FullHeightScrollView
      contentContainerStyle={{
        paddingHorizontal: spacing.pageHorizontalMargin,
        paddingVertical: spacing[4],
        gap: spacing[3],
      }}
    >
      <Stack.Screen options={{ title: t('Diet calculation disclaimer') }} />
      <SurfaceText>
        {t(
          'LiftLog estimates basal metabolic rate using the Mifflin-St Jeor equation, which considers weight, height, age, and sex to approximate resting energy expenditure.',
        )}
      </SurfaceText>
      <SurfaceText>
        {t(
          'We multiply the basal rate by an activity factor that you choose to project total daily energy expenditure. These factors are industry-standard estimates and may not reflect your individual metabolism.',
        )}
      </SurfaceText>
      <SurfaceText>
        {t(
          'When suggesting calorie targets for weight change, LiftLog assumes 7700 kcal per kilogram (3500 kcal per pound) of weight change distributed across the week. Real-world outcomes can differ due to body composition, hormones, sleep, and other health considerations.',
        )}
      </SurfaceText>
      <SurfaceText color="onSurfaceVariant">
        {t(
          'The calorie calculator is intended for educational use only. Always consult a licensed medical professional or registered dietitian before making significant dietary changes.',
        )}
      </SurfaceText>
    </FullHeightScrollView>
  );
}
