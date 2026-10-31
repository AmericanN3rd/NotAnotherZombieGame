/** Echoes for generated floors. Hand-built floors keep their own lines. */
export const NOTE_POOL: { id: string; text: string }[] = [
  { id: 'pool-awake', text: "I can't wake up." },
  { id: 'pool-stairs', text: 'The stairs keep going. I stopped counting landings.' },
  { id: 'pool-rungs', text: 'Do not climb while they are close. The rungs leave.' },
  { id: 'pool-coins', text: 'Someone stocked the machine. I never heard them leave.' },
  { id: 'pool-quiet', text: 'Quiet is not empty. Quiet is listening.' },
  { id: 'pool-vent', text: 'The vent is faster. Faster is not kinder.' },
  { id: 'pool-lock', text: 'I opened the lock. The lock was the warning.' },
  { id: 'pool-drop', text: 'The floor went. I kept the gun. Small mercy, again.' },
  { id: 'pool-birds', text: 'If the bird screams, do not be near the big ones.' },
  { id: 'pool-wager', text: 'The machine on six pays if you are foolish. The stairs do not care.' },
  { id: 'pool-names', text: 'No names on the walls. I checked twice.' },
  { id: 'pool-rain', text: 'I can still hear the rain. That cannot be right.' },
  { id: 'pool-teeth', text: 'The grinding is in the walls. Or in me. I will not decide.' },
  { id: 'pool-light', text: 'Most of the bulbs are dead. The dead ones are honest.' },
  { id: 'pool-alone', text: 'I have not met anyone. I am trying to stay that way.' },
  { id: 'pool-seed', text: 'Every tower is the same shape and a different cruelty.' },
  { id: 'pool-up', text: 'Up is the only door that still opens.' },
  { id: 'pool-blood', text: 'The stains are old. The smell is not.' },
  { id: 'pool-last', text: 'If you are reading this, keep the flare. The roof is a rumor.' },
];

export function takeNotes(seen: ReadonlySet<string>, count: number): { id: string; text: string }[] {
  const fresh = NOTE_POOL.filter((note) => !seen.has(note.id));
  return fresh.slice(0, Math.max(0, count));
}
