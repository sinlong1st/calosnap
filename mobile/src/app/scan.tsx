import { useRouter } from 'expo-router';

import { PlaceholderScreen } from '@/components/PlaceholderScreen';

export default function ScanRoute() {
  const router = useRouter();
  return (
    <PlaceholderScreen
      dark
      title="Scan"
      note="Camera, preview, analysis and Precision questions (S1–S3, A1–A3, P1–P3) are built in Checkpoint 2. Closing this screen saves nothing."
      onBack={() => router.back()}
    />
  );
}
