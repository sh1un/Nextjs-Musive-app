import type { NextPage } from "next";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";

import AppLayout from "@/layouts/appLayout";
import roomsService, { RoomTrack } from "@/services/roomsService";
import { useRoomSession } from "@/components/RoomSessionProvider";
import uploadsService from "@/services/uploadsService";
import friendsService, {
  UserSearchResult,
} from "@/services/friendsService";

const reactionOptions = ["🔥", "💚", "🎧", "✨", "👏", "😮"];

const ListeningRoom: NextPage = () => {
  const router = useRouter();
  const code = String(router.query.code || "").toUpperCase();
  const { user } = useSelector((state: any) => state.auth);
  const session = useRoomSession();
  const [tracks, setTracks] = useState<RoomTrack[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [youtubeUrl, setYouTubeUrl] = useState("");
  const [importingYouTube, setImportingYouTube] = useState(false);
  const [relationships, setRelationships] = useState<
    Record<string, UserSearchResult["relationship"]>
  >({});
  const [friendBusy, setFriendBusy] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!code || !user?.token) return;
    let active = true;
    Promise.all([
      roomsService.getRoom(code, user.token),
      roomsService.getTracks(),
    ])
      .then(([roomData, trackData]) => {
        if (!active) return;
        session.joinSession(roomData);
        setTracks(
          trackData.filter((track) => track.src.includes("localhost:"))
        );
        setLoading(false);
      })
      .catch((error) => {
        toast.error(getError(error));
        router.push("/rooms");
      });
    return () => {
      active = false;
    };
    // session intentionally omitted: context updates on every room event.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, router, user?.token]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session.messages.length]);

  useEffect(() => {
    if (!user?.token || !session.members.length) return;
    let active = true;
    Promise.all(
      session.members
        .filter((member) => member !== user.username)
        .map(async (member) => {
          const results = await friendsService.searchUsers(
            member,
            user.token
          );
          return [
            member,
            results.find((result) => result.username === member)
              ?.relationship || "none",
          ] as const;
        })
    )
      .then((entries) => {
        if (active) setRelationships(Object.fromEntries(entries));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [session.members, user?.token, user?.username]);

  const addFriend = async (username: string) => {
    if (!user?.token) return;
    setFriendBusy(username);
    try {
      const result = await friendsService.sendRequest(username, user.token);
      setRelationships((current) => ({
        ...current,
        [username]: result.accepted ? "friends" : "outgoing",
      }));
      toast.success(
        result.accepted
          ? `You and ${username} are now friends`
          : `Friend request sent to ${username}`
      );
    } catch (error) {
      toast.error(getError(error));
    } finally {
      setFriendBusy("");
    }
  };

  const sendMessage = (event: FormEvent) => {
    event.preventDefault();
    if (!message.trim()) return;
    session.sendMessage(message.trim());
    setMessage("");
  };

  const addYouTube = async () => {
    if (!youtubeUrl.trim() || !user?.token) return;
    setImportingYouTube(true);
    try {
      const metadata = await uploadsService.getYouTubeMetadata(
        youtubeUrl.trim(),
        user.token
      );
      session.addToQueue({
        id: -Number(String(Date.now()).slice(-9)),
        type: "youtube",
        track_name: metadata.title,
        artist_name: metadata.author,
        src: metadata.url,
        source_url: metadata.url,
        video_id: metadata.videoId,
        duration: 0,
        cover_image: {
          url: metadata.thumbnailUrl,
          color: "#ff0033",
        },
      });
      setYouTubeUrl("");
      toast.success("YouTube video added to the vote");
    } catch (error: any) {
      toast.error(getError(error));
    } finally {
      setImportingYouTube(false);
    }
  };

  if (loading || !session.room || session.room.code !== code) {
    return (
      <AppLayout title="Listening Room" color="#6d28d9">
        <div className="flex h-screen items-center justify-center">
          <span className="loader" />
        </div>
      </AppLayout>
    );
  }

  const { room, playback, queue, messages, members } = session;

  return (
    <AppLayout
      title={room.name}
      color={playback.track?.cover_image?.color || "#6d28d9"}
    >
      <main className="min-h-screen px-6 pb-16 pt-7 mobile:px-3">
        <div className="mx-auto max-w-7xl">
          <header className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/25 px-5 py-4 mobile:items-start">
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${
                    session.connected ? "bg-emerald-400" : "bg-amber-400"
                  }`}
                />
                <span className="text-xs uppercase tracking-wider text-white/40">
                  {session.connected ? "Live room" : "Connecting"}
                </span>
              </div>
              <h1 className="mt-1 text-2xl font-ProximaBold">{room.name}</h1>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(room.code);
                toast.success("Room code copied");
              }}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2"
            >
              <span className="text-[10px] uppercase text-white/35">
                Room code
              </span>
              <span className="ml-2 font-ProximaBold tracking-[0.2em]">
                {room.code}
              </span>
            </button>
          </header>

          <div className="mt-5 grid grid-cols-[1.15fr_0.85fr_0.8fr] gap-4 mini-laptop:grid-cols-2 tablet:grid-cols-1 mobile:grid-cols-1">
            <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30 p-6">
              {session.reactions.map((reaction, index) => (
                <span
                  key={reaction.id}
                  className="room-floating-reaction"
                  style={{ left: `${20 + ((index * 19) % 65)}%` }}
                  title={reaction.username}
                >
                  {reaction.emoji}
                </span>
              ))}
              <div
                className={`mx-auto flex max-h-[340px] items-center justify-center overflow-hidden rounded-2xl text-8xl shadow-2xl ${
                  playback.track?.type === "youtube"
                    ? "aspect-video w-full"
                    : "aspect-square"
                }`}
                style={{
                  background: playback.track?.cover_image?.color || "#252032",
                }}
              >
                {playback.track?.type === "youtube" ? (
                  <div className="relative h-full w-full bg-black">
                    <div
                      ref={session.setYouTubeRoomMount}
                      className="h-full w-full"
                    />
                    <div
                      className="absolute inset-0 z-10 cursor-default"
                      title="Use Musive controls for room playback"
                      aria-label="YouTube playback is controlled by Musive"
                    />
                  </div>
                ) : playback.track?.cover_image?.url ? (
                  <img
                    src={playback.track.cover_image.url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : playback.track ? (
                  "♫"
                ) : (
                  "⌁"
                )}
              </div>
              <div className="mt-6 text-center">
                <h2 className="truncate text-2xl font-ProximaBold">
                  {playback.track?.track_name || "Queue a song to begin"}
                </h2>
                <p className="mt-1 text-white/45">
                  {playback.track?.artist_name || "The room is waiting"}
                </p>
              </div>
              <div className="mt-6 flex justify-center gap-3">
                <button
                  onClick={session.togglePlayback}
                  disabled={!session.isHost || !playback.track}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-xl text-black disabled:opacity-30"
                  title={
                    session.isHost
                      ? "Play or pause"
                      : "Host controls playback"
                  }
                >
                  {playback.isPlaying ? "Ⅱ" : "▶"}
                </button>
                <button
                  onClick={session.playNext}
                  disabled={
                    !session.isHost ||
                    !queue.some((item) => item.status === "pending")
                  }
                  className="rounded-full border border-white/15 px-5 text-sm font-ProximaBold disabled:opacity-30"
                >
                  Next
                </button>
              </div>
              {session.audioBlocked && playback.isPlaying && (
                <button
                  onClick={session.unlockAudio}
                  className="mx-auto mt-4 block rounded-full bg-emerald-400 px-5 py-2 text-sm font-ProximaBold text-emerald-950 shadow-[0_0_25px_rgba(52,211,153,0.3)]"
                >
                  Tap to join the audio
                </button>
              )}
              {!session.isHost && (
                <p className="mt-4 text-center text-xs text-white/30">
                  {room.host_username} is hosting playback
                </p>
              )}
              <div className="mt-6 flex justify-center gap-2">
                {reactionOptions.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => session.sendReaction(emoji)}
                    className="rounded-full bg-white/5 p-2 text-lg transition hover:scale-125 hover:bg-white/10"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-black/25 p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-ProximaBold">Up next</h2>
                <span className="text-xs text-white/35">Vote to move it up</span>
              </div>
              <div className="mt-4 max-h-[300px] space-y-2 overflow-y-auto pr-1 scrollbar">
                {queue.length === 0 && (
                  <p className="py-8 text-center text-sm text-white/35">
                    The queue is empty
                  </p>
                )}
                {queue.map((item) => {
                  const voted =
                    item.voters?.includes(user.username) || item.has_voted;
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center rounded-xl p-3 ${
                        item.status === "playing"
                          ? "bg-emerald-400/10"
                          : "bg-white/5"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-ProximaBold">
                          {item.track.track_name}
                        </p>
                        <p className="truncate text-xs text-white/35">
                          by {item.track.artist_name} · added by {item.added_by}
                        </p>
                      </div>
                      {item.status === "pending" && (
                        <button
                          onClick={() => session.vote(item.id)}
                          className={`ml-2 rounded-full px-3 py-1.5 text-xs font-ProximaBold ${
                            voted ? "bg-violet-500" : "bg-white/10"
                          }`}
                        >
                          ▲ {item.votes}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-6 rounded-xl border border-red-400/15 bg-red-500/[0.06] p-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-ProximaBold text-red-200">
                    Add from YouTube
                  </h3>
                  <span className="text-[10px] uppercase tracking-wider text-white/25">
                    Official player
                  </span>
                </div>
                <div className="mt-2 flex gap-2">
                  <input
                    value={youtubeUrl}
                    onChange={(event) => setYouTubeUrl(event.target.value)}
                    placeholder="Paste YouTube URL"
                    className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs outline-none focus:border-red-400/50"
                  />
                  <button
                    type="button"
                    onClick={addYouTube}
                    disabled={!youtubeUrl.trim() || importingYouTube}
                    className="rounded-lg bg-white px-3 text-xs font-ProximaBold text-black disabled:opacity-40"
                  >
                    {importingYouTube ? "..." : "Add"}
                  </button>
                </div>
              </div>
              <h3 className="mt-6 text-sm font-ProximaBold">Add from Musive</h3>
              <div className="mt-3 max-h-[230px] space-y-2 overflow-y-auto pr-1 scrollbar">
                {tracks.map((track) => (
                  <button
                    key={track.id}
                    onClick={() => session.addToQueue(track)}
                    className="flex w-full items-center rounded-xl border border-transparent bg-white/[0.04] p-3 text-left transition hover:border-white/10 hover:bg-white/[0.08]"
                  >
                    <span className="mr-3 text-violet-300">＋</span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-ProximaBold">
                        {track.track_name}
                      </span>
                      <span className="block truncate text-xs text-white/35">
                        {track.artist_name}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section className="flex min-h-[580px] flex-col rounded-2xl border border-white/10 bg-black/25 p-5 mini-laptop:col-span-2 tablet:col-span-1">
              <div className="border-b border-white/10 pb-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-ProximaBold">In this room</h2>
                  <span className="text-xs text-emerald-300">
                    {members.length} online
                  </span>
                </div>
                <div className="mt-3 max-h-36 space-y-2 overflow-y-auto pr-1 scrollbar">
                  {members.map((member) => {
                    const memberIsHost = member === room.host_username;
                    const memberIsMe = member === user.username;
                    return (
                      <div
                        key={member}
                        className="flex items-center rounded-xl bg-white/[0.04] px-3 py-2.5 mobile:items-start"
                      >
                        <span className="mr-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-sky-400 text-xs font-ProximaBold uppercase">
                          {member.slice(0, 1)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-ProximaBold">
                            {member}
                            {memberIsMe && (
                              <span className="ml-1 font-ProximaRegular text-white/30">
                                (You)
                              </span>
                            )}
                          </span>
                          <span
                            className={`text-[10px] uppercase tracking-wider ${
                              memberIsHost
                                ? "text-amber-300"
                                : "text-emerald-300/70"
                            }`}
                          >
                            {memberIsHost ? "★ Host" : "Listening"}
                          </span>
                        </span>
                        {!memberIsMe && (
                          <div className="ml-2 flex shrink-0 items-center gap-2 mobile:flex-col mobile:items-end">
                            {relationships[member] === "friends" ? (
                              <span className="rounded-full border border-sky-300/15 px-3 py-1.5 text-[11px] text-sky-200/60">
                                Friends
                              </span>
                            ) : relationships[member] === "outgoing" ? (
                              <span className="rounded-full border border-white/10 px-3 py-1.5 text-[11px] text-white/35">
                                Requested
                              </span>
                            ) : (
                              <button
                                onClick={() => addFriend(member)}
                                disabled={friendBusy === member}
                                className="rounded-full bg-white px-3 py-1.5 text-[11px] font-ProximaBold text-black disabled:opacity-40"
                              >
                                {relationships[member] === "incoming"
                                  ? "Accept"
                                  : "Add friend"}
                              </button>
                            )}
                            {session.isHost && !memberIsHost && (
                              <button
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      `Make ${member} the room host?`
                                    )
                                  ) {
                                    session.transferHost(member);
                                  }
                                }}
                                className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-[11px] font-ProximaBold text-amber-200 transition hover:bg-amber-300/20"
                              >
                                Make host
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <h2 className="text-lg font-ProximaBold">Room chat</h2>
                <span className="text-xs text-white/30">Live messages</span>
              </div>
              <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1 scrollbar">
                {messages.map((item) => (
                  <div
                    key={item.id}
                    className={`flex ${
                      item.username === user.username
                        ? "justify-end"
                        : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[82%] ${
                        item.username === user.username
                          ? "text-right"
                          : "text-left"
                      }`}
                    >
                      <span
                        className={`block px-1 text-xs font-ProximaBold ${
                          item.username === user.username
                            ? "text-violet-300"
                            : "text-sky-300"
                        }`}
                      >
                        {item.username === user.username
                          ? "You"
                          : item.username}
                      </span>
                      <p
                        className={`mt-1 break-words rounded-2xl px-3.5 py-2.5 text-left text-sm ${
                          item.username === user.username
                            ? "rounded-br-md bg-violet-500 text-white"
                            : "rounded-bl-md bg-white/[0.08] text-white/80"
                        }`}
                      >
                        {item.message}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              <form onSubmit={sendMessage} className="mt-4 flex gap-2">
                <input
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  maxLength={500}
                  placeholder="Say something..."
                  className="min-w-0 flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none focus:border-violet-400/50"
                />
                <button className="rounded-full bg-white px-4 text-sm font-ProximaBold text-black">
                  Send
                </button>
              </form>
            </section>
          </div>
        </div>
      </main>
    </AppLayout>
  );
};

const getError = (error: any) =>
  error.response?.data?.error || error.message || "Something went wrong";

export default ListeningRoom;
