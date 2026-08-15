import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { GameSelect } from '../../components/landing/GameSelect';

export const Route = createFileRoute('/codeimpostor/')({
  component: CodeImpostorIndexRoute,
});

function CodeImpostorIndexRoute() {
  const navigate = useNavigate();
  return (
    <GameSelect
      onBack={() => navigate({ to: '/' })}
      onHost={() => navigate({ to: '/codeimpostor/host' })}
      onPlayer={() => navigate({ to: '/codeimpostor/unirse' })}
    />
  );
}
