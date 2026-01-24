'use client';

import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { Image, ShieldCheck, Users } from 'lucide-react';
import { events } from '@/lib/data';
import { cn } from '@/lib/utils';

export default function EventLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useParams();
  const eventId = params.id as string;
  const event = events.find((e) => e.id === eventId);
  const basePath = `/dashboard/events/${eventId}`;

  const navItems = [
    { href: basePath, label: 'Gallery', icon: Image },
    { href: `${basePath}/review`, label: 'Review', icon: ShieldCheck },
    { href: `${basePath}/participants`, label: 'Participants', icon: Users },
  ];

  if (!event) {
    return (
      <div className="flex h-full items-center justify-center">
        <p>Event not found.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">{event.name}</h1>
        <p className="text-muted-foreground">{event.description}</p>
      </div>
      <div className="mb-4 border-b">
        <nav className="-mb-px flex space-x-6">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                'flex items-center gap-2 whitespace-nowrap border-b-2 px-1 pb-4 text-sm font-medium',
                (pathname === item.href || (item.href !== basePath && pathname.startsWith(item.href)))
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:border-gray-300 hover:text-gray-600'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}
