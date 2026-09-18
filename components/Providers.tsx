"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";
import { Provider as ReduxProvider } from "react-redux";
import { store } from "@/lib/store/store";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <ReduxProvider store={store}>{children}</ReduxProvider>
    </SessionProvider>
  );
}
