"use client";
import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { PersonalStore } from "./personal-store";
import { indexedDbRepository } from "./indexed-db-repository";

const PersonalContext = createContext<PersonalStore | null>(null);
export function PersonalSession({ children }: { children: ReactNode }) {
  const [store] = useState(() => new PersonalStore(indexedDbRepository));
  useEffect(() => store.start(), [store]);
  return <PersonalContext.Provider value={store}>{children}</PersonalContext.Provider>;
}
export function usePersonalStore() {
  const store = useContext(PersonalContext);
  if (!store) throw new Error("PersonalSession이 필요합니다.");
  return store;
}
export function usePersonal() {
  const store = usePersonalStore();
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
}
