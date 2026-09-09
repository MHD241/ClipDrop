# ClipDrop v4
Working frontend + Docker/FFmpeg backend for authorized direct media URLs.

Deploy the repository as a Docker Web Service on Render. The homepage is served by the same service, so no separate frontend hosting or CORS configuration is needed.

Social-platform authentication/resolution is intentionally separate. Once an authorized integration supplies a direct media URL, the frontend/backend can process it as MP4 or MP3.
