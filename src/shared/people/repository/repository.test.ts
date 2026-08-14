import { beforeEach, describe, expect, it } from 'vitest';
import { freshDB, wipeDB } from '@/tests/db-test-utils';
import { settingsRepository } from '@shared/settings/repository';
import { personRepository } from './index';

beforeEach(async () => {
  await wipeDB();
  freshDB();
  await settingsRepository.get();
});

describe('personRepository name identity rules', () => {
  it('normalizes display whitespace when creating a person', async () => {
    const person = await personRepository.create({ name: '  Rahul   Kumar  ' });
    expect(person.name).toBe('Rahul Kumar');
  });

  it('rejects duplicate active names regardless of case and extra whitespace', async () => {
    await personRepository.create({ name: 'Rahul Kumar' });

    await expect(
      personRepository.create({ name: '  rahul   kumar ' }),
    ).rejects.toThrow('already exists');
  });

  it('rejects renaming a person to another active person name', async () => {
    const rahul = await personRepository.create({ name: 'Rahul' });
    const priya = await personRepository.create({ name: 'Priya' });

    await expect(
      personRepository.update(priya.id, { name: ' RAHUL ' }),
    ).rejects.toThrow('already exists');

    expect((await personRepository.get(rahul.id))?.name).toBe('Rahul');
    expect((await personRepository.get(priya.id))?.name).toBe('Priya');
  });

  it('does not clear omitted contact details when renaming', async () => {
    const person = await personRepository.create({
      name: 'Rahul',
      phone: '+91 99999 99999',
      email: 'rahul@example.com',
      note: 'College friend',
    });

    const updated = await personRepository.update(person.id, { name: 'Rahul Kumar' });
    expect(updated.phone).toBe('+91 99999 99999');
    expect(updated.email).toBe('rahul@example.com');
    expect(updated.note).toBe('College friend');
  });

  it('allows a deleted unused name to be reused but blocks an ambiguous restore', async () => {
    const original = await personRepository.create({ name: 'Rahul' });
    await personRepository.softDelete(original.id);
    const replacement = await personRepository.create({ name: 'rahul' });

    expect(replacement.name).toBe('rahul');
    await expect(personRepository.restore(original.id)).rejects.toThrow('already exists');
  });
});
