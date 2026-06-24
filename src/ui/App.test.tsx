import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
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

  it('exposes tabs with proper ARIA roles', () => {
    render(<App />);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    const setup = screen.getByRole('tab', { name: 'Test Setup' });
    expect(setup).toHaveAttribute('aria-selected', 'true');
  });

  it('shows the no-airworthiness disclaimer on the About tab', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('tab', { name: /About \/ Standards/ }));
    expect(screen.getAllByText(/no airworthiness determination/i).length).toBeGreaterThan(0);
  });

  it('runs load → analyse → export end to end', async () => {
    const user = userEvent.setup();
    const createUrl = vi.spyOn(URL, 'createObjectURL');
    render(<App />);

    // Load + analyse via the store (worker falls back to in-thread under jsdom).
    await act(async () => {
      await useStore.getState().applyPreset('a22-lv');
      await useStore.getState().generateFromConfig();
    });

    await user.click(screen.getByRole('tab', { name: 'Results' }));
    expect(screen.getByText(/Drop summary/)).toBeInTheDocument();
    expect(screen.getAllByText(/SIMULATED/i).length).toBeGreaterThan(0);

    // Export the metrics CSV (browser download fallback).
    await user.click(screen.getByRole('tab', { name: 'Export' }));
    await user.click(screen.getByRole('button', { name: 'Metrics CSV' }));
    expect(createUrl).toHaveBeenCalled();
    createUrl.mockRestore();
  });
});
