import useSWR from 'swr';
import { apiClient, ImageQuality } from '@/lib/api';

interface AppConfig {
  image_quality: ImageQuality;
}

const FALLBACK: AppConfig = { image_quality: 'optimized' };

export function useAppConfig() {
  const { data } = useSWR<AppConfig>(
    'app-config',
    () => apiClient.getAppConfig(),
    {
      fallbackData: FALLBACK,
      // Re-fetch every 5 minutes — matches the SSM cache TTL on the backend
      refreshInterval: 5 * 60 * 1000,
      // Don't throw on error; fall back to optimized silently
      onError: () => {},
    },
  );
  return data ?? FALLBACK;
}
