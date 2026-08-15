import { useEffect, useRef } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { HostView } from '../../components/HostView';
import { useGameSocket } from '../../context/SocketContext';

export const Route = createFileRoute('/codeimpostor/host')({
  component: HostRoute,
});

function HostRoute() {
  const { socket, createRoom } = useGameSocket();
  const createRoomAttemptedRef = useRef(false);

  useEffect(() => {
    if (createRoomAttemptedRef.current) return;
    if (!socket) return;
    createRoomAttemptedRef.current = true;
    createRoom();
  }, [socket, createRoom]);

  return <HostView />;
}
