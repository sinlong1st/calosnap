import type { BottomTabBarProps } from 'expo-router/tabs';
import { Pressable, View } from 'react-native';

import { boardColors, colors, shadow, size } from '@/theme/theme';

import { AppText } from './AppText';

const LABELS: Record<string, string> = { index: 'Home', history: 'History' };

/** Placeholder glyph until the icon library is chosen (D14): filled = active, outline = inactive. */
function TabGlyph({ active }: { active: boolean }) {
  return (
    <View
      style={{
        width: 22,
        height: 22,
        borderRadius: 7,
        backgroundColor: active ? colors.primary : 'transparent',
        borderWidth: active ? 0 : 2,
        borderColor: colors.textSubtle,
      }}
    />
  );
}

export type TabBarProps = BottomTabBarProps & {
  /** The centre Scan action opens the scan modal; it is not a tab (Design §5). */
  onScanPress: () => void;
};

/**
 * Design §7 Tab bar: 86 pt incl. home indicator, three items, raised 60 pt Scan button
 * offset −28. Built from the SDK 58 `BottomTabBarProps` contract (emit `tabPress`,
 * then `navigateToTab`).
 */
export function TabBar({ state, emitter, navigateToTab, insets, onScanPress }: TabBarProps) {
  const [home, history] = state.routes;

  const renderTab = (routeIndex: number) => {
    const route = state.routes[routeIndex];
    if (!route) return <View style={{ flex: 1 }} />;
    const focused = state.index === routeIndex;
    const label = LABELS[route.name] ?? route.name;
    const onPress = () => {
      const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!focused && !event.defaultPrevented) navigateToTab(route.key);
    };
    return (
      <Pressable
        key={route.key}
        testID={`tab-${route.name}`}
        onPress={onPress}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={label}
        style={{ flex: 1, alignItems: 'center', gap: 4, minHeight: size.touchMin }}
      >
        <TabGlyph active={focused} />
        <AppText size={11} weight={focused ? 700 : 600} color={focused ? 'primary' : 'textSubtle'} maxFontSizeMultiplier={1.3}>
          {label}
        </AppText>
      </Pressable>
    );
  };

  return (
    <View
      accessibilityRole="tablist"
      style={{
        height: Math.max(size.tabBarHeight, 52 + insets.bottom),
        paddingBottom: insets.bottom,
        paddingTop: 10,
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: boardColors.tabBarBorder,
      }}
    >
      {home ? renderTab(0) : null}
      <Pressable
        testID="tab-scan"
        onPress={onScanPress}
        accessibilityRole="button"
        accessibilityLabel="Scan a meal"
        style={{ flex: 1, alignItems: 'center', gap: 4, marginTop: -28 }}
      >
        <View
          style={{
            width: size.scanButton,
            height: size.scanButton,
            borderRadius: size.scanButton / 2,
            backgroundColor: colors.primary,
            boxShadow: shadow.scanButton,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 3, borderColor: colors.onPrimary }} />
        </View>
        <AppText size={11} weight={700} color="primary" maxFontSizeMultiplier={1.3}>
          Scan
        </AppText>
      </Pressable>
      {history ? renderTab(1) : null}
    </View>
  );
}
