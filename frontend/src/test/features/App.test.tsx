/**
 * Tests for App component auto-loading behavior.
 *
 * Verifies that the sample model is loaded on first render.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import App from '@/App';
import { useModelStore } from '@/stores/modelStore';

// Mock AppLayout to avoid rendering the full component tree
vi.mock('@/features/layout/AppLayout', () => ({
  AppLayout: () => <div data-testid="app-layout">Layout</div>,
}));

const getState = () => useModelStore.getState();

beforeEach(() => {
  getState().clearModel();
});

describe('App — auto-load', () => {
  it('loads sample model on mount', () => {
    expect(getState().model).toBeNull();

    render(<App />);

    expect(getState().model).not.toBeNull();
    expect(getState().model!.name).toContain('Base-Isolated');
  });

  it('populates nodes after mount', () => {
    render(<App />);
    expect(getState().nodes.size).toBe(15);
  });

  it('populates ground motions after mount', () => {
    render(<App />);
    expect(getState().groundMotions.size).toBe(4);
  });
});
