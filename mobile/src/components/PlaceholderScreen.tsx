import type { ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, space } from '@/theme/theme';

import { AppText } from './AppText';

/** Temporary screen shell for routes whose real UI lands in a later checkpoint. */
export function PlaceholderScreen({
  title,
  note,
  onBack,
  dark,
  children,
}: {
  title: string;
  note: string;
  onBack?: () => void;
  dark?: boolean;
  children?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: dark ? colors.camera : colors.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: space.screenX, paddingBottom: 40 }}
    >
      {onBack ? (
        <Pressable
          testID="placeholder-back"
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={dark ? 'Close' : 'Back'}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: dark ? colors.cameraGlass : colors.surface,
            marginBottom: 16,
          }}
        >
          <AppText size={22} weight={500} color={dark ? 'onCamera' : 'text'} maxFontSizeMultiplier={1}>
            {dark ? '×' : '‹'}
          </AppText>
        </Pressable>
      ) : null}
      <AppText variant="title1" color={dark ? 'onCamera' : 'text'} accessibilityRole="header">
        {title}
      </AppText>
      <View
        style={{
          marginTop: 12,
          padding: 14,
          borderRadius: 14,
          backgroundColor: dark ? colors.cameraGlass : colors.surfaceMuted,
        }}
      >
        <AppText variant="caption" color={dark ? 'onCameraMuted' : 'textMuted'}>
          {note}
        </AppText>
      </View>
      {children}
    </ScrollView>
  );
}
