"""Muxes video + soundtrack into the final MP4 and verifies duration, size and frame rate."""
import imageio_ffmpeg, subprocess, re
FF = imageio_ffmpeg.get_ffmpeg_exe()
OUT = 'dist/Washing-Basket-Brand-Film-60s.mp4'
subprocess.run([FF, '-y', '-i', 'dist/video-only.mp4', '-i', 'work/soundtrack.wav', '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-t', '60', '-movflags', '+faststart', OUT], check=True, capture_output=True)
info = subprocess.run([FF, '-i', OUT], capture_output=True, text=True).stderr
print(re.findall(r'Duration: [^,]+', info)[0])
print([l.strip() for l in info.splitlines() if 'Stream #' in l])
