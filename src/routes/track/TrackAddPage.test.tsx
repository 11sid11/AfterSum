import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CelebrationProvider, ToastProvider } from '@components/ui';
import { ensureFirstLaunch } from '@db/seed';
import { getDB } from '@db/database';
import { wipeDB } from '@tests/db-test-utils';
import { TrackAddPage } from './TrackAddPage';

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  useSearch: () => ({ type: 'expense' }),
}));

function renderPage() {
  return render(
    <CelebrationProvider>
      <ToastProvider>
        <TrackAddPage />
      </ToastProvider>
    </CelebrationProvider>,
  );
}

describe('TrackAddPage category selection', () => {
  beforeEach(async () => {
    await wipeDB();
    await ensureFirstLaunch();
  });

  afterEach(async () => {
    await wipeDB();
  });

  it('reflects a selected category immediately and clears it when transaction type changes', async () => {
    const user = userEvent.setup();
    const food = await getDB().trackCategories.where('name').equals('Food').first();
    expect(food).toBeTruthy();

    renderPage();

    const category = await screen.findByLabelText('Category');
    await waitFor(() => expect(screen.getByRole('option', { name: 'Food' })).toBeInTheDocument());

    await user.selectOptions(category, food!.id);
    expect(category).toHaveValue(food!.id);

    await user.click(screen.getByRole('button', { name: 'Income' }));

    expect(category).toHaveValue('');
    await waitFor(() => {
      expect(screen.queryByRole('option', { name: 'Food' })).not.toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Income' })).toBeInTheDocument();
    });
  });
});
