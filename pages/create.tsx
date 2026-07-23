import type { NextPage } from "next";
import { FormEvent, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "react-toastify";

import AppLayout from "@/layouts/appLayout";
import aiMusicService from "@/services/aiMusicService";
import {
  playPause,
  setActiveSong,
} from "@/stores/player/currentAudioPlayer";

const styles = [
  "Cinematic",
  "Lo-fi",
  "Electronic",
  "Jazz",
  "Ambient",
  "Pop",
];

const moods = ["Dreamy", "Energetic", "Peaceful", "Dark", "Hopeful"];

const CreateMusic: NextPage = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state: any) => state.auth);
  const [description, setDescription] = useState("");
  const [style, setStyle] = useState("Cinematic");
  const [mood, setMood] = useState("Dreamy");
  const [duration, setDuration] = useState(15);
  const [instrumental, setInstrumental] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState("");

  const prompt = useMemo(
    () =>
      [
        `${mood.toLowerCase()} ${style.toLowerCase()} music`,
        description.trim(),
        instrumental ? "instrumental, no vocals" : "with expressive vocals",
        "high quality, polished production",
      ]
        .filter(Boolean)
        .join(". "),
    [description, instrumental, mood, style]
  );

  const generateMusic = async (event: FormEvent) => {
    event.preventDefault();
    if (!description.trim() || !user?.token || isGenerating) return;

    setIsGenerating(true);
    try {
      const result = await aiMusicService.generate(
        { prompt, duration, instrumental },
        user.token
      );
      const track = {
        id: -Date.now(),
        duration,
        track_name: description.trim().slice(0, 54),
        src: result.audioUrl,
        cover_image: {
          url: "/musive_intro_card.png",
          color: "#7c3aed",
        },
        artist_name: "Musive AI",
        artist_id: -1,
      };

      setGeneratedUrl(result.audioUrl);
      dispatch(setActiveSong({ tracks: [track], index: 0, playlist: "AI Music" }));
      dispatch(playPause(true));
      toast.success("Your track is ready");
    } catch (error: any) {
      toast.error(error.message || "Unable to generate music");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <AppLayout title="AI Music" color="#7c3aed">
      <main className="min-h-screen px-8 pt-12 pb-40 mobile:px-4 mobile:pt-6 tablet:px-6">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 max-w-2xl">
            <span className="inline-flex rounded-full border border-violet-400/30 bg-violet-400/10 px-3 py-1 text-xs font-ProximaBold uppercase tracking-[0.2em] text-violet-200">
              AI Music Studio
            </span>
            <h1 className="mt-5 text-5xl font-ProximaBold leading-tight mobile:text-3xl">
              Turn an idea into music.
            </h1>
            <p className="mt-3 text-lg text-white/60 mobile:text-base">
              Describe a scene, feeling, or moment. Musive will compose a
              playable track for you.
            </p>
          </div>

          <form
            onSubmit={generateMusic}
            className="grid grid-cols-[1.35fr_0.65fr] gap-6 mobile:grid-cols-1 tablet:grid-cols-1"
          >
            <section className="rounded-2xl border border-white/10 bg-black/30 p-6 shadow-2xl mobile:p-4">
              <label
                htmlFor="music-description"
                className="text-sm font-ProximaBold text-white/80"
              >
                What should it sound like?
              </label>
              <textarea
                id="music-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={600}
                rows={7}
                disabled={isGenerating}
                placeholder="A late-night train ride through a neon city, with a warm bassline and a slow emotional build..."
                className="mt-3 w-full resize-none rounded-xl border border-white/10 bg-[#121212] p-4 text-base text-white outline-none transition placeholder:text-white/25 focus:border-violet-400/70"
              />
              <div className="mt-2 text-right text-xs text-white/35">
                {description.length}/600
              </div>

              <div className="mt-6">
                <p className="mb-3 text-sm font-ProximaBold text-white/80">
                  Style
                </p>
                <div className="flex flex-wrap gap-2">
                  {styles.map((item) => (
                    <Choice
                      key={item}
                      label={item}
                      selected={style === item}
                      onClick={() => setStyle(item)}
                    />
                  ))}
                </div>
              </div>

              <div className="mt-6">
                <p className="mb-3 text-sm font-ProximaBold text-white/80">
                  Mood
                </p>
                <div className="flex flex-wrap gap-2">
                  {moods.map((item) => (
                    <Choice
                      key={item}
                      label={item}
                      selected={mood === item}
                      onClick={() => setMood(item)}
                    />
                  ))}
                </div>
              </div>
            </section>

            <aside className="rounded-2xl border border-white/10 bg-black/30 p-6 mobile:p-4">
              <p className="text-sm font-ProximaBold text-white/80">Duration</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[10, 15, 30].map((seconds) => (
                  <Choice
                    key={seconds}
                    label={`${seconds}s`}
                    selected={duration === seconds}
                    onClick={() => setDuration(seconds)}
                    grow
                  />
                ))}
              </div>

              <label className="mt-7 flex cursor-pointer items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4">
                <span>
                  <span className="block text-sm font-ProximaBold">
                    Instrumental
                  </span>
                  <span className="mt-1 block text-xs text-white/45">
                    Generate without vocals
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={instrumental}
                  onChange={(event) => setInstrumental(event.target.checked)}
                  className="h-5 w-5 accent-violet-500"
                />
              </label>

              <div className="mt-7 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/5 p-4 text-sm text-white/60">
                Generation may take a minute. Keep this page open while your
                track is being composed.
              </div>

              <button
                type="submit"
                disabled={!description.trim() || isGenerating}
                className="mt-5 flex w-full items-center justify-center rounded-full bg-white px-5 py-3 font-ProximaBold text-black transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
              >
                {isGenerating ? (
                  <>
                    <span className="mr-3 h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                    Composing...
                  </>
                ) : (
                  "Generate track"
                )}
              </button>

              {generatedUrl && (
                <a
                  href={generatedUrl}
                  download={`musive-ai-${Date.now()}.mp3`}
                  className="mt-3 block w-full rounded-full border border-white/15 px-5 py-3 text-center text-sm font-ProximaBold transition hover:bg-white/10"
                >
                  Download latest track
                </a>
              )}
            </aside>
          </form>
        </div>
      </main>
    </AppLayout>
  );
};

const Choice = ({
  label,
  selected,
  onClick,
  grow = false,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  grow?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`${grow ? "w-full" : ""} rounded-full border px-4 py-2 text-sm transition ${
      selected
        ? "border-violet-400 bg-violet-500 text-white"
        : "border-white/10 bg-white/5 text-white/65 hover:border-white/25 hover:text-white"
    }`}
  >
    {label}
  </button>
);

export default CreateMusic;
