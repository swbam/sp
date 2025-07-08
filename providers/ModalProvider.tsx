'use client';

import { useState, useEffect } from 'react';

import { AuthModal } from '@/components/AuthModal';

export const ModalProvider: React.FC = () => {
  const [isMounted, setIsMounted] = useState(false);

  //* useEffect hook to set isMounted to true after the initial render
  //* This prevents the modals from rendering on the server-side (SSR)
  useEffect(() => {
    setIsMounted(true);
  }, []);

  //* If the component is not mounted, don't render anything
  if (!isMounted) {
    return null;
  }

  //* Once the component is mounted, render the AuthModal component
  return (
    <>
      <AuthModal />
    </>
  );
};
