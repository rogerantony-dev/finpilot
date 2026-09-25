import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { mockFetch, renderWithProviders } from '../../test/render';
import { GoalDialog } from './GoalDialog';

const noop = () => {};

describe('GoalDialog', () => {
  it('reports every invalid field at once without calling the API', async () => {
    const fetch = mockFetch(500, {});
    renderWithProviders(<GoalDialog customerId="C0001" open onOpenChange={noop} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Target amount (₹)'), '0');
    await user.click(screen.getByRole('button', { name: 'Create goal' }));

    expect(await screen.findByText('Goal name is required')).toBeInTheDocument();
    expect(screen.getByText('Target amount must be greater than 0')).toBeInTheDocument();
    expect(screen.getByText('Target date is required')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('shows a server-side business-rule error under its field', async () => {
    mockFetch(422, {
      error: {
        code: 'UNPROCESSABLE',
        message: 'Target date cannot be in the past',
        details: [{ field: 'targetDate', message: 'Choose a date on or after 2026-09-25' }],
        requestId: 'r1',
      },
    });
    renderWithProviders(<GoalDialog customerId="C0001" open onOpenChange={noop} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Goal name'), 'Flat in Kochi');
    await user.type(screen.getByLabelText('Target amount (₹)'), '4500000');
    await user.type(screen.getByLabelText('Target date'), '2020-01-01');
    await user.click(screen.getByRole('button', { name: 'Create goal' }));

    expect(await screen.findByText('Choose a date on or after 2026-09-25')).toBeInTheDocument();
  });

  it('sends only changed fields when editing', async () => {
    const fetch = mockFetch(200, {});
    const goal = {
      goalId: 'G00001',
      customerId: 'C0001',
      goalType: 'EDUCATION' as const,
      goalName: 'College',
      targetAmount: '1000000.00',
      currentFundedAmount: '250000.00',
      targetDate: '2030-06-30',
      priority: 'MEDIUM' as const,
      fundedPct: '25.00',
      flags: {
        overdue: false,
        overfunded: false,
        highPriorityUnderfunded: false,
        nameTypeMismatch: false,
      },
      updatedAt: '2026-09-25T00:00:00Z',
    };
    renderWithProviders(<GoalDialog customerId="C0001" goal={goal} open onOpenChange={noop} />);

    const user = userEvent.setup();
    const funded = screen.getByLabelText('Funded so far (₹)');
    await user.clear(funded);
    await user.type(funded, '300000');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/v1/goals/G00001');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toEqual({ currentFundedAmount: '300000' });
  });
});
