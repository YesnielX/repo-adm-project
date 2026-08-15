import { play, type SoundName } from 'cuelume';

const PHASE_SOUNDS: Partial<Record<string, SoundName>> = {
  ROLE_REVEAL: 'whisper',
  HINT_PHASE: 'tick',
  SHOWCASE: 'bloom',
  VOTING: 'page',
  EJECTION: 'pulse',
  GUESS_PHASE: 'scan',
};

export function playPhaseSound(status: string): void {
  const sound = PHASE_SOUNDS[status];
  if (sound) play(sound);
}
