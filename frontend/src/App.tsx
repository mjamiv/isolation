import { useEffect } from 'react';
import { Agentation } from 'agentation';
import { AppLayout } from './features/layout/AppLayout';
import { ToastContainer } from './components/ui/Toast';
import { ShortcutHelpDialog } from './components/ui/ShortcutHelpDialog';
import { useModelStore } from './stores/modelStore';

function App() {
  useEffect(() => {
    useModelStore.getState().loadSampleModel();
  }, []);

  return (
    <>
      <AppLayout />
      <ToastContainer />
      <ShortcutHelpDialog />
      {import.meta.env.DEV && !import.meta.env.VITEST && <Agentation />}
    </>
  );
}

export default App;
