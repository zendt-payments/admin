import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { DEFAULT_AVATAR_URL } from "../constants/avatar";
import { dataService } from "../services/dataService";
import { DASH_QUERY_STALE, dqk } from "../lib/dashboardQueries";
import { useAuth } from "./AuthContext";

type AvatarContextType = {
  avatarSrc: string;
  setAvatarSrc: (url: string) => void;
};

const AvatarContext = createContext<AvatarContextType>({
  avatarSrc: DEFAULT_AVATAR_URL,
  setAvatarSrc: () => {},
});

type AvatarProviderProps = {
  children: ReactNode;
};

export function AvatarProvider({ children }: AvatarProviderProps) {
  const [avatarSrc, setAvatarSrcState] = useState<string>(DEFAULT_AVATAR_URL);
  const { isAuthenticated } = useAuth();

  const { data: profileSettings } = useQuery({
    queryKey: dqk.profileSettings,
    queryFn: () => dataService.getProfileSettings(),
    staleTime: DASH_QUERY_STALE.profileSettings,
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!isAuthenticated) {
      setAvatarSrcState(DEFAULT_AVATAR_URL);
      return;
    }
    if (profileSettings === undefined) return;
    const url = (profileSettings as { profileImageUrl?: string }).profileImageUrl;
    setAvatarSrcState(url || DEFAULT_AVATAR_URL);
  }, [isAuthenticated, profileSettings]);

  const setAvatarSrc = useCallback((url: string) => {
    setAvatarSrcState(url);
  }, []);

  const value = useMemo(() => ({ avatarSrc, setAvatarSrc }), [avatarSrc, setAvatarSrc]);

  return <AvatarContext.Provider value={value}>{children}</AvatarContext.Provider>;
}

export function useAvatar() {
  return useContext(AvatarContext);
}
