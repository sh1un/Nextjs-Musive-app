import type { NextPage } from "next";
import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "react-toastify";

import AppLayout from "@/layouts/appLayout";
import { TrackProps } from "@/interfaces/Track";
import uploadsService, {
  YouTubeMetadata,
} from "@/services/uploadsService";
import {
  playPause,
  setActiveSong,
} from "@/stores/player/currentAudioPlayer";

const audioAccept = ".mp3,.wav,.m4a,.aac,.ogg,audio/*";

const UploadMusic: NextPage = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state: any) => state.auth);
  const [audio, setAudio] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState(0);
  const [tags, setTags] = useState("lofi");
  const [moods, setMoods] = useState("chill");
  const [color, setColor] = useState("#7c3aed");
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [myUploads, setMyUploads] = useState<TrackProps[]>([]);
  const [loading, setLoading] = useState(true);
  const [youtubeUrl, setYouTubeUrl] = useState("");
  const [youtubeMetadata, setYouTubeMetadata] =
    useState<YouTubeMetadata | null>(null);
  const [importingYouTube, setImportingYouTube] = useState(false);

  const loadUploads = async () => {
    if (!user?.token) return;
    try {
      setMyUploads(await uploadsService.getMyUploads(user.token));
    } catch (error: any) {
      toast.error(getError(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUploads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.token]);

  useEffect(
    () => () => {
      if (coverPreview) URL.revokeObjectURL(coverPreview);
    },
    [coverPreview]
  );

  const chooseAudio = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error("Audio must be smaller than 25 MB");
      event.target.value = "";
      return;
    }
    try {
      const seconds = await readAudioDuration(file);
      setAudio(file);
      setDuration(seconds);
      if (!title) {
        setTitle(file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "));
      }
    } catch {
      toast.error("This audio file could not be read by your browser");
    }
  };

  const chooseCover = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Cover image must be smaller than 5 MB");
      event.target.value = "";
      return;
    }
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCover(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const isYouTubeUpload = Boolean(youtubeMetadata);
    if (
      (!isYouTubeUpload && (!audio || !duration)) ||
      !title.trim() ||
      !user?.token
    )
      return;
    setUploading(true);
    setProgress(0);
    try {
      const track = await uploadsService.uploadTrack(
        {
          audio: audio || undefined,
          cover: cover || undefined,
          title: title.trim(),
          duration: isYouTubeUpload ? 0 : duration,
          tags,
          moods,
          color,
          youtube: youtubeMetadata || undefined,
        },
        user.token,
        setProgress
      );
      setMyUploads((current) => [track, ...current]);
      setAudio(null);
      setCover(null);
      setCoverPreview("");
      setTitle("");
      setDuration(0);
      setProgress(100);
      setYouTubeUrl("");
      setYouTubeMetadata(null);
      toast.success(
        isYouTubeUpload ? "YouTube track added" : "Track uploaded"
      );
      if (!isYouTubeUpload) playTrack(track, [track, ...myUploads]);
    } catch (error: any) {
      toast.error(getError(error));
    } finally {
      setUploading(false);
    }
  };

  const importYouTube = async () => {
    if (!youtubeUrl.trim() || !user?.token) return;
    setImportingYouTube(true);
    try {
      const metadata = await uploadsService.getYouTubeMetadata(
        youtubeUrl.trim(),
        user.token
      );
      setYouTubeMetadata(metadata);
      setAudio(null);
      setDuration(0);
      setTitle(metadata.title);
      toast.success("YouTube details imported");
    } catch (error: any) {
      setYouTubeMetadata(null);
      toast.error(getError(error));
    } finally {
      setImportingYouTube(false);
    }
  };

  const playTrack = (track: TrackProps, tracks = myUploads) => {
    if (track.type === "youtube" && track.source_url) {
      window.open(track.source_url, "_blank", "noopener,noreferrer");
      return;
    }
    const playlist = tracks.length ? tracks : [track];
    dispatch(
      setActiveSong({
        tracks: playlist,
        index: Math.max(
          0,
          playlist.findIndex((item) => item.id === track.id)
        ),
      })
    );
    dispatch(playPause(true));
  };

  return (
    <AppLayout title="Upload Music" color="#7c3aed">
      <main className="min-h-screen px-8 pb-40 pt-12 mobile:px-4 mobile:pt-6 tablet:px-6">
        <div className="mx-auto max-w-5xl">
          <div>
            <p className="text-xs font-ProximaBold uppercase tracking-[0.2em] text-violet-300">
              Your music
            </p>
            <h1 className="mt-3 text-4xl font-ProximaBold mobile:text-3xl">
              Upload a track
            </h1>
            <p className="mt-2 text-white/50">
              Add your own audio to Musive and play it anywhere in the app.
            </p>
          </div>

          <section className="mt-8 rounded-2xl border border-red-400/15 bg-red-500/[0.06] p-5">
            <div className="flex items-start justify-between gap-4 mobile:flex-col">
              <div>
                <p className="text-xs font-ProximaBold uppercase tracking-[0.18em] text-red-300">
                  Import from YouTube
                </p>
                <h2 className="mt-2 text-xl font-ProximaBold">
                  Bring in the details
                </h2>
                <p className="mt-1 text-sm text-white/45">
                  Imports the title, creator and thumbnail. YouTube tracks play
                  through the official player, so no audio file is required.
                </p>
              </div>
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/35">
                No audio file needed
              </span>
            </div>
            <div className="mt-4 flex gap-2 mobile:flex-col">
              <input
                value={youtubeUrl}
                onChange={(event) => {
                  setYouTubeUrl(event.target.value);
                  if (youtubeMetadata) setYouTubeMetadata(null);
                }}
                placeholder="https://www.youtube.com/watch?v=..."
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#121212] px-4 py-3 outline-none focus:border-red-400/50"
              />
              <button
                type="button"
                onClick={importYouTube}
                disabled={!youtubeUrl.trim() || importingYouTube}
                className="rounded-xl bg-white px-5 py-3 font-ProximaBold text-black disabled:opacity-40"
              >
                {importingYouTube ? "Importing..." : "Import details"}
              </button>
            </div>
            {youtubeMetadata && (
              <div className="mt-5 grid grid-cols-[1fr_0.8fr] gap-4 mobile:grid-cols-1 tablet:grid-cols-1">
                <div className="aspect-video overflow-hidden rounded-xl bg-black">
                  <iframe
                    src={`${youtubeMetadata.embedUrl}?rel=0`}
                    title={youtubeMetadata.title}
                    className="h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                </div>
                <div className="flex items-center rounded-xl border border-white/10 bg-black/20 p-4">
                  <img
                    src={youtubeMetadata.thumbnailUrl}
                    alt=""
                    className="h-20 w-28 rounded-lg object-cover"
                  />
                  <div className="ml-4 min-w-0">
                    <p className="line-clamp-2 font-ProximaBold">
                      {youtubeMetadata.title}
                    </p>
                    <p className="mt-2 truncate text-sm text-white/45">
                      {youtubeMetadata.author}
                    </p>
                    <p className="mt-1 text-xs text-emerald-300">
                      Details ready
                    </p>
                  </div>
                </div>
              </div>
            )}
          </section>

          <form
            onSubmit={submit}
            className="mt-8 grid grid-cols-[0.75fr_1.25fr] gap-5 rounded-2xl border border-white/10 bg-black/25 p-6 mobile:grid-cols-1 mobile:p-4 tablet:grid-cols-1"
          >
            <div>
              <label className="group flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-dashed border-white/20 bg-white/5 transition hover:border-violet-400/60">
                {coverPreview || youtubeMetadata?.thumbnailUrl ? (
                  <img
                    src={coverPreview || youtubeMetadata?.thumbnailUrl}
                    alt="Cover preview"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-center">
                    <span className="block text-4xl">＋</span>
                    <span className="mt-2 block text-sm text-white/40">
                      Optional cover
                    </span>
                    <span className="mt-1 block text-xs text-white/25">
                      JPG, PNG or WebP · 5 MB
                    </span>
                  </span>
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={chooseCover}
                  className="hidden"
                />
              </label>
              <label className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <span className="text-sm text-white/60">Accent color</span>
                <input
                  type="color"
                  value={color}
                  onChange={(event) => setColor(event.target.value)}
                  className="h-8 w-12 cursor-pointer rounded border-0 bg-transparent"
                />
              </label>
            </div>

            <div>
              <label className="block text-sm font-ProximaBold">
                Audio file
                {youtubeMetadata && (
                  <span className="ml-2 font-ProximaRegular text-emerald-300">
                    Not required for YouTube
                  </span>
                )}
              </label>
              <label
                className={`mt-2 flex items-center rounded-xl border border-white/10 bg-[#121212] p-4 transition ${
                  youtubeMetadata
                    ? "cursor-not-allowed opacity-45"
                    : "cursor-pointer hover:border-violet-400/50"
                }`}
              >
                <span className="mr-4 text-2xl text-violet-300">♫</span>
                <span className="min-w-0">
                  <span className="block truncate font-ProximaBold">
                    {audio?.name || "Choose an audio file"}
                  </span>
                  <span className="mt-1 block text-xs text-white/35">
                    {duration
                      ? `${formatTime(duration)} · ${formatSize(audio?.size || 0)}`
                      : "MP3, WAV, M4A, AAC or OGG · 25 MB"}
                  </span>
                </span>
                <input
                  type="file"
                  accept={audioAccept}
                  onChange={chooseAudio}
                  disabled={Boolean(youtubeMetadata)}
                  className="hidden"
                />
              </label>

              <label className="mt-5 block text-sm font-ProximaBold">
                Track title
              </label>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={120}
                placeholder="Midnight study"
                className="mt-2 w-full rounded-xl border border-white/10 bg-[#121212] px-4 py-3 outline-none focus:border-violet-400/60"
              />

              <div className="mt-5 grid grid-cols-2 gap-3 mobile:grid-cols-1">
                <label className="text-sm font-ProximaBold">
                  Tags
                  <input
                    value={tags}
                    onChange={(event) => setTags(event.target.value)}
                    placeholder="lofi, study"
                    className="mt-2 block w-full rounded-xl border border-white/10 bg-[#121212] px-4 py-3 font-ProximaRegular outline-none focus:border-violet-400/60"
                  />
                </label>
                <label className="text-sm font-ProximaBold">
                  Moods
                  <input
                    value={moods}
                    onChange={(event) => setMoods(event.target.value)}
                    placeholder="chill, dreamy"
                    className="mt-2 block w-full rounded-xl border border-white/10 bg-[#121212] px-4 py-3 font-ProximaRegular outline-none focus:border-violet-400/60"
                  />
                </label>
              </div>

              {uploading && (
                <div className="mt-5">
                  <div className="mb-2 flex justify-between text-xs text-white/45">
                    <span>Uploading...</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-violet-400 transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              <button
                disabled={
                  (!youtubeMetadata && !audio) || !title.trim() || uploading
                }
                className="mt-6 w-full rounded-full bg-white py-3 font-ProximaBold text-black transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
              >
                {uploading
                  ? "Uploading..."
                  : youtubeMetadata
                  ? "Add YouTube track"
                  : "Upload track"}
              </button>
            </div>
          </form>

          <section className="mt-10">
            <h2 className="text-xl font-ProximaBold">My uploads</h2>
            {loading ? (
              <div className="flex h-32 items-center justify-center">
                <span className="loader" />
              </div>
            ) : myUploads.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-white/15 py-12 text-center text-white/35">
                Your uploaded tracks will appear here.
              </p>
            ) : (
              <div className="mt-4 divide-y divide-white/5 rounded-2xl border border-white/10 bg-black/20">
                {myUploads.map((track) => (
                  <button
                    key={track.id}
                    onClick={() => playTrack(track)}
                    className="flex w-full items-center p-4 text-left transition hover:bg-white/5"
                  >
                    <span
                      className="mr-4 flex h-11 w-11 items-center justify-center rounded-lg"
                      style={{ background: track.cover_image.color }}
                    >
                      ▶
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-ProximaBold">
                        {track.track_name}
                      </span>
                      <span className="mt-1 block text-xs text-white/35">
                        {track.type === "youtube"
                          ? "YouTube"
                          : formatTime(track.duration)}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </AppLayout>
  );
};

const readAudioDuration = (file: File) =>
  new Promise<number>((resolve, reject) => {
    const audio = document.createElement("audio");
    const url = URL.createObjectURL(file);
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      const value = audio.duration;
      URL.revokeObjectURL(url);
      Number.isFinite(value) && value > 0 ? resolve(value) : reject();
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      reject();
    };
    audio.src = url;
  });

const formatTime = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(
    2,
    "0"
  )}`;

const formatSize = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

const getError = (error: any) =>
  error.response?.data?.error || error.response?.data?.message || error.message;

export default UploadMusic;
