'use client';

import { Camera } from 'lucide-react';
import Link from 'next/link';

export default function AppLogo() {
  const isSignedIn =
    typeof window !== 'undefined' && !!localStorage.getItem('access_token');

  return (
    <Link
      href={isSignedIn ? '/dashboard' : '/'}
      className="flex items-center gap-2"
      prefetch={false}
    >
      <Camera className="h-6 w-6 text-primary" />
      <span className="text-xl font-bold">FaceShare</span>
    </Link>
  );
}
