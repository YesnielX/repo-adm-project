import { createFileRoute } from '@tanstack/react-router';
import { PlayerView } from '../../components/PlayerView';

interface UnirseSearch {
  room?: string;
}

const FOUR_DIGITS = /^\d{4}$/;

export const Route = createFileRoute('/codeimpostor/unirse')({
  validateSearch: (search: Record<string, unknown>): UnirseSearch => ({
    room:
      typeof search.room === 'string' && FOUR_DIGITS.test(search.room)
        ? search.room
        : undefined,
  }),
  component: UnirseRoute,
});

function UnirseRoute() {
  const { room } = Route.useSearch();
  return <PlayerView roomParam={room ?? ''} />;
}
