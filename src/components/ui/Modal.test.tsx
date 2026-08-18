import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Modal } from './Modal';

function ModalHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open modal</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Test dialog">
        <button type="button">Dialog action</button>
      </Modal>
    </>
  );
}

describe('Modal', () => {
  it('moves focus into the dialog and restores it when closed', async () => {
    const user = userEvent.setup();
    render(<ModalHarness />);

    const opener = screen.getByRole('button', { name: 'Open modal' });
    await user.click(opener);

    const close = screen.getByRole('button', { name: 'Close' });
    expect(close).toHaveFocus();

    await user.click(close);
    expect(opener).toHaveFocus();
  });

  it('keeps tab focus inside the open dialog', async () => {
    const user = userEvent.setup();
    render(<ModalHarness />);
    await user.click(screen.getByRole('button', { name: 'Open modal' }));

    const close = screen.getByRole('button', { name: 'Close' });
    const action = screen.getByRole('button', { name: 'Dialog action' });
    expect(close).toHaveFocus();

    await user.tab();
    expect(action).toHaveFocus();
    await user.tab();
    expect(close).toHaveFocus();
  });
});
