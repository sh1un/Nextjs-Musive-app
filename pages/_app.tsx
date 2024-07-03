import "../styles/globals.css";
import type { AppProps } from "next/app";
import { Provider } from "react-redux";
import store from "../stores/store";
import NextNProgress from "nextjs-progressbar";
import { useRouter } from "next/router";
import AudioPlayer from "../components/AudioPlayer/AudioPlayer";
import SidebarItem from "../components/sidebarItem";
import Head from "next/head";
import "react-toastify/dist/ReactToastify.css";
import useDetectKeyboardOpen from "use-detect-keyboard-open";
import AddToCollectionModel from "@/components/AddToCollectionModel";
import { ToastContainer } from "react-toastify";
import { useEffect, useRef } from "react";
import homePageApi from "../stores/homePage/homePageApi";
import { Song } from "@/interfaces/Track";

function MyApp({ Component, pageProps }: AppProps) {
  const audioElements = useRef<Map<number, HTMLAudioElement>>(new Map());

  useEffect(() => {
    // Fetch random songs and preload them
    const fetchAndPreloadSongs = async () => {
      try {
        const { topHits } = await homePageApi.getRandomArtists();
        preloadSongs(topHits);
      } catch (error) {
        console.error("Error fetching random songs:", error);
      }
    };

    const preloadSongs = (songs: Song[]) => {
      songs.forEach((song) => {
        const audio = new Audio();
        audio.src = song.src;
        audio.load();
        audioElements.current.set(song.id, audio);
        console.log(`Preloading song: ${song.track_name}`);
      });
    };

    fetchAndPreloadSongs();
  }, []);

  return (
    <Provider store={store}>
      <Head>
        <link
          rel="preload"
          href="/musive-icons.ttf"
          as="font"
          crossOrigin=""
          type="font/ttf"
        />
        <link
          rel="preload"
          href="/ProximaNova/Proxima Nova Reg.otf"
          as="font"
          crossOrigin=""
          type="font/otf"
        />
        <link
          rel="preload"
          href="/ProximaNova/Proxima Nova Bold.otf"
          as="font"
          crossOrigin=""
          type="font/otf"
        />
      </Head>
      <NextNProgress
        color="#2bb540"
        stopDelayMs={10}
        height={3}
        options={{ showSpinner: false }}
      />

      <Component {...pageProps} />
      <AudioPlayerComponent />
    </Provider>
  );
}

function AudioPlayerComponent() {
  const router = useRouter();
  const isKeyboardOpen = useDetectKeyboardOpen();
  return (
    <div>
      <ToastContainer
        position="top-center"
        autoClose={1000}
        hideProgressBar
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
      />
      <AddToCollectionModel />
      {router.pathname !== "/login" &&
      router.pathname !== "/register" &&
      router.pathname !== "/_error" &&
      router.pathname !== "/" ? (
        <AudioPlayer className={isKeyboardOpen ? "invisible" : "visible"} />
      ) : (
        <div></div>
      )}
      {router.pathname !== "/login" &&
        router.pathname !== "/register" &&
        router.pathname !== "/_error" &&
        router.pathname !== "/playing" &&
        router.pathname !== "/" && (
          <div
            className={`bg-[#121212] hidden mobile:block tablet:block 
      fixed bottom-0 left-0 right-0 w-full pt-2 pb-1 z-20 ${
        isKeyboardOpen ? "invisible" : "visible"
      }`}
          >
            <div className="flex flex-row justify-center ">
              <SidebarItem name="home" label="Home" />
              <SidebarItem name="search" label="Search" />
              <SidebarItem name="library" label="Library" />
            </div>
          </div>
        )}
    </div>
  );
}

export default MyApp;
