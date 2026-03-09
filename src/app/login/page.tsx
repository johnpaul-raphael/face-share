'use client';

import { useRouter } from 'next/navigation';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import AppLogo from '@/components/app-logo';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();

  return (
    <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!}>
      <div className="flex min-h-screen w-full items-center justify-center bg-background px-4">
        <div className="w-full max-w-md space-y-4">
          <div className="flex justify-center">
            <AppLogo />
          </div>
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Sign in to FaceShare</CardTitle>
              <CardDescription>
                Use your Google account to sign in or create a new account.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center py-4">
              <GoogleLogin
                onSuccess={async (cred) => {
                  try {
                    await apiClient.googleLogin(cred.credential!);
                    router.push('/dashboard');
                  } catch (error) {
                    toast({
                      variant: 'destructive',
                      title: 'Sign in failed',
                      description: error instanceof Error ? error.message : 'Failed to sign in.',
                    });
                  }
                }}
                onError={() => {
                  toast({ variant: 'destructive', title: 'Google sign in failed' });
                }}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </GoogleOAuthProvider>
  );
}
