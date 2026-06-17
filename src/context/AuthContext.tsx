import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getCurrentUser,
  getAuthTokenAsync,
  logout as cognitoLogout,
  getCognitoGroups,
  isAdminFromGroups,
} from "../services/auth";
import { setPersistent, removePersistent, removeSessionItem, setSessionItem } from "../lib/storage";
import { dataService, invalidateUserMeCache } from "../services/dataService";
import { isApiError } from "../lib/apiError";
import { ensureFreelancerAccountProvisioned } from "../services/accountProvisioning";
import { DASH_QUERY_STALE, dqk } from "../lib/dashboardQueries";

const AUTH_STORAGE_KEY = "isAuthenticated";

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkSession() {
      const user = getCurrentUser();
      if (user) {
        const token = await getAuthTokenAsync();
        if (token) {
          const groups = await getCognitoGroups();
          if (!isAdminFromGroups(groups)) {
            try {
              await ensureFreelancerAccountProvisioned();
              await queryClient.fetchQuery({
                queryKey: dqk.profileSettings,
                queryFn: () => dataService.getProfileSettings(),
                staleTime: DASH_QUERY_STALE.profileSettings,
              });
            } catch (e) {
              if (isApiError(e) && e.code === "ACCOUNT_DEACTIVATED") {
                cognitoLogout();
                invalidateUserMeCache();
                setIsAuthenticated(false);
                await removePersistent(AUTH_STORAGE_KEY);
                setIsLoading(false);
                return;
              }
              cognitoLogout();
              invalidateUserMeCache();
              setIsAuthenticated(false);
              await removePersistent(AUTH_STORAGE_KEY);
              setIsLoading(false);
              return;
            }
          }
          setIsAuthenticated(true);
          await setPersistent(AUTH_STORAGE_KEY, "true");
          setSessionItem("hasSeenSplash", "true");
        } else {
          setIsAuthenticated(false);
          await removePersistent(AUTH_STORAGE_KEY);
        }
      } else {
        setIsAuthenticated(false);
        await removePersistent(AUTH_STORAGE_KEY);
      }
      setIsLoading(false);
    }
    checkSession();
  }, []);

  const login = async () => {
    invalidateUserMeCache();
    setIsAuthenticated(true);
    await setPersistent(AUTH_STORAGE_KEY, "true");
    setSessionItem("hasSeenSplash", "true");
  };

  const logout = async () => {
    cognitoLogout();
    invalidateUserMeCache();
    setIsAuthenticated(false);
    await removePersistent(AUTH_STORAGE_KEY);
    removeSessionItem("hasSeenSplash");
    queryClient.clear();
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
