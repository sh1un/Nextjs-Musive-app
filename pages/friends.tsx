import type { NextPage } from "next";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";

import AppLayout from "@/layouts/appLayout";
import friendsService, {
  FriendActivity,
  FriendRequest,
  UserSearchResult,
} from "@/services/friendsService";

const Friends: NextPage = () => {
  const { user } = useSelector((state: any) => state.auth);
  const [friends, setFriends] = useState<FriendActivity[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");

  const refresh = async (quiet = false) => {
    if (!user?.token) return;
    try {
      const [friendData, requestData] = await Promise.all([
        friendsService.getFriends(user.token),
        friendsService.getRequests(user.token),
      ]);
      setFriends(friendData);
      setRequests(requestData);
    } catch (error: any) {
      if (!quiet) toast.error(getError(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const interval = window.setInterval(() => refresh(true), 8000);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.token]);

  useEffect(() => {
    if (!user?.token || query.trim().length < 2) {
      setResults([]);
      return;
    }
    const timeout = window.setTimeout(async () => {
      try {
        setResults(
          await friendsService.searchUsers(query.trim(), user.token)
        );
      } catch (error: any) {
        toast.error(getError(error));
      }
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [query, user?.token]);

  const act = async (key: string, action: () => Promise<any>) => {
    setBusy(key);
    try {
      await action();
      await refresh(true);
      if (query.trim().length >= 2 && user?.token) {
        setResults(
          await friendsService.searchUsers(query.trim(), user.token)
        );
      }
    } catch (error: any) {
      toast.error(getError(error));
    } finally {
      setBusy("");
    }
  };

  return (
    <AppLayout title="Friends" color="#315a78">
      <main className="min-h-screen px-8 pb-40 pt-12 mobile:px-4 mobile:pt-6 tablet:px-6">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8">
            <p className="text-xs font-ProximaBold uppercase tracking-[0.2em] text-sky-300">
              Listening together
            </p>
            <h1 className="mt-3 text-4xl font-ProximaBold mobile:text-3xl">
              Friends
            </h1>
            <p className="mt-2 text-white/50">
              See what your friends are playing right now.
            </p>
          </div>

          <section className="rounded-2xl border border-white/10 bg-black/25 p-5">
            <label htmlFor="friend-search" className="text-sm font-ProximaBold">
              Find people by username
            </label>
            <input
              id="friend-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Start typing a username..."
              className="mt-3 w-full rounded-xl border border-white/10 bg-[#121212] px-4 py-3 outline-none transition placeholder:text-white/25 focus:border-sky-400/60"
            />
            {results.length > 0 && (
              <div className="mt-3 divide-y divide-white/5 rounded-xl border border-white/10 bg-[#151515]">
                {results.map((result) => (
                  <div
                    key={result.username}
                    className="flex items-center justify-between px-4 py-3"
                  >
                    <UserIdentity username={result.username} />
                    <RelationshipButton
                      result={result}
                      disabled={busy === `user-${result.username}`}
                      onClick={() =>
                        act(`user-${result.username}`, () =>
                          friendsService.sendRequest(
                            result.username,
                            user.token
                          )
                        )
                      }
                    />
                  </div>
                ))}
              </div>
            )}
          </section>

          {requests.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-3 text-lg font-ProximaBold">
                Requests
                <span className="ml-2 rounded-full bg-sky-500 px-2 py-0.5 text-xs">
                  {requests.length}
                </span>
              </h2>
              <div className="grid grid-cols-2 gap-3 mobile:grid-cols-1">
                {requests.map((request) => (
                  <div
                    key={request.id}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4"
                  >
                    <UserIdentity username={request.username} />
                    <div className="ml-3 flex gap-2">
                      <button
                        onClick={() =>
                          act(`request-${request.id}`, () =>
                            friendsService.acceptRequest(
                              request.id,
                              user.token
                            )
                          )
                        }
                        disabled={busy === `request-${request.id}`}
                        className="rounded-full bg-white px-3 py-1.5 text-xs font-ProximaBold text-black disabled:opacity-40"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() =>
                          act(`request-${request.id}`, () =>
                            friendsService.rejectRequest(
                              request.id,
                              user.token
                            )
                          )
                        }
                        disabled={busy === `request-${request.id}`}
                        className="rounded-full border border-white/15 px-3 py-1.5 text-xs disabled:opacity-40"
                      >
                        Ignore
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="mt-10">
            <h2 className="mb-4 text-xl font-ProximaBold">
              Friend activity
            </h2>
            {loading ? (
              <div className="flex h-48 items-center justify-center">
                <span className="loader" />
              </div>
            ) : friends.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/15 px-6 py-16 text-center">
                <p className="font-ProximaBold">Your listening circle is empty</p>
                <p className="mt-2 text-sm text-white/45">
                  Search for a username above to send your first request.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 mobile:grid-cols-1 tablet:grid-cols-1">
                {friends.map((friend) => (
                  <FriendCard
                    key={friend.username}
                    friend={friend}
                    removing={busy === `friend-${friend.username}`}
                    onRemove={() =>
                      act(`friend-${friend.username}`, () =>
                        friendsService.removeFriend(
                          friend.username,
                          user.token
                        )
                      )
                    }
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </AppLayout>
  );
};

const UserIdentity = ({ username }: { username: string }) => (
  <div className="flex min-w-0 items-center">
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-violet-600 font-ProximaBold uppercase">
      {username.charAt(0)}
    </div>
    <span className="ml-3 truncate font-ProximaBold">{username}</span>
  </div>
);

const RelationshipButton = ({
  result,
  disabled,
  onClick,
}: {
  result: UserSearchResult;
  disabled: boolean;
  onClick: () => void;
}) => {
  const labels = {
    friends: "Friends",
    outgoing: "Requested",
    incoming: "Accept",
    none: "Add friend",
  };
  const canClick = result.relationship === "none" || result.relationship === "incoming";
  return (
    <button
      disabled={!canClick || disabled}
      onClick={onClick}
      className={`ml-3 rounded-full px-4 py-2 text-xs font-ProximaBold ${
        canClick
          ? "bg-white text-black disabled:opacity-40"
          : "border border-white/15 text-white/45"
      }`}
    >
      {labels[result.relationship]}
    </button>
  );
};

const FriendCard = ({
  friend,
  removing,
  onRemove,
}: {
  friend: FriendActivity;
  removing: boolean;
  onRemove: () => void;
}) => (
  <article
    className={`group relative overflow-hidden rounded-2xl border p-5 transition ${
      friend.is_playing
        ? "friend-listening-card border-emerald-400/40 bg-emerald-400/[0.07]"
        : "border-white/10 bg-white/5 hover:bg-white/[0.08]"
    }`}
  >
    {friend.is_playing && (
      <div
        className="friend-listening-glow pointer-events-none absolute inset-0"
        aria-hidden="true"
      />
    )}
    <div className="flex items-center justify-between">
      <UserIdentity username={friend.username} />
      <div className="flex items-center gap-3">
        {friend.is_playing ? (
          <div className="friend-live-badge">
            <span className="friend-live-dot" />
            Listening now
          </div>
        ) : (
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              friend.is_online ? "bg-emerald-400" : "bg-white/20"
            }`}
            title={friend.is_online ? "Online" : "Offline"}
          />
        )}
        <button
          onClick={onRemove}
          disabled={removing}
          className="text-xs text-white/30 opacity-0 transition hover:text-red-300 group-hover:opacity-100 mobile:opacity-100"
        >
          Remove
        </button>
      </div>
    </div>

    {friend.track ? (
      <div
        className={`relative mt-5 flex items-center rounded-xl p-3 ${
          friend.is_playing
            ? "bg-emerald-950/35 shadow-[0_12px_35px_rgba(16,185,129,0.12)]"
            : "bg-black/25"
        }`}
      >
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-lg ${
            friend.is_playing ? "friend-album-pulse" : ""
          }`}
          style={{
            backgroundColor: friend.track.cover_image?.color || "#334155",
          }}
        >
          {friend.is_playing ? (
            <span
              className="friend-equalizer"
              aria-label="Currently playing"
            >
              <i />
              <i />
              <i />
              <i />
            </span>
          ) : (
            "Ⅱ"
          )}
        </div>
        <div className="ml-3 min-w-0">
          <p className="truncate font-ProximaBold">{friend.track.track_name}</p>
          <p className="truncate text-sm text-white/45">
            {friend.track.artist_name}
          </p>
          <p
            className={`mt-1 text-[11px] font-ProximaBold uppercase tracking-[0.14em] ${
              friend.is_playing ? "text-emerald-300" : "text-white/30"
            }`}
          >
            {friend.is_playing
              ? `Listening now · ${formatTime(friend.progress_seconds)}`
              : friend.is_online
              ? "Paused"
              : "Last played"}
          </p>
          {friend.track.listening_context?.type === "room" && (
            <p className="mt-1 truncate text-xs font-ProximaBold text-violet-300">
              In {friend.track.listening_context.room_name} ·{" "}
              {friend.track.listening_context.listener_count}{" "}
              {friend.track.listening_context.listener_count === 1
                ? "person"
                : "people"}
            </p>
          )}
        </div>
      </div>
    ) : (
      <p className="mt-6 text-sm text-white/35">Nothing played yet</p>
    )}
  </article>
);

const formatTime = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(
    2,
    "0"
  )}`;

const getError = (error: any) =>
  error.response?.data?.error || error.message || "Something went wrong";

export default Friends;
