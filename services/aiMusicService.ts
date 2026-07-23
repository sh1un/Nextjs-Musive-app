import axios from "axios";
import API_URL from "@/configs/apiUrl";

export interface GenerateMusicInput {
  prompt: string;
  duration: number;
  instrumental: boolean;
}

const generate = async (input: GenerateMusicInput, token: string) => {
  try {
    const response = await axios.post(
      `${API_URL}/ai-music/generate`,
      input,
      {
        headers: {
          authorization: `Bearer ${token}`,
        },
        responseType: "blob",
        timeout: 10 * 60 * 1000,
      }
    );

    return {
      audioUrl: URL.createObjectURL(response.data),
      songId: response.headers["x-song-id"] || `${Date.now()}`,
    };
  } catch (error: any) {
    if (error.response?.data instanceof Blob) {
      const body = await error.response.data.text();
      try {
        const parsed = JSON.parse(body);
        throw new Error(parsed.error || "Music generation failed");
      } catch (parseError: any) {
        if (parseError.message !== "Unexpected end of JSON input") {
          throw parseError;
        }
      }
    }
    throw new Error(
      error.response?.data?.error || error.message || "Music generation failed"
    );
  }
};

const aiMusicService = { generate };

export default aiMusicService;
