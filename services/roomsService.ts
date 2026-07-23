import axios from "axios";
import API_URL from "@/configs/apiUrl";

export interface RoomTrack {
  id: number;
  type?: "audio" | "youtube";
  track_name: string;
  artist_name: string;
  src: string;
  duration: number;
  cover_image: { url: string; color: string } | null;
  video_id?: string;
  source_url?: string;
}

export interface QueueItem {
  id: string;
  added_by: string;
  track: RoomTrack;
  status: "pending" | "playing";
  votes: number;
  voters?: string[];
  has_voted?: boolean;
}

export interface RoomMessage {
  id: string;
  username: string;
  message: string;
  created_at: string;
}

export interface RoomData {
  id: string;
  code: string;
  name: string;
  host_username: string;
  current_track: RoomTrack | null;
  is_playing: boolean;
  position_seconds: number;
  playback_updated_at: string;
  queue: QueueItem[];
  messages: RoomMessage[];
}

const auth = (token: string) => ({
  headers: { authorization: `Bearer ${token}` },
});

const createRoom = async (name: string, token: string) => {
  const response = await axios.post(
    `${API_URL}/rooms`,
    { name },
    auth(token)
  );
  return response.data.data as {
    id: string;
    code: string;
    name: string;
    host_username: string;
  };
};

const joinRoom = async (code: string, token: string) => {
  const response = await axios.post(
    `${API_URL}/rooms/${encodeURIComponent(code)}/join`,
    {},
    auth(token)
  );
  return response.data.code as string;
};

const getRoom = async (code: string, token: string) => {
  const response = await axios.get(
    `${API_URL}/rooms/${encodeURIComponent(code)}`,
    auth(token)
  );
  return response.data.data as RoomData;
};

const getTracks = async () => {
  const response = await axios.get(`${API_URL}/songs/tag/lofi?page=0`);
  return response.data.data as RoomTrack[];
};

const roomsService = { createRoom, getRoom, getTracks, joinRoom };

export default roomsService;
