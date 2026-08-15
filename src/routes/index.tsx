import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { Hub } from '../components/landing/Hub';

interface HubSearch {
  host?: string;
  room?: string;
}

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>): HubSearch => ({
    host: typeof search.host === 'string' ? search.host : undefined,
    room: typeof search.room === 'string' ? search.room : undefined,
  }),
  beforeLoad: ({ search }) => {
    if (search.host === 'true') {
      throw redirect({ to: '/codeimpostor/host' });
    }
    if (search.room) {
      throw redirect({
        to: '/codeimpostor/unirse',
        search: { room: search.room },
      });
    }
  },
  component: IndexRoute,
});

function IndexRoute() {
  const navigate = useNavigate();
  return <Hub onSelectGame={() => navigate({ to: '/codeimpostor' })} />;
}
