"use client";

import { useEffect, useState } from "react";
import { apiGet } from "./api";

export type Me = {
  id: string;
  name: string;
  email: string;
  roles: { key: string; name: string }[];
  permissions: string[];
};

export function useMe() {
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    apiGet<Me>("/api/auth/me").then(setMe).catch(() => setMe(null));
  }, []);

  const can = (action: string, resource: string) =>
    me?.permissions.includes(`${action}:${resource}`) ?? false;

  return { me, can };
}
