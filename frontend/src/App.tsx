import { useEffect } from 'react';
import { AppLayout } from './features/layout/AppLayout';
import { ToastContainer } from './components/ui/Toast';
import { useModelStore } from './stores/modelStore';

function App() {
  useEffect(() => {
    useModelStore.getState().loadSampleModel();
  }, []);

  return (
    <>
      <AppLayout />
      <ToastContainer />
    </>
  );
}

export default App;
