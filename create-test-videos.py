from pathlib import Path
import subprocess

video_folder = Path(r"C:\ALL-IN-ONE-VIDEOS")

video_folder.mkdir(parents=True, exist_ok=True)

videos = [
    ("upsc-lesson-1.mp4", "Lesson 1 - Introduction to UPSC"),
    ("upsc-lesson-2.mp4", "Lesson 2 - Indian Polity"),
    ("upsc-lesson-3.mp4", "Lesson 3 - Indian History"),
    ("upsc-lesson-4.mp4", "Lesson 4 - Indian Economy"),
    ("upsc-lesson-5.mp4", "Lesson 5 - Current Affairs"),
]

for filename, title in videos:

    output = video_folder / filename

    command = [
        "ffmpeg",
        "-y",
        "-f", "lavfi",
        "-i", "color=c=blue:s=1280x720:d=5",
        "-vf",
        f"drawtext=text='{title}':fontcolor=white:fontsize=48:x=(w-text_w)/2:y=(h-text_h)/2",
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        str(output)
    ]

    try:

        subprocess.run(
            command,
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )

        print("Created:", output)

    except Exception:

        print("FFmpeg is not installed.")
        break

print()
print("Test video creation completed.")