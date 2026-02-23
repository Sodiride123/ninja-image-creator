"""Generate a batch of simple images via the backend API."""
import requests
import time

API = "http://localhost:8000/api"

prompts = [
    {"prompt": "A red apple on a white background", "style": "minimalist"},
    {"prompt": "A golden sunset over the ocean", "style": "photorealistic"},
    {"prompt": "A cute cartoon cat wearing a top hat", "style": "anime"},
    {"prompt": "A mountain landscape with snow peaks", "style": "watercolor"},
    {"prompt": "A cup of coffee with steam rising", "style": "photorealistic"},
    {"prompt": "A colorful hot air balloon in blue sky", "style": "digital-art"},
]

print(f"🎨 Generating {len(prompts)} images...\n")

for i, p in enumerate(prompts, 1):
    print(f"[{i}/{len(prompts)}] Generating: {p['prompt']} ({p['style']})...")
    try:
        resp = requests.post(f"{API}/generate", json={
            "prompt": p["prompt"],
            "style": p["style"],
            "size": "1024x1024",
            "count": 1,
        }, timeout=120)
        if resp.ok:
            data = resp.json()
            print(f"  ✅ Created: {data['id']} ({data['filename']})")
        else:
            print(f"  ❌ Failed: {resp.status_code} - {resp.text[:200]}")
    except Exception as e:
        print(f"  ❌ Error: {e}")

print("\n🎉 Done! Check the gallery.")