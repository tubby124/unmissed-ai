from supertonic import TTS
import time

GREETING = (
    "Hi, you've reached Aisha at Hasan Sharif Real Estate. "
    "Sorry I missed your call. Please leave your name, phone number, "
    "and a brief message, and we'll get right back to you. Thanks for calling."
)

VOICES = ["F2", "F3"]

print(f"Loading Supertonic TTS (downloads model on first run)...")
t0 = time.time()
tts = TTS(auto_download=True)
print(f"Loaded in {time.time()-t0:.1f}s\n")

for v in VOICES:
    style = tts.get_voice_style(voice_name=v)
    t0 = time.time()
    wav, duration = tts.synthesize(
        text=GREETING,
        voice_style=style,
        total_steps=10,
        speed=1.0,
        lang="en",
        verbose=False,
    )
    gen_time = time.time() - t0
    out = f"aisha-greeting-{v}.wav"
    tts.save_audio(wav, out)
    import os
    sz = os.path.getsize(out) / 1024
    print(f"{v}: generated in {gen_time:.2f}s -> {out} ({sz:.0f} KB)")
