import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBar } from '@/features/layout/StatusBar';
import { useAnalysisStore } from '@/stores/analysisStore';
import { useComparisonStore } from '@/stores/comparisonStore';
import { useModelStore } from '@/stores/modelStore';

describe('StatusBar', () => {
  beforeEach(() => {
    useAnalysisStore.getState().resetAnalysis();
    useComparisonStore.getState().resetComparison();
    useModelStore.setState({
      model: null,
      nodes: new Map(),
      elements: new Map(),
    });
  });

  it('shows comparison status while comparison is running', () => {
    useAnalysisStore.setState({ status: 'idle' });
    useComparisonStore.setState({ status: 'running' });

    render(<StatusBar />);
    expect(screen.getByText('Running Comparison...')).toBeInTheDocument();
  });

  it('shows comparison completion label when comparison finishes', () => {
    useComparisonStore.setState({ status: 'complete' });

    render(<StatusBar />);
    expect(screen.getByText('Comparison Complete')).toBeInTheDocument();
  });
});
