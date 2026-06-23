import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { useStore } from '../state/store';

describe('App shell', () => {
  it('renders the brand, DRAFT badge and offline badge', () => {
    render(<App />);
    expect(screen.getByText('DropLab')).toBeInTheDocument();
    expect(screen.getByText('DRAFT')).toBeInTheDocument();
    expect(screen.getByText(/OFFLINE/)).toBeInTheDocument();
  });

  it('shows the no-airworthiness disclaimer on the About tab', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /About \/ Standards/ }));
    expect(screen.getAllByText(/no airworthiness determination/i).length).toBeGreaterThan(0);
  });

  it('generates simulated data and shows it in Results', async () => {
    const user = userEvent.setup();
    render(<App />);
    // Drive the flow through the store, then assert the Results tab renders it.
    useStore.getState().applyPreset('a22-lv');
    useStore.getState().generateFromConfig();
    await user.click(screen.getByRole('button', { name: 'Results' }));
    expect(screen.getByText(/Drop summary/)).toBeInTheDocument();
    expect(screen.getAllByText(/SIMULATED/i).length).toBeGreaterThan(0);
  });
});
