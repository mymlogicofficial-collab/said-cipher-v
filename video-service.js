// Video generation — Replicate (Wan-2.1 / CogVideoX / Stable Video)
// Requires REPLICATE_API_KEY in .env

async function generateVideo(prompt, options = {}) {
  const key = process.env.REPLICATE_API_KEY;
  if (!key) {
    throw new Error("Video generation requires a REPLICATE_API_KEY. Add it to your .env file. Get one free at replicate.com");
  }

  const model = options.model || "wavespeedai/wan-2.1-t2v-480p";

  // Start prediction
  const startRes = await fetch("https://api.replicate.com/v1/models/" + model + "/predictions", {
    method: "POST",
    headers: { "Authorization": "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify({ input: { prompt, num_frames: options.frames || 81, guidance_scale: 7.5 } }),
  });

  if (!startRes.ok) throw new Error("Video gen failed to start: " + await startRes.text());
  const prediction = await startRes.json();
  const pollUrl = prediction.urls?.get || "https://api.replicate.com/v1/predictions/" + prediction.id;

  // Poll for completion (max 3 min)
  for (let i = 0; i < 36; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const pollRes = await fetch(pollUrl, { headers: { "Authorization": "Bearer " + key } });
    const status = await pollRes.json();
    if (status.status === "succeeded") {
      const videoUrl = Array.isArray(status.output) ? status.output[0] : status.output;
      return { url: videoUrl, id: prediction.id };
    }
    if (status.status === "failed") throw new Error("Video generation failed: " + (status.error || "unknown error"));
  }
  throw new Error("Video generation timed out. Check replicate.com/predictions for status.");
}

const VIDEO_MODELS = [
  { id: "wavespeedai/wan-2.1-t2v-480p", name: "Wan 2.1 (480p)", desc: "Fast, good quality" },
  { id: "wavespeedai/wan-2.1-t2v-720p", name: "Wan 2.1 (720p)", desc: "HD, slower" },
  { id: "minimax/video-01", name: "Minimax Video", desc: "Cinematic style" },
];

module.exports = { generateVideo, VIDEO_MODELS };
