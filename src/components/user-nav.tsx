'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import useSWR from 'swr';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { apiClient } from '@/lib/api';
import type { User } from '@/lib/types';

export function UserNav() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    apiClient.getCurrentUser().then(setUser).catch(() => {});
  }, []);

  const { data: faceProfile } = useSWR(
    'face-profile-nav',
    () => apiClient.getFaceProfile().catch(() => null),
    { revalidateOnFocus: false },
  );

  const facePhotoUrl = faceProfile?.images?.[0]?.url ?? null;
  const avatarSrc = facePhotoUrl ?? user?.avatarUrl ?? null;
  const initials = user?.name?.charAt(0)?.toUpperCase() ?? '?';

  const handleLogout = () => {
    apiClient.logout();
    router.push('/');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className="relative h-8 w-8 rounded-full outline-none"
        >
          <Avatar className="h-8 w-8 ring-2 ring-transparent hover:ring-primary/30 transition-all">
            {avatarSrc && <AvatarImage src={avatarSrc} alt={user?.name ?? ''} referrerPolicy="no-referrer" />}
            <AvatarFallback className="text-xs font-semibold">{initials}</AvatarFallback>
          </Avatar>
        </motion.button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-56"
        align="end"
        forceMount
        style={{ animation: 'none' }}
        asChild
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        >
          <DropdownMenuLabel className="font-normal">
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9">
                {avatarSrc && <AvatarImage src={avatarSrc} alt={user?.name ?? ''} referrerPolicy="no-referrer" />}
                <AvatarFallback className="text-xs font-semibold">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col space-y-0.5">
                <p className="text-sm font-medium leading-none">{user?.name ?? '…'}</p>
                <p className="text-xs leading-none text-muted-foreground">{user?.email ?? ''}</p>
              </div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <Link href="/dashboard/profile">Profile</Link>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
            Log out
          </DropdownMenuItem>
        </motion.div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
