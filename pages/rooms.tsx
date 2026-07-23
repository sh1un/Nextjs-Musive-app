import type { NextPage } from "next";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";

import AppLayout from "@/layouts/appLayout";
import roomsService from "@/services/roomsService";
import { useRoomSession } from "@/components/RoomSessionProvider";

const Rooms: NextPage = () => {
  const router = useRouter();
  const { room } = useRoomSession();
  const { user } = useSelector((state: any) => state.auth);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | "">("");

  useEffect(() => {
    if (room) router.replace(`/rooms/${room.code}`);
  }, [room, router]);

  if (room) {
    return (
      <AppLayout title="Listening Rooms" color="#6d28d9">
        <div className="flex h-screen items-center justify-center">
          <span className="loader" />
        </div>
      </AppLayout>
    );
  }

  const createRoom = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !user?.token) return;
    setBusy("create");
    try {
      const room = await roomsService.createRoom(name.trim(), user.token);
      await router.push(`/rooms/${room.code}`);
    } catch (error: any) {
      toast.error(getError(error));
      setBusy("");
    }
  };

  const joinRoom = async (event: FormEvent) => {
    event.preventDefault();
    if (!code.trim() || !user?.token) return;
    setBusy("join");
    try {
      const roomCode = await roomsService.joinRoom(
        code.trim().toUpperCase(),
        user.token
      );
      await router.push(`/rooms/${roomCode}`);
    } catch (error: any) {
      toast.error(getError(error));
      setBusy("");
    }
  };

  return (
    <AppLayout title="Listening Rooms" color="#6d28d9">
      <main className="min-h-screen px-8 pb-40 pt-14 mobile:px-4 mobile:pt-7 tablet:px-6">
        <div className="mx-auto max-w-5xl">
          <div className="max-w-2xl">
            <p className="text-xs font-ProximaBold uppercase tracking-[0.22em] text-violet-300">
              Listen together
            </p>
            <h1 className="mt-4 text-5xl font-ProximaBold mobile:text-3xl">
              One room. One beat.
            </h1>
            <p className="mt-3 text-lg text-white/55">
              Sync music with friends, chat, react, and vote on what plays next.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-5 mobile:grid-cols-1 tablet:grid-cols-1">
            <form
              onSubmit={createRoom}
              className="rounded-2xl border border-violet-400/20 bg-violet-500/10 p-6"
            >
              <div className="text-3xl">✦</div>
              <h2 className="mt-5 text-2xl font-ProximaBold">
                Create a room
              </h2>
              <p className="mt-2 text-sm text-white/45">
                You’ll be the host and control synchronized playback.
              </p>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={60}
                placeholder="Friday night Lo-Fi"
                className="mt-7 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-violet-400/60"
              />
              <button
                disabled={!name.trim() || Boolean(busy)}
                className="mt-3 w-full rounded-full bg-white py-3 font-ProximaBold text-black disabled:opacity-40"
              >
                {busy === "create" ? "Creating..." : "Create room"}
              </button>
            </form>

            <form
              onSubmit={joinRoom}
              className="rounded-2xl border border-white/10 bg-black/25 p-6"
            >
              <div className="text-3xl">⌁</div>
              <h2 className="mt-5 text-2xl font-ProximaBold">Join friends</h2>
              <p className="mt-2 text-sm text-white/45">
                Enter the six-character code shared by the host.
              </p>
              <input
                value={code}
                onChange={(event) =>
                  setCode(event.target.value.toUpperCase().slice(0, 8))
                }
                placeholder="ABC123"
                className="mt-7 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-center font-ProximaBold uppercase tracking-[0.35em] outline-none focus:border-violet-400/60"
              />
              <button
                disabled={!code.trim() || Boolean(busy)}
                className="mt-3 w-full rounded-full border border-white/15 py-3 font-ProximaBold hover:bg-white/10 disabled:opacity-40"
              >
                {busy === "join" ? "Joining..." : "Join room"}
              </button>
            </form>
          </div>
        </div>
      </main>
    </AppLayout>
  );
};

const getError = (error: any) =>
  error.response?.data?.error || error.message || "Something went wrong";

export default Rooms;
