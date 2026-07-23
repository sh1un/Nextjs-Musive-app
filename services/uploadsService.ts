import axios from "axios";
import API_URL from "@/configs/apiUrl";
import { TrackProps } from "@/interfaces/Track";

export interface UploadInput {
  audio?: File;
  cover?: File;
  title: string;
  duration: number;
  tags: string;
  moods: string;
  color: string;
  youtube?: YouTubeMetadata;
}

export interface YouTubeMetadata {
  videoId: string;
  url: string;
  embedUrl: string;
  title: string;
  author: string;
  authorUrl: string | null;
  thumbnailUrl: string;
}

const uploadTrack = async (
  input: UploadInput,
  token: string,
  onProgress: (progress: number) => void
) => {
  const form = new FormData();
  if (input.audio) form.append("audio", input.audio);
  if (input.cover) form.append("cover", input.cover);
  form.append("title", input.title);
  form.append("duration", String(input.duration));
  form.append("tags", input.tags);
  form.append("moods", input.moods);
  form.append("color", input.color);
  if (input.youtube) {
    form.append("sourceType", "youtube");
    form.append("sourceUrl", input.youtube.url);
    form.append("sourceAuthor", input.youtube.author);
    form.append("externalCoverUrl", input.youtube.thumbnailUrl);
  }

  const response = await axios.post(`${API_URL}/uploads`, form, {
    headers: {
      authorization: `Bearer ${token}`,
      "Content-Type": "multipart/form-data",
    },
    onUploadProgress: (event) => {
      if (event.total) onProgress(Math.round((event.loaded / event.total) * 100));
    },
    timeout: 5 * 60 * 1000,
  });
  return response.data.data as TrackProps;
};

const getMyUploads = async (token: string) => {
  const response = await axios.get(`${API_URL}/uploads`, {
    headers: { authorization: `Bearer ${token}` },
  });
  return response.data.data as TrackProps[];
};

const getYouTubeMetadata = async (url: string, token: string) => {
  const response = await axios.post(
    `${API_URL}/youtube/metadata`,
    { url },
    { headers: { authorization: `Bearer ${token}` } }
  );
  return response.data.data as YouTubeMetadata;
};

const uploadsService = { getMyUploads, getYouTubeMetadata, uploadTrack };

export default uploadsService;
