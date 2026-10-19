import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { Toaster } from 'react-hot-toast';
import { store } from '@/app/store';
import AppRoutes from '@/routes/AppRoutes';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 60_000,
    },
  },
});

export default function App() {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <HelmetProvider>
          <BrowserRouter>
            <AppRoutes />
            <Toaster
              position="top-center"
              toastOptions={{
                style: { background: '#111730', color: '#FAF7F0', fontSize: '14px' },
                success: { iconTheme: { primary: '#D4AF52', secondary: '#111730' } },
              }}
            />
          </BrowserRouter>
        </HelmetProvider>
      </QueryClientProvider>
    </Provider>
  );
}
