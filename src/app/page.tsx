import Link from 'next/link';
import { Button } from '@/components/ui/button';
import AppLogo from '@/components/app-logo';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
        <AppLogo />
        <div className="flex items-center gap-2">
          <Button variant="ghost" asChild>
            <Link href="/login">Login</Link>
          </Button>
          <Button asChild>
            <Link href="/signup">Sign Up</Link>
          </Button>
        </div>
      </header>
      <main className="flex-1">
        <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48">
          <div className="container mx-auto px-4 md:px-6">
            <div className="grid gap-6 lg:grid-cols-[1fr_400px] lg:gap-12 xl:grid-cols-[1fr_600px]">
              <div className="flex flex-col justify-center space-y-4">
                <div className="space-y-2">
                  <h1 className="text-3xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none">
                    Never Miss a Moment
                  </h1>
                  <p className="max-w-[600px] text-muted-foreground md:text-xl">
                    FaceShare uses advanced face recognition to automatically
                    find and deliver photos of you from any event. Just join an
                    event, and let us do the rest.
                  </p>
                </div>
                <div className="flex flex-col gap-2 min-[400px]:flex-row">
                  <Button size="lg" asChild>
                    <Link href="/signup">Get Started</Link>
                  </Button>
                  <Button size="lg" variant="secondary" asChild>
                    <Link href="/dashboard">View Demo</Link>
                  </Button>
                </div>
              </div>
              <div className="mx-auto aspect-video w-full overflow-hidden rounded-xl bg-muted lg:order-last" />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
