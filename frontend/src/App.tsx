import { useEffect } from 'react';
import { AppLayout } from './features/layout/AppLayout';
import { useModelStore } from './stores/modelStore';

function App() {
  useEffect(() => {
    useModelStore.getState().loadSampleModel();
  }, []);

  return <AppLayout />;
}

export default App;
