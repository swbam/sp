'use client';

import { useEffect } from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { useSessionContext, useSupabaseClient } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/navigation';

import { useAuthModal } from "@/hooks/useAuthModal";
import { Modal } from './Modal';
import type { Database } from '@/types_db';

const AuthModal = () => {
  const { session } = useSessionContext();
  const router = useRouter();
  const { onClose, isOpen } = useAuthModal();
  const supabaseClient = useSupabaseClient<Database>();

  useEffect(() => {
    if (session) {
      router.refresh();
      onClose();
    }
  }, [session, router, onClose]);

  const onChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  }

  return (
    <Modal
      title="Welcome back"
      description="Login to your account"
      isOpen={isOpen}
      onChange={onChange}
    >
      <Auth
        theme="dark"
        providers={['spotify']}
        supabaseClient={supabaseClient as any}
        appearance={{
          theme: ThemeSupa,
          variables: {
            default: {
              colors: {
                brand: '#1DB954',
                brandAccent: '#1ed760'
              }
            }
          }
        }}
        providerScopes={{
          spotify: 'user-read-email user-follow-read user-top-read'
        }}
        redirectTo={`${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`}
      />
    </Modal>
  );
}

export default AuthModal;
