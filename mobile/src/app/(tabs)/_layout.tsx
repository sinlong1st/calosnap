import { useRouter } from 'expo-router';
import { Tabs } from 'expo-router/tabs';

import { TabBar } from '@/components/TabBar';
import { colors } from '@/theme/theme';

export default function TabsLayout() {
  const router = useRouter();
  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
      tabBar={(props) => <TabBar {...props} onScanPress={() => router.push('/scan')} />}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="history" options={{ title: 'History' }} />
    </Tabs>
  );
}
