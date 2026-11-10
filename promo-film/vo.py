"""Voice-over lines (Microsoft neural TTS via edge-tts). Writes vo/NN.mp3 and prints durations."""
import asyncio, edge_tts, subprocess, imageio_ffmpeg, re, sys
VOICE = sys.argv[1] if len(sys.argv) > 1 else 'en-US-AndrewMultilingualNeural'
LINES = [
    "Your week? Packed!",
    "And the laundry... just keeps piling up.",
    "Not anymore! This... is Washing Basket. Laundry, made effortless.",
    "Sign up in seconds. Just your number!",
    "Everything you need. One dashboard.",
    "Top up two thousand, and get five percent extra. Instantly!",
    "Pick your clothes. Pick a day. Pick a slot. We come to you!",
    "Add a coupon, pay from your wallet, one tap, and done!",
    "Pay, and your QR unlocks. Our partner scans it at pickup.",
    "Then track every step... right to your door!",
    "Washing Basket. Laundry... made effortless.",
]
FF = imageio_ffmpeg.get_ffmpeg_exe()
async def main():
    import os
    for i, line in list(enumerate(LINES))[int(os.environ.get('START', '0')):]:
        await edge_tts.Communicate(line, VOICE, rate='+14%', pitch='+3Hz').save(f'vo/{i:02d}.mp3')
        info = subprocess.run([FF, '-i', f'vo/{i:02d}.mp3'], capture_output=True, text=True).stderr
        subprocess.run([FF, '-v', 'error', '-y', '-i', f'vo/{i:02d}.mp3', '-af', 'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse', '-ar', '48000', '-ac', '1', f'vo/{i:02d}.wav'], check=True)
        print(i, re.findall(r'Duration: ([^,]+)', info)[0], line)
asyncio.run(main())
