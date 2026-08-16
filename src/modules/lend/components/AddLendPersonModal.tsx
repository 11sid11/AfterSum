import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, UserPlus } from 'lucide-react';
import { Button, Input, Modal, useToast } from '@components/ui';
import { usePeople } from '@shared/people/queries';
import { personNameKey } from '@shared/people/domain';
import { personRepository } from '@shared/people/repository';
import type { CurrencyCode } from '@shared/money';
import { lendLedgerRepository } from '../repositories/lendLedgerRepository';

interface AddLendPersonModalProps {
  open: boolean;
  currency: CurrencyCode;
  onClose: () => void;
  onOpenPerson: (personId: string) => void;
}

/**
 * Adds a person to the Lend surface without introducing a second identity
 * system. Existing shared People are reused and an empty Lend ledger is only
 * created when the person does not already have one.
 */
export function AddLendPersonModal({
  open,
  currency,
  onClose,
  onOpenPerson,
}: AddLendPersonModalProps) {
  const people = usePeople();
  const toast = useToast();
  const [name, setName] = useState('');
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName('');
    setError(undefined);
    setSubmitting(false);
  }, [open]);

  const candidateKey = name.trim() ? personNameKey(name) : '';
  const existingPerson = useMemo(
    () =>
      candidateKey
        ? (people ?? []).find(
            (person) => !person.deletedAt && personNameKey(person.name) === candidateKey,
          )
        : undefined,
    [candidateKey, people],
  );

  const close = () => {
    if (!submitting) onClose();
  };

  const ensureLendPerson = async (event: React.FormEvent) => {
    event.preventDefault();
    const candidate = name.trim();
    if (!candidate || submitting) return;

    if (existingPerson?.isSelf) {
      setError('Use another person. Your own profile cannot be added to Lend.');
      return;
    }

    setSubmitting(true);
    setError(undefined);
    try {
      const person = existingPerson ?? (await personRepository.create({ name: candidate }));
      const existingLedgers = await lendLedgerRepository.listForPerson(person.id);
      if (existingLedgers.length === 0) {
        await lendLedgerRepository.getOrCreate(person.id, currency);
      }

      toast.show(
        existingPerson ? `${person.name} already exists — opening their Lend history` : `${person.name} added`,
        { variant: 'success' },
      );
      onClose();
      onOpenPerson(person.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add person');
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={close} title="Add person" className="max-w-md">
      <form className="space-y-4" onSubmit={(event) => void ensureLendPerson(event)}>
        <Input
          name="lend-person-name"
          label="Name"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            if (error) setError(undefined);
          }}
          error={error}
          hint="People are shared with Split. Matching names reuse the existing person."
          maxLength={120}
          autoFocus
          disabled={submitting}
          placeholder="Rahul"
        />

        {existingPerson && !existingPerson.isSelf && (
          <div className="flex items-start gap-2.5 rounded-[16px] border border-emerald-500/20 bg-emerald-500/[0.07] px-3.5 py-3 text-emerald-800 dark:text-emerald-200">
            <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">{existingPerson.name} already exists</p>
              <p className="mt-0.5 text-xs leading-5 opacity-80">
                AfterSum will use the existing person instead of creating a duplicate.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2.5">
          <Button type="button" variant="ghost" onClick={close} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={submitting || !name.trim() || !!existingPerson?.isSelf}
          >
            <UserPlus size={15} />
            {submitting
              ? 'Opening…'
              : existingPerson && !existingPerson.isSelf
                ? `Open ${existingPerson.name}`
                : 'Add person'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
