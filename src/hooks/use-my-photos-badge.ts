'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiClient } from '@/lib/api';

const STORAGE_KEY = 'faceshare_myphotos_count';

function getStoredCount(): number {
  if (typeof window === 'undefined') return 0;
  return parseInt(localStorage.getItem(STORAGE_KEY) ?? '0', 10);
}

export function useMyPhotosBadge() {
  const [newCount, setNewCount] = useState(0);

  useEffect(() => {
    apiClient.getMyPhotos()
      .then((groups) => {
        const total = groups.reduce((sum, g) => sum + g.photos.length, 0);
        const prev  = getStoredCount();
        setNewCount(Math.max(0, total - prev));
      })
      .catch(() => {});
  }, []);

  const clearBadge = useCallback(() => {
    apiClient.getMyPhotos()
      .then((groups) => {
        const total = groups.reduce((sum, g) => sum + g.photos.length, 0);
        localStorage.setItem(STORAGE_KEY, String(total));
        setNewCount(0);
      })
      .catch(() => {});
  }, []);

  return { newCount, clearBadge };
}
