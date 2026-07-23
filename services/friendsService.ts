import axios from "axios";
import API_URL from "@/configs/apiUrl";

export interface FriendActivity {
  username: string;
  track: {
    id: number;
    track_name: string;
    artist_name: string;
    src: string;
    duration: number;
    cover_image: { url: string; color: string } | null;
    listening_context?: {
      type: "room";
      room_code: string;
      room_name: string;
      listener_count: number;
    };
  } | null;
  is_playing: boolean;
  is_online: boolean;
  progress_seconds: number;
  updated_at: string | null;
}

export interface FriendRequest {
  id: string;
  username: string;
  created_at: string;
}

export interface UserSearchResult {
  username: string;
  relationship: "none" | "friends" | "incoming" | "outgoing";
}

const auth = (token: string) => ({
  headers: { authorization: `Bearer ${token}` },
});

const getFriends = async (token: string) => {
  const response = await axios.get(`${API_URL}/friends`, auth(token));
  return response.data.data as FriendActivity[];
};

const getRequests = async (token: string) => {
  const response = await axios.get(`${API_URL}/friends/requests`, auth(token));
  return response.data.data as FriendRequest[];
};

const searchUsers = async (query: string, token: string) => {
  const response = await axios.get(`${API_URL}/friends/search`, {
    ...auth(token),
    params: { q: query },
  });
  return response.data.data as UserSearchResult[];
};

const sendRequest = async (username: string, token: string) => {
  const response = await axios.post(
    `${API_URL}/friends/requests`,
    { username },
    auth(token)
  );
  return response.data;
};

const acceptRequest = async (id: string, token: string) => {
  await axios.post(`${API_URL}/friends/requests/${id}/accept`, {}, auth(token));
};

const rejectRequest = async (id: string, token: string) => {
  await axios.delete(`${API_URL}/friends/requests/${id}`, auth(token));
};

const removeFriend = async (username: string, token: string) => {
  await axios.delete(
    `${API_URL}/friends/${encodeURIComponent(username)}`,
    auth(token)
  );
};

const updateActivity = async (
  token: string,
  track: any,
  isPlaying: boolean,
  progressSeconds: number
) => {
  await axios.put(
    `${API_URL}/friends/activity`,
    { track, isPlaying, progressSeconds },
    auth(token)
  );
};

const friendsService = {
  acceptRequest,
  getFriends,
  getRequests,
  rejectRequest,
  removeFriend,
  searchUsers,
  sendRequest,
  updateActivity,
};

export default friendsService;
