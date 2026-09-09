# ClipDrop Backend v2

Backend for ClipDrop.

## Endpoints
- `GET /health` — health check
- `POST /process` — validates a TikTok page request; requires an authorized media-source integration before it can resolve media
- `POST /convert-direct` — converts a caller-supplied HTTPS direct media URL to MP4 or MP3 using FFmpeg

This project intentionally does not scrape TikTok pages, bypass disabled-download settings, remove watermarks, or defeat access controls.

## Render
For FFmpeg support, deploy this repository as Docker rather than the plain Node runtime:
- Runtime: Docker
- Dockerfile: `./Dockerfile`
- Free instance where available

The existing Node deployment can still be used to test `/health`.
