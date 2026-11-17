import { Pressable, View } from 'react-native';

import { formatMealTime } from '@/domain/dates';
import { formatInt, MEAL_TYPE_LABEL } from '@/domain/format';
import type { SavedMeal } from '@/domain/types';
import { colors } from '@/theme/theme';

import { AppText } from './AppText';
import { PhotoPlaceholder } from './PhotoPlaceholder';

export type MealCardProps = {
  meal: SavedMeal;
  onPress?: () => void;
};

/** Design §7 Meal card: surface, radius 22, padding 10, 58 × 58 thumb (radius 16). */
export function MealCard({ meal, onPress }: MealCardProps) {
  const time = formatMealTime(meal.eatenAt);
  const type = MEAL_TYPE_LABEL[meal.mealType];
  const protein = Math.round(meal.proteinG);
  const kcal = formatInt(meal.kcal);

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${meal.displayName}, ${type} at ${time}, ${kcal} calories, ${protein} grams protein`}
      style={({ pressed }) => ({
        backgroundColor: colors.surface,
        borderRadius: 22,
        padding: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <PhotoPlaceholder />
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText size={14} weight={700} numberOfLines={2}>
          {meal.displayName}
        </AppText>
        <AppText size={12} weight={500} color="textMuted" style={{ marginTop: 2 }}>
          {type} · {time} · {protein} g protein
        </AppText>
      </View>
      <View style={{ alignItems: 'flex-end', paddingRight: 6 }}>
        <AppText size={15} weight={700} numeric>
          {kcal}
        </AppText>
        <AppText size={11} weight={500} color="textMuted">
          kcal
        </AppText>
      </View>
    </Pressable>
  );
}
