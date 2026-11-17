import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { apiClient } from '@/api';
import { MOCK_SCENARIOS, type MockScenario } from '@/api/mock/fixtures';
import { AppText } from '@/components/AppText';
import { PlaceholderScreen } from '@/components/PlaceholderScreen';
import { SelectableCard } from '@/components/SelectableCard';

/**
 * Profile & settings (U1/U2) arrive in Checkpoint 4. For review, this screen hosts a
 * developer-only switch between mock datasets so H1, H2 and edge states can be checked.
 */
export function ProfilePlaceholder() {
  const router = useRouter();
  const qc = useQueryClient();
  const [scenario, setScenario] = useState<MockScenario>(apiClient.currentScenario);

  const choose = (s: MockScenario) => {
    apiClient.setScenario(s);
    setScenario(s);
    void qc.invalidateQueries();
  };

  return (
    <PlaceholderScreen
      title="Profile"
      note="Profile & settings (U1) and Goals & targets (U2) are built in Checkpoint 4."
      onBack={() => router.back()}
    >
      {__DEV__ ? (
        <View style={{ marginTop: 28, gap: 10 }}>
          <AppText size={12} weight={700} color="textMuted" style={{ letterSpacing: 0.5, marginLeft: 4 }}>
            DEVELOPER · MOCK DATA
          </AppText>
          {MOCK_SCENARIOS.map((s) => (
            <SelectableCard
              key={s.id}
              testID={`scenario-${s.id}`}
              title={s.label}
              description={s.note}
              selected={scenario === s.id}
              onPress={() => choose(s.id)}
            />
          ))}
        </View>
      ) : null}
    </PlaceholderScreen>
  );
}
