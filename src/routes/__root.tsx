import { useEffect } from 'react';
import { createRootRoute, Outlet } from '@tanstack/react-router';
import { bind, setEnabled, setVolume } from 'cuelume';
import { ThemeProvider } from '../context/ThemeContext';
import { SocketProvider } from '../context/SocketContext';

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  useEffect(() => {
    bind();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setEnabled(false);
    } else {
      setVolume(0.7);
    }
  }, []);

  return (
    <ThemeProvider>
      <SocketProvider>
        <Outlet />
      </SocketProvider>
    </ThemeProvider>
  );
}
