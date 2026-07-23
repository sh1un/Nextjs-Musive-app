import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useSelector } from "react-redux";
import friendsService from "@/services/friendsService";

interface FriendsPresence {
  listeningCount: number;
  onlineCount: number;
}

const FriendsPresenceContext = createContext<FriendsPresence>({
  listeningCount: 0,
  onlineCount: 0,
});

export const FriendsPresenceProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const { user } = useSelector((state: any) => state.auth);
  const [presence, setPresence] = useState<FriendsPresence>({
    listeningCount: 0,
    onlineCount: 0,
  });

  useEffect(() => {
    if (!user?.token) {
      setPresence({ listeningCount: 0, onlineCount: 0 });
      return;
    }

    const refresh = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const friends = await friendsService.getFriends(user.token);
        setPresence({
          listeningCount: friends.filter((friend) => friend.is_playing).length,
          onlineCount: friends.filter((friend) => friend.is_online).length,
        });
      } catch {
        // Presence is supplementary and should never interrupt navigation.
      }
    };

    refresh();
    const interval = window.setInterval(refresh, 8000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [user?.token]);

  const value = useMemo(() => presence, [presence]);

  return (
    <FriendsPresenceContext.Provider value={value}>
      {children}
    </FriendsPresenceContext.Provider>
  );
};

export const useFriendsPresence = () => useContext(FriendsPresenceContext);
