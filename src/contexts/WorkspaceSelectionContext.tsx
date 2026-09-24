import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

const WORKSPACE_SELECTION_KEY_PREFIX = "moniger-selected-workspace:";

type WorkspaceSelectionContextValue = {
  selectionReady: boolean;
  selectedBusinessId: string | null;
  setSelectedBusinessId: (businessId: string) => void;
};

const WorkspaceSelectionContext = createContext<WorkspaceSelectionContextValue>({
  selectionReady: false,
  selectedBusinessId: null,
  setSelectedBusinessId: () => undefined,
});

export const getWorkspaceSelectionStorageKey = (userId: string) => `${WORKSPACE_SELECTION_KEY_PREFIX}${userId}`;

export const resolveSelectedWorkspaceId = (workspaceIds: string[], requestedWorkspaceId: string | null) =>
  requestedWorkspaceId && workspaceIds.includes(requestedWorkspaceId) ? requestedWorkspaceId : workspaceIds[0] ?? null;

export const WorkspaceSelectionProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth();
  const [selectedBusinessId, setSelectedBusinessIdState] = useState<string | null>(null);
  const [selectionReady, setSelectionReady] = useState(false);

  useEffect(() => {
    if (loading) {
      setSelectionReady(false);
      return;
    }

    if (!user) {
      setSelectedBusinessIdState(null);
      setSelectionReady(false);
      return;
    }

    setSelectedBusinessIdState(window.localStorage.getItem(getWorkspaceSelectionStorageKey(user.id)));
    setSelectionReady(true);
  }, [loading, user]);

  const setSelectedBusinessId = (businessId: string) => {
    if (!user || !businessId) {
      return;
    }

    window.localStorage.setItem(getWorkspaceSelectionStorageKey(user.id), businessId);
    setSelectedBusinessIdState(businessId);
  };

  return (
    <WorkspaceSelectionContext.Provider value={{ selectionReady, selectedBusinessId, setSelectedBusinessId }}>
      {children}
    </WorkspaceSelectionContext.Provider>
  );
};

export const useWorkspaceSelection = () => useContext(WorkspaceSelectionContext);
