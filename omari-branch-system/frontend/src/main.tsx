import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import "./index.css";
import { ApiKeyProvider } from "./hooks/useApiKey";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ApiKeyProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ApiKeyProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
