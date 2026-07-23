import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/router";
import { useSelector } from "react-redux";
import { io, Socket } from "socket.io-client";
import { toast } from "react-toastify";

import API_URL from "@/configs/apiUrl";
import {
  QueueItem,
  RoomData,
  RoomMessage,
  RoomTrack,
} from "@/services/roomsService";

export interface PlaybackState {
  track: RoomTrack | null;
  isPlaying: boolean;
  position: number;
  serverTime: number;
}

export interface RoomReaction {
  id: string;
  emoji: string;
  username: string;
}

interface RoomSessionValue {
  room: RoomData | null;
  playback: PlaybackState;
  queue: QueueItem[];
  messages: RoomMessage[];
  members: string[];
  reactions: RoomReaction[];
  connected: boolean;
  audioBlocked: boolean;
  isHost: boolean;
  joinSession: (room: RoomData) => void;
  leaveSession: () => void;
  togglePlayback: () => void;
  playNext: () => void;
  sendMessage: (message: string) => void;
  sendReaction: (emoji: string) => void;
  transferHost: (username: string) => void;
  addToQueue: (track: RoomTrack) => void;
  vote: (queueId: string) => void;
  unlockAudio: () => void;
  setYouTubeRoomMount: (element: HTMLDivElement | null) => void;
  getActivitySnapshot: () => {
    track: any;
    isPlaying: boolean;
    progressSeconds: number;
  } | null;
}

const emptyPlayback: PlaybackState = {
  track: null,
  isPlaying: false,
  position: 0,
  serverTime: Date.now(),
};

const RoomSessionContext = createContext<RoomSessionValue | null>(null);

export const RoomSessionProvider = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const { user } = useSelector((state: any) => state.auth);
  const [room, setRoom] = useState<RoomData | null>(null);
  const [playback, setPlayback] = useState<PlaybackState>(emptyPlayback);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [members, setMembers] = useState<string[]>([]);
  const [reactions, setReactions] = useState<RoomReaction[]>([]);
  const [connected, setConnected] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const youtubePlayerRef = useRef<any>(null);
  const youtubeRoomMountRef = useRef<HTMLDivElement | null>(null);
  const youtubeFloatingMountRef = useRef<HTMLDivElement | null>(null);
  const pendingPlaybackRef = useRef<PlaybackState | null>(null);
  const playbackRef = useRef(playback);
  const roomRef = useRef(room);
  const isHostRef = useRef(false);

  const isHost = room?.host_username === user?.username;
  const isRoomPage = router.pathname === "/rooms/[code]";

  const moveYouTubePlayer = () => {
    const iframe = youtubePlayerRef.current?.getIframe?.();
    const destination = isRoomPage
      ? youtubeRoomMountRef.current
      : youtubeFloatingMountRef.current;
    if (iframe && destination && iframe.parentElement !== destination) {
      destination.replaceChildren(iframe);
    }
    if (iframe) {
      iframe.style.pointerEvents = "none";
      iframe.tabIndex = -1;
    }
  };

  const setYouTubeRoomMount = (element: HTMLDivElement | null) => {
    youtubeRoomMountRef.current = element;
    window.setTimeout(moveYouTubePlayer, 0);
  };

  const setYouTubeFloatingMount = (element: HTMLDivElement | null) => {
    youtubeFloatingMountRef.current = element;
    window.setTimeout(moveYouTubePlayer, 0);
  };

  useEffect(() => {
    playbackRef.current = playback;
  }, [playback]);

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  useEffect(() => {
    isHostRef.current = isHost;
  }, [isHost]);

  useEffect(() => {
    moveYouTubePlayer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, isRoomPage]);

  useEffect(() => {
    const track = playback.track;
    if (track?.type !== "youtube" || !track.video_id) {
      youtubePlayerRef.current?.destroy?.();
      youtubePlayerRef.current = null;
      return;
    }

    let cancelled = false;
    loadYouTubeApi().then(() => {
      if (cancelled) return;
      const destination = isRoomPage
        ? youtubeRoomMountRef.current
        : youtubeFloatingMountRef.current;
      if (!destination) return;
      const YT = (window as any).YT;
      if (!youtubePlayerRef.current) {
        const playerElement = document.createElement("div");
        destination.replaceChildren(playerElement);
        youtubePlayerRef.current = new YT.Player(
          playerElement,
          {
            width: "100%",
            height: "100%",
            videoId: track.video_id,
            playerVars: {
              controls: 0,
              disablekb: 1,
              playsinline: 1,
              rel: 0,
              origin: window.location.origin,
            },
            events: {
              onReady: () => {
                moveYouTubePlayer();
                syncYouTubePlayer(playbackRef.current);
              },
              onStateChange: (event: any) => {
                if (
                  event.data === YT.PlayerState.ENDED &&
                  isHostRef.current
                ) {
                  emit("queue:play-next", {});
                }
              },
              onAutoplayBlocked: () => setAudioBlocked(true),
            },
          }
        );
      } else {
        syncYouTubePlayer(playbackRef.current, true);
      }
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playback.track?.video_id, isRoomPage]);

  useEffect(() => {
    if (!room || !user?.token) return;
    const socket = io(API_URL.replace(/\/api\/?$/, ""), {
      auth: { token: user.token },
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("room:join", { code: room.code }, (result: any) => {
        if (result.ok) applyPlayback(result.state);
        else toast.error(result.error);
      });
    });
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", (error) => toast.error(error.message));
    socket.on("playback:state", applyPlayback);
    socket.on("queue:updated", setQueue);
    socket.on("chat:message", (newMessage: RoomMessage) =>
      setMessages((current) => [...current, newMessage])
    );
    socket.on("room:presence", setMembers);
    socket.on(
      "room:host-changed",
      ({ host_username }: { host_username: string }) => {
        setRoom((current) =>
          current ? { ...current, host_username } : current
        );
        if (roomRef.current) {
          roomRef.current = { ...roomRef.current, host_username };
        }
        toast.info(`${host_username} is now hosting`);
      }
    );
    socket.on("reaction:new", (reaction: RoomReaction) => {
      setReactions((current) => [...current, reaction]);
      window.setTimeout(
        () =>
          setReactions((current) =>
            current.filter((item) => item.id !== reaction.id)
          ),
        2600
      );
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id, user?.token]);

  useEffect(() => {
    if (!isHost || !connected) return;
    const heartbeat = window.setInterval(() => {
      const currentPlayback = playbackRef.current;
      if (!currentPlayback.track) return;
      const media = getMediaState(currentPlayback);
      if (!media) return;
      emit("playback:update", {
        track: currentPlayback.track,
        isPlaying: media.isPlaying,
        position: media.position,
      });
    }, 5000);
    return () => window.clearInterval(heartbeat);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, isHost]);

  useEffect(() => {
    if (isHost || !connected) return;
    const sync = window.setInterval(() => {
      socketRef.current?.emit(
        "playback:sync-request",
        {},
        (result: any) => result.ok && applyPlayback(result.state)
      );
    }, 15000);
    return () => window.clearInterval(sync);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, isHost]);

  const joinSession = (nextRoom: RoomData) => {
    if (roomRef.current?.id === nextRoom.id) {
      setQueue(nextRoom.queue);
      setMessages(nextRoom.messages);
      return;
    }
    setRoom(nextRoom);
    setQueue(nextRoom.queue);
    setMessages(nextRoom.messages);
    setMembers([]);
    setPlayback({
      track: nextRoom.current_track,
      isPlaying: nextRoom.is_playing,
      position: nextRoom.position_seconds,
      serverTime: Date.now(),
    });
  };

  const leaveSession = () => {
    audioRef.current?.pause();
    youtubePlayerRef.current?.stopVideo?.();
    socketRef.current?.disconnect();
    setRoom(null);
    setQueue([]);
    setMessages([]);
    setMembers([]);
    setReactions([]);
    setPlayback(emptyPlayback);
    setAudioBlocked(false);
  };

  const applyPlayback = (state: PlaybackState) => {
    pendingPlaybackRef.current = state;
    playbackRef.current = state;
    setPlayback(state);
    if (state.track?.type === "youtube") {
      audioRef.current?.pause();
      syncYouTubePlayer(state);
      return;
    }
    const audio = audioRef.current;
    if (
      audio &&
      state.track &&
      audio.src === new URL(state.track.src).href
    ) {
      syncAudio(audio, state, setAudioBlocked);
    }
  };

  const onAudioReady = () => {
    if (audioRef.current && pendingPlaybackRef.current) {
      syncAudio(
        audioRef.current,
        pendingPlaybackRef.current,
        setAudioBlocked
      );
    }
  };

  const emit = (event: string, payload: any) => {
    socketRef.current?.emit(event, payload, (result: any) => {
      if (!result?.ok) toast.error(result?.error || "Room action failed");
    });
  };

  const togglePlayback = () => {
    const current = playbackRef.current;
    if (!isHost || !current.track) return;
    const media = getMediaState(current);
    if (!media) return;
    const next = {
      ...current,
      isPlaying: !media.isPlaying,
      position: media.position,
      serverTime: Date.now(),
    };
    emit("playback:update", {
      track: next.track,
      isPlaying: next.isPlaying,
      position: next.position,
    });
    applyPlayback(next);
  };

  const unlockAudio = () => {
    if (playbackRef.current.track?.type === "youtube") {
      youtubePlayerRef.current?.playVideo?.();
      setAudioBlocked(false);
      return;
    }
    if (audioRef.current) {
      syncAudio(audioRef.current, playbackRef.current, setAudioBlocked);
    }
  };

  const getActivitySnapshot = () => {
    const activeRoom = roomRef.current;
    const current = playbackRef.current;
    if (!activeRoom || !current.track) return null;
    return {
      track: {
        ...current.track,
        listening_context: {
          type: "room",
          room_code: activeRoom.code,
          room_name: activeRoom.name,
          listener_count: members.length,
        },
      },
      isPlaying: current.isPlaying,
      progressSeconds: getMediaState(current)?.position || current.position,
    };
  };

  const getMediaState = (current: PlaybackState) => {
    if (current.track?.type === "youtube") {
      const player = youtubePlayerRef.current;
      if (!player?.getCurrentTime) return null;
      const YT = (window as any).YT;
      return {
        position: Number(player.getCurrentTime()) || 0,
        isPlaying: player.getPlayerState() === YT?.PlayerState?.PLAYING,
      };
    }
    const audio = audioRef.current;
    return audio
      ? { position: audio.currentTime, isPlaying: !audio.paused }
      : null;
  };

  const syncYouTubePlayer = (state: PlaybackState, forceLoad = false) => {
    if (state.track?.type !== "youtube" || !state.track.video_id) return;
    const player = youtubePlayerRef.current;
    if (!player?.getCurrentTime) return;
    const expectedPosition =
      state.position +
      (state.isPlaying
        ? Math.max(0, (Date.now() - state.serverTime) / 1000)
        : 0);
    const currentVideoId = player.getVideoData?.().video_id;
    if (forceLoad || currentVideoId !== state.track.video_id) {
      const command = state.isPlaying ? "loadVideoById" : "cueVideoById";
      player[command]({
        videoId: state.track.video_id,
        startSeconds: expectedPosition,
      });
    } else if (
      Math.abs((Number(player.getCurrentTime()) || 0) - expectedPosition) > 1.2
    ) {
      player.seekTo(expectedPosition, true);
    }
    if (state.isPlaying) {
      player.playVideo();
    } else {
      player.pauseVideo();
      setAudioBlocked(false);
    }
  };

  return (
    <RoomSessionContext.Provider
      value={{
        room,
        playback,
        queue,
        messages,
        members,
        reactions,
        connected,
        audioBlocked,
        isHost,
        joinSession,
        leaveSession,
        togglePlayback,
        playNext: () => emit("queue:play-next", {}),
        sendMessage: (text) => emit("chat:send", { message: text }),
        sendReaction: (emoji) => emit("reaction:send", { emoji }),
        transferHost: (username) =>
          emit("room:transfer-host", { username }),
        addToQueue: (track) => emit("queue:add", { track }),
        vote: (queueId) => emit("queue:vote", { queueId }),
        unlockAudio,
        setYouTubeRoomMount,
        getActivitySnapshot,
      }}
    >
      {children}
      <audio
        ref={audioRef}
        src={
          playback.track && playback.track.type !== "youtube"
            ? playback.track.src
            : undefined
        }
        onLoadedMetadata={onAudioReady}
        onEnded={() => isHost && emit("queue:play-next", {})}
        preload="auto"
      />
      {room &&
      playback.track?.type === "youtube" &&
      router.pathname !== "/rooms/[code]" ? (
        <FloatingYouTubePlayer
          setPlayerMount={setYouTubeFloatingMount}
          room={room}
          playback={playback}
          isHost={isHost}
          audioBlocked={audioBlocked}
          memberCount={members.length}
          onToggle={togglePlayback}
          onUnlock={unlockAudio}
          onLeave={leaveSession}
        />
      ) : room && router.pathname !== "/rooms/[code]" ? (
        <RoomMiniPlayer
          room={room}
          playback={playback}
          isHost={isHost}
          audioBlocked={audioBlocked}
          memberCount={members.length}
          onToggle={togglePlayback}
          onUnlock={unlockAudio}
          onLeave={leaveSession}
        />
      ) : null}
    </RoomSessionContext.Provider>
  );
};

const FloatingYouTubePlayer = ({
  setPlayerMount,
  room,
  playback,
  isHost,
  audioBlocked,
  memberCount,
  onToggle,
  onUnlock,
  onLeave,
}: {
  setPlayerMount: (element: HTMLDivElement | null) => void;
  room: RoomData;
  playback: PlaybackState;
  isHost: boolean;
  audioBlocked: boolean;
  memberCount: number;
  onToggle: () => void;
  onUnlock: () => void;
  onLeave: () => void;
}) => {
  const router = useRouter();
  return (
    <div className="fixed bottom-6 right-6 z-40 w-[360px] overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d11]/95 text-white shadow-[0_20px_70px_rgba(0,0,0,0.65)] backdrop-blur-xl mobile:bottom-16 mobile:right-3 mobile:w-[calc(100vw-24px)]">
      <div className="relative aspect-video w-full bg-black">
        <div ref={setPlayerMount} className="h-full w-full" />
        <div
          className="absolute inset-0 z-10 cursor-default"
          title="Use Musive controls for room playback"
          aria-label="YouTube playback is controlled by Musive"
        />
      </div>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
          <button
            onClick={() => router.push(`/rooms/${room.code}`)}
            className="block max-w-full text-left"
          >
            <span className="block text-[10px] font-ProximaBold uppercase tracking-[0.18em] text-red-300">
              YouTube · Listening together
            </span>
            <span className="mt-1 block truncate text-sm font-ProximaBold">
              {playback.track?.track_name}
            </span>
            <span className="block truncate text-xs text-white/40">
              {playback.track?.artist_name}
            </span>
            <span className="mt-1 block truncate text-xs text-violet-300">
              {room.name} · {memberCount} online
            </span>
          </button>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {audioBlocked ? (
              <button
                onClick={onUnlock}
                className="rounded-full bg-emerald-400 px-4 py-2 text-xs font-ProximaBold text-emerald-950"
              >
                Join audio
              </button>
            ) : (
              <button
                onClick={onToggle}
                disabled={!isHost || !playback.track}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black disabled:opacity-30"
                title={
                  isHost
                    ? "Play or pause for everyone"
                    : "Only the host controls playback"
                }
              >
                {playback.isPlaying ? "Ⅱ" : "▶"}
              </button>
            )}
            <button
              onClick={() => router.push(`/rooms/${room.code}`)}
              className="rounded-full border border-white/10 px-3 py-2 text-xs text-white/60 mobile:hidden"
            >
              Room
            </button>
            <button
              onClick={onLeave}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-xs text-white/45 hover:text-white"
              title="Leave room"
            >
              ×
            </button>
          </div>
        </div>
        {!isHost && (
          <p className="mt-2 text-[10px] text-white/25">
            {room.host_username} controls playback
          </p>
        )}
      </div>
    </div>
  );
};

const RoomMiniPlayer = ({
  room,
  playback,
  isHost,
  audioBlocked,
  memberCount,
  onToggle,
  onUnlock,
  onLeave,
}: {
  room: RoomData;
  playback: PlaybackState;
  isHost: boolean;
  audioBlocked: boolean;
  memberCount: number;
  onToggle: () => void;
  onUnlock: () => void;
  onLeave: () => void;
}) => {
  const router = useRouter();
  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-violet-400/25 bg-[#101015]/95 px-4 py-3 text-white shadow-[0_-12px_40px_rgba(109,40,217,0.16)] backdrop-blur-xl mobile:bottom-12">
      <div className="mx-auto flex max-w-7xl items-center gap-4">
        <button
          onClick={() => router.push(`/rooms/${room.code}`)}
          className="flex min-w-0 flex-1 items-center text-left"
        >
          <span
            className="mr-3 flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg text-xl"
            style={{
              background: playback.track?.cover_image?.color || "#6d28d9",
            }}
          >
            {playback.track?.cover_image?.url ? (
              <img
                src={playback.track.cover_image.url}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : playback.isPlaying ? (
              "♫"
            ) : (
              "Ⅱ"
            )}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-ProximaBold">
              {playback.track?.track_name || room.name}
            </span>
            <span className="block truncate text-xs text-violet-300">
              {room.name} · {memberCount} online
            </span>
          </span>
        </button>
        {audioBlocked ? (
          <button
            onClick={onUnlock}
            className="rounded-full bg-emerald-400 px-4 py-2 text-xs font-ProximaBold text-emerald-950"
          >
            Join audio
          </button>
        ) : (
          <button
            onClick={onToggle}
            disabled={!isHost || !playback.track}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black disabled:opacity-30"
            title={isHost ? "Play or pause" : "The host controls playback"}
          >
            {playback.isPlaying ? "Ⅱ" : "▶"}
          </button>
        )}
        <button
          onClick={onLeave}
          className="rounded-full border border-white/10 px-3 py-2 text-xs text-white/45 hover:text-white"
        >
          Leave
        </button>
      </div>
    </div>
  );
};

const syncAudio = (
  audio: HTMLAudioElement,
  state: PlaybackState,
  setAudioBlocked: (blocked: boolean) => void
) => {
  const expectedPosition =
    state.position +
    (state.isPlaying
      ? Math.max(0, (Date.now() - state.serverTime) / 1000)
      : 0);
  if (Math.abs(audio.currentTime - expectedPosition) > 0.8) {
    audio.currentTime = Math.min(
      expectedPosition,
      audio.duration || expectedPosition
    );
  }
  if (state.isPlaying) {
    audio
      .play()
      .then(() => setAudioBlocked(false))
      .catch(() => setAudioBlocked(true));
  } else {
    audio.pause();
    setAudioBlocked(false);
  }
};

let youtubeApiPromise: Promise<void> | null = null;

const loadYouTubeApi = () => {
  if (typeof window === "undefined") return Promise.resolve();
  if ((window as any).YT?.Player) return Promise.resolve();
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise<void>((resolve, reject) => {
    const previousReady = (window as any).onYouTubeIframeAPIReady;
    (window as any).onYouTubeIframeAPIReady = () => {
      previousReady?.();
      resolve();
    };
    const existing = document.querySelector(
      'script[src="https://www.youtube.com/iframe_api"]'
    );
    if (existing) return;
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => reject(new Error("YouTube player could not load"));
    document.head.appendChild(script);
  });
  return youtubeApiPromise;
};

export const useRoomSession = () => {
  const value = useContext(RoomSessionContext);
  if (!value) {
    throw new Error("useRoomSession must be used inside RoomSessionProvider");
  }
  return value;
};
