import express from "express";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json({ limit: "8kb" }));

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

function isTikTokUrl(value) {
  try {
    const u = new URL(value);
    const h = u.hostname.toLowerCase();
    return u.protocol === "https:" &&
      (h === "tiktok.com" || h.endsWith(".tiktok.com"));
  } catch {
    return false;
  }
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(command, args, { stdio: ["ignore", "ignore", "pipe"] });
    let error = "";
    p.stderr.on("data", d => error += d.toString());
    p.on("error", reject);
    p.on("close", code => code === 0 ? resolve() :
      reject(new Error(error || `${command} exited with ${code}`)));
  });
}

app.get("/", (_req, res) => {
  res.json({
    name: "ClipDrop",
    status: "online",
    version: "2.0.0",
    note: "Processes caller-supplied media URLs only when the caller owns or has permission to use the content."
  });
});

app.get("/health", (_req, res) => res.json({ ok: true }));

/*
  This endpoint intentionally accepts a DIRECT media URL supplied by an
  authorized upstream source. It does not scrape TikTok pages, defeat
  disabled-download settings, remove watermarks, or bypass access controls.
*/
app.post("/convert-direct", async (req, res) => {
  const { mediaUrl, format } = req.body ?? {};

  if (typeof mediaUrl !== "string" || !/^https:\/\//i.test(mediaUrl))
    return res.status(400).json({ error: "A valid HTTPS direct media URL is required." });

  if (!["mp4", "mp3"].includes(format))
    return res.status(400).json({ error: "format must be mp4 or mp3." });

  const work = await mkdtemp(path.join(tmpdir(), "clipdrop-"));
  const input = path.join(work, "input.mp4");
  const output = path.join(work, format === "mp3" ? "output.mp3" : "output.mp4");

  try {
    // ffmpeg follows ordinary HTTP redirects. It does not provide any
    // authentication or bypass mechanism.
    if (format === "mp3") {
      await run("ffmpeg", [
        "-y", "-i", mediaUrl, "-vn",
        "-c:a", "libmp3lame", "-q:a", "2", output
      ]);
    } else {
      await run("ffmpeg", [
        "-y", "-i", mediaUrl, "-c", "copy", output
      ]);
    }

    res.setHeader("Content-Type", format === "mp3" ? "audio/mpeg" : "video/mp4");
    res.setHeader("Content-Disposition", `attachment; filename="clipdrop.${format}"`);

    const stream = createReadStream(output);
    stream.on("close", () => rm(work, { recursive: true, force: true }));
    stream.on("error", async () => {
      await rm(work, { recursive: true, force: true });
      if (!res.headersSent) res.status(500).end();
    });
    stream.pipe(res);
  } catch (err) {
    await rm(work, { recursive: true, force: true });
    const message = String(err?.message || err);
    if (message.includes("ENOENT")) {
      return res.status(503).json({
        error: "FFmpeg is not installed on this Render runtime.",
        next: "Use the Docker deployment included with this package."
      });
    }
    res.status(502).json({ error: "Media conversion failed." });
  }
});

// Existing Supabase gateway can call this route. It validates the request,
// but page-to-media resolution still needs an authorized source/API.
app.post("/process", (req, res) => {
  const { url, format } = req.body ?? {};
  if (!isTikTokUrl(url))
    return res.status(400).json({ error: "Only HTTPS TikTok links are accepted." });
  if (!["mp4", "mp3"].includes(format))
    return res.status(400).json({ error: "format must be mp4 or mp3." });

  res.status(501).json({
    ok: false,
    status: "authorized_media_source_required",
    message: "The infrastructure is working. Connect an authorized media source that returns a direct media URL, then send that URL to /convert-direct."
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`ClipDrop v2 listening on ${PORT}`);
});
