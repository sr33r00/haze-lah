import type { Webcam } from "../types";
import { getJson } from "../util";

// Windy webcams (free tier). Its terms: use the image URLs exactly as given (the browser loads them from Windy),
// link each image to its Windy page, show the credit, use the data as delivered, never stretch images, keep the key secret, and don't call
// the API intensively. Free image URLs expire after 10 minutes, so the list is fetched at most every 5 minutes.

const AROUND_SG = "1.35,103.82,60"; // lat, lon, km
export const WEBCAM_TTL = 300;

type Resp = {
  webcams: {
    webcamId: number;
    title: string;
    status: string;
    lastUpdatedOn: string;
    images?: { current: { preview: string }; sizes: { preview: { width: number; height: number } } };
    location?: { latitude: number; longitude: number };
    urls?: { detail: string };
  }[];
};

/** Active webcams around Singapore; empty without a key. */
export async function fetchWebcams(): Promise<Webcam[]> {
  const key = process.env.WINDY_WEBCAMS_KEY;
  if (!key) return [];
  const j = await getJson<Resp>(`https://api.windy.com/webcams/api/v3/webcams?nearby=${AROUND_SG}&include=images,location,urls&limit=20`, {
    headers: { "x-windy-api-key": key },
    revalidate: WEBCAM_TTL,
  });
  return j.webcams
    .filter((w) => w.status === "active" && w.images && w.location && w.urls)
    .map((w) => ({
      id: String(w.webcamId),
      title: w.title, // "as is", per the terms
      lat: w.location!.latitude,
      lon: w.location!.longitude,
      image: w.images!.current.preview,
      width: w.images!.sizes.preview.width,
      height: w.images!.sizes.preview.height,
      page: w.urls!.detail,
      time: w.lastUpdatedOn,
    }));
}
