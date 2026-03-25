'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { Camera, Scan, Shield, Zap } from 'lucide-react';
import AppLogo from '@/components/app-logo';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { fadeInUp, staggerContainer, staggerItem } from '@/lib/animations';

const PERKS = [
  { icon: Scan,   text: 'AI finds your photos automatically' },
  { icon: Shield, text: 'Private — only you see your photos' },
  { icon: Zap,    text: 'Delivered instantly after upload' },
];

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) router.replace('/dashboard');
  }, [router]);

  return (
    <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!}>
      <div
        className="flex min-h-screen w-full"
        style={{ background: '#f8f5f0' }}
      >
        {/* Left panel — visible on lg+ */}
        <motion.div
          className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12"
          style={{ background: '#0f1a2e' }}
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
        >
          <AppLogo />

          <div className="space-y-8">
            <div>
              <h2 className="text-4xl font-bold text-white leading-tight">
                Every photo of you,<br />
                <span style={{ color: '#c9963a' }}>found automatically.</span>
              </h2>
              <p className="mt-4 text-slate-400 text-lg leading-relaxed">
                FaceShare uses AI face recognition to scan event photos and deliver only the ones you appear in.
              </p>
            </div>

            <motion.div
              className="space-y-4"
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
            >
              {PERKS.map((p) => (
                <motion.div
                  key={p.text}
                  variants={staggerItem}
                  className="flex items-center gap-3"
                >
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: 'rgba(201,150,58,0.15)' }}
                  >
                    <p.icon className="h-4 w-4" style={{ color: '#c9963a' }} />
                  </div>
                  <span className="text-slate-300 text-sm">{p.text}</span>
                </motion.div>
              ))}
            </motion.div>
          </div>

          <p className="text-slate-600 text-xs">© 2025 FaceShare</p>
        </motion.div>

        {/* Right panel — sign-in form */}
        <div className="flex w-full lg:w-1/2 flex-col items-center justify-center px-6 py-12">
          {/* Mobile logo */}
          <div className="mb-8 lg:hidden">
            <AppLogo />
          </div>

          <motion.div
            className="w-full max-w-sm space-y-8"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            <motion.div variants={staggerItem} className="space-y-2 text-center">
              <div
                className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
                style={{ background: '#0f1a2e' }}
              >
                <Camera className="h-7 w-7" style={{ color: '#c9963a' }} />
              </div>
              <h1 className="text-2xl font-bold" style={{ color: '#0f1a2e' }}>
                Welcome back
              </h1>
              <p className="text-sm" style={{ color: '#6b7280' }}>
                Sign in with Google to access your photos
              </p>
            </motion.div>

            {/* Google sign-in button */}
            <motion.div
              variants={staggerItem}
              className="flex flex-col items-center gap-4"
            >
              <div
                className="w-full rounded-2xl border p-6 shadow-sm"
                style={{ background: 'white', borderColor: '#e8e2d9' }}
              >
                <div className="flex justify-center">
                  <GoogleLogin
                    onSuccess={async (cred) => {
                      try {
                        await apiClient.googleLogin(cred.credential!);
                        router.push('/dashboard');
                      } catch (error) {
                        toast({
                          variant: 'destructive',
                          title: 'Sign-in failed',
                          description: error instanceof Error ? error.message : 'Something went wrong — give it another try.',
                        });
                      }
                    }}
                    onError={() => {
                      toast({ variant: 'destructive', title: 'Google sign-in failed', description: 'Try again or use a different account.' });
                    }}
                    width="300"
                    shape="pill"
                    size="large"
                    text="continue_with"
                  />
                </div>
              </div>

              <p className="text-center text-xs" style={{ color: '#9ca3af' }}>
                By signing in you agree to our Terms of Service.<br />
                New users are automatically registered.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </GoogleOAuthProvider>
  );
}
