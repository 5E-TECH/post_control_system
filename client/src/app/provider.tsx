import { memo, Suspense, type ReactNode } from 'react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { store } from './store';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Suspensee from '../shared/ui/Suspensee';

const client = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
    },
  },
});

const AppProvider = ({ children }: { children: ReactNode }) => {
  return (
    <BrowserRouter>
      <Provider store={store}>
        <QueryClientProvider client={client}>
          <Suspense fallback={<Suspensee />}>{children}</Suspense>
        </QueryClientProvider>
      </Provider>
    </BrowserRouter>
  );
};

export default memo(AppProvider);
