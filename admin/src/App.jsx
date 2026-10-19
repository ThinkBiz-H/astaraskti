import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { store } from '@/app/store';
import AppRoutes from '@/routes/AppRoutes';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 } },
});

export default function App() {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AppRoutes />
          <Toaster position="top-right" toastOptions={{ style: { fontSize: '14px' } }} />
        </BrowserRouter>
      </QueryClientProvider>
    </Provider>
  );
}
