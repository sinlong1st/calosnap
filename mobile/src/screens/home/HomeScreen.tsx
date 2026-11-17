import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDay, useMe } from '@/api/ApiProvider';
import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { CalorieArc } from '@/components/CalorieArc';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { MacroBar } from '@/components/MacroBar';
import { MealCard } from '@/components/MealCard';
import { WeekStrip } from '@/components/WeekStrip';
import { useNow, useToday } from '@/domain/clock';
import { dayPart, formatHeaderDate, lastNDays } from '@/domain/dates';
import { formatInt, GOAL_LABEL } from '@/domain/format';
import type { DaySummary, LocalDate, Profile } from '@/domain/types';
import { boardColors, colors, space } from '@/theme/theme';

/**
 * Home dashboard — H1 (empty day) and H2 (in progress). H3 (after save + Undo toast)
 * is wired in Checkpoint 3. Totals come only from saved meals via `getDay`.
 */
export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const now = useNow();
  const today = useToday();
  const me = useMe();
  const day = useDay(today);

  const openHistory = (date?: LocalDate) =>
    router.navigate(date ? { pathname: '/history', params: { date } } : '/history');
  const openScan = () => router.push('/scan');
  const openProfile = () => router.push('/profile');

  const profile = me.data?.profile;
  const refreshing = (me.isRefetching || day.isRefetching) && !day.isLoading;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{
        paddingTop: insets.top + 8,
        paddingHorizontal: space.screenX,
        paddingBottom: space['5'],
      }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            void me.refetch();
            void day.refetch();
          }}
          tintColor={colors.primary}
        />
      }
    >
      <LinearGradient
        colors={[colors.homeGradientTop, colors.bg]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 240 + insets.top }}
        pointerEvents="none"
      />

      <Header
        date={today}
        profile={profile}
        hour={now().getHours()}
        onAvatarPress={openProfile}
      />

      {profile && !profile.isNewUser ? (
        <View style={{ marginBottom: 14 }}>
          <WeekStrip days={lastNDays(today, 7)} selected={today} onSelect={(d) => openHistory(d)} />
        </View>
      ) : null}

      {day.isError ? (
        <View style={{ gap: 12 }}>
          <Banner tone="error" message="Couldn't load today's diary." />
          <Button label="Try again" variant="secondary" onPress={() => void day.refetch()} />
        </View>
      ) : !day.data || !profile ? (
        <CalorieCardSkeleton />
      ) : (
        <>
          <CalorieCard day={day.data} profile={profile} />
          {day.data.meals.length > 0 ? (
            <>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: 18,
                  marginBottom: 10,
                  marginHorizontal: 4,
                }}
              >
                <AppText size={16} weight={700} accessibilityRole="header">
                  Today
                </AppText>
                <Pressable accessibilityRole="link" onPress={() => openHistory()} hitSlop={12}>
                  <AppText size={13} weight={700} color="primary">
                    History
                  </AppText>
                </Pressable>
              </View>
              <View style={{ gap: 8 }}>
                {day.data.meals.map((m) => (
                  <MealCard key={m.id} meal={m} onPress={() => openHistory(today)} />
                ))}
              </View>
            </>
          ) : (
            <EmptyDayCard onScan={openScan} />
          )}
        </>
      )}
    </ScrollView>
  );
}

function Header({
  date,
  profile,
  hour,
  onAvatarPress,
}: {
  date: LocalDate;
  profile: Profile | undefined;
  hour: number;
  onAvatarPress: () => void;
}) {
  const name = profile?.displayName ?? '';
  const greeting = profile?.isNewUser ? `Welcome, ${name}` : `Good ${dayPart(hour)}, ${name}`;
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
      <View style={{ flex: 1 }}>
        <AppText variant="caption" color="textMuted">
          {formatHeaderDate(date)}
        </AppText>
        <AppText variant="title2" accessibilityRole="header">
          {profile ? greeting : ' '}
        </AppText>
      </View>
      <Pressable
        testID="avatar"
        onPress={onAvatarPress}
        accessibilityRole="button"
        accessibilityLabel="Profile and settings"
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <AppText size={16} weight={700} color="onPrimary" maxFontSizeMultiplier={1}>
          {name.slice(0, 1).toUpperCase()}
        </AppText>
      </Pressable>
    </View>
  );
}

function CalorieCard({ day, profile }: { day: DaySummary; profile: Profile }) {
  const t = day.target.values;
  const eaten = day.totals;
  const hasMeals = day.meals.length > 0;

  return (
    <Card large elevated testID="calorie-card">
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <AppText size={16} weight={700}>
          Calories
        </AppText>
        {t ? (
          <Chip
            label={`${day.target.source === 'manual' ? 'Manual' : GOAL_LABEL[profile.goal]} · ${formatInt(t.kcal)}`}
            background={boardColors.goalPill}
          />
        ) : null}
      </View>

      {t ? (
        <>
          <CalorieArc consumed={eaten.kcal} target={t.kcal} testID="calorie-arc" />
          {hasMeals ? (
            <AppText size={12} weight={500} color="textMuted" align="center" style={{ marginBottom: 14 }} numeric>
              {formatInt(eaten.kcal)} eaten of {formatInt(t.kcal)}
            </AppText>
          ) : null}
          <View style={{ gap: 12, marginTop: hasMeals ? 0 : 10 }}>
            <MacroBar name="Protein" eaten={eaten.proteinG} target={t.proteinG} showRemaining={hasMeals} />
            <MacroBar name="Carbs" eaten={eaten.carbsG} target={t.carbsG} showRemaining={hasMeals} />
            <MacroBar name="Fat" eaten={eaten.fatG} target={t.fatG} showRemaining={hasMeals} />
          </View>
        </>
      ) : (
        <NoTargetBody kcal={eaten.kcal} proteinG={eaten.proteinG} carbsG={eaten.carbsG} fatG={eaten.fatG} />
      )}
    </Card>
  );
}

/** Shown when no recommended or manual target exists (v1.2 §4 T10). Copy pending PO review. */
function NoTargetBody(t: { kcal: number; proteinG: number; carbsG: number; fatG: number }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 18, gap: 6 }}>
      <AppText variant="display" numeric>
        {formatInt(t.kcal)}
      </AppText>
      <AppText variant="caption" color="textMuted">
        kcal eaten today
      </AppText>
      <AppText size={12} weight={600} color="textMuted" numeric style={{ marginTop: 6 }}>
        P {Math.round(t.proteinG)} g · C {Math.round(t.carbsG)} g · F {Math.round(t.fatG)} g
      </AppText>
      {/* COPY-PENDING (D16): no-target note */}
      <AppText variant="caption" color="textMuted" align="center" style={{ marginTop: 8 }}>
        No daily target set. You can add targets in Profile.
      </AppText>
    </View>
  );
}

function EmptyDayCard({ onScan }: { onScan: () => void }) {
  return (
    <View
      testID="empty-day"
      style={{
        marginTop: 14,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: boardColors.dashedBorder,
        borderRadius: 24,
        padding: 22,
        alignItems: 'center',
      }}
    >
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: colors.accentTint,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 10,
        }}
      >
        <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 3, borderColor: colors.primary }} />
      </View>
      <AppText size={16} weight={700} align="center">
        No meals logged today
      </AppText>
      <AppText variant="caption" color="textMuted" align="center" style={{ marginTop: 4, marginBottom: 14 }}>
        {"Take a photo of your next meal. It's only added after you review it and tap Save."}
      </AppText>
      <Button label="Scan a meal" size="small" onPress={onScan} />
    </View>
  );
}

function CalorieCardSkeleton() {
  const block = (h: number, w: number | `${number}%`, mt = 0) => (
    <View style={{ height: h, width: w, borderRadius: 8, backgroundColor: colors.surfaceMuted, marginTop: mt }} />
  );
  return (
    <Card large elevated accessibilityLabel="Loading today's totals" accessible>
      {block(18, 90)}
      <View style={{ alignItems: 'center' }}>{block(120, 230, 18)}</View>
      {block(10, '100%', 18)}
      {block(10, '100%', 18)}
      {block(10, '100%', 18)}
    </Card>
  );
}
