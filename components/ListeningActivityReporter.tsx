import { useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import friendsService from "@/services/friendsService";
import { useRoomSession } from "./RoomSessionProvider";

const ListeningActivityReporter = () => {
  const { user } = useSelector((state: any) => state.auth);
  const { activeSong, isPlaying, trackProgress } = useSelector(
    (state: any) => state.player
  );
  const roomSession = useRoomSession();
  const progressRef = useRef(trackProgress);

  useEffect(() => {
    progressRef.current = trackProgress;
  }, [trackProgress]);

  useEffect(() => {
    if (!user?.token) return;

    const report = () => {
      const roomActivity = roomSession.getActivitySnapshot();
      friendsService
        .updateActivity(
          user.token,
          roomActivity?.track || activeSong,
          roomActivity?.isPlaying ?? isPlaying,
          roomActivity?.progressSeconds ?? progressRef.current
        )
        .catch(() => undefined);
    };

    report();
    const interval = window.setInterval(report, 10000);
    return () => window.clearInterval(interval);
  }, [
    activeSong,
    isPlaying,
    roomSession.room?.id,
    roomSession.playback.isPlaying,
    roomSession.members.length,
    user?.token,
  ]);

  return null;
};

export default ListeningActivityReporter;
