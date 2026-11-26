"""Generate the OminiX website voice samples — one set per page language (en, zh) — with OminiX-API (Qwen3-TTS), and keep
only takes that (1) say the script correctly (checked by Qwen3-ASR), (2) are spoken
at a normal conversational rate, and (3) have no long pauses inside a sentence.

Usage:
  1. Start a TTS-only OminiX-API on port 8093, e.g.
     PORT=8093 QWEN3_TTS_MODEL_DIR=~/.OminiX/models/qwen3-tts-mlx/Qwen3-TTS-12Hz-1.7B-CustomVoice-8bit ominix-api
     (Qwen3-ASR-1.7B must also be under ~/.OminiX/models for verification)
  2. python3 -I make_voice_samples.py <takes_dir> <out_dir>
     -> <out_dir>/raw/<id>.wav (kept takes) and <takes_dir>/results.json
  3. Level + encode into assets/audio/<locale>/ (DESIGN.md §3.3).

Pace levers, in order of preference: a style prompt (`instruct`, model-level pacing),
then the API `speed` parameter (>1.0 = WSOLA time-compression, pitch preserved).
Only official Qwen3-TTS preset speakers are used, and there is no voice-cloning demo.
The English page uses only Aiden (native English); Vivian and Serena are Chinese-native
presets and sound accented in English. The Chinese page uses one clip each from Vivian and Dylan. The English line omits "OminiX": English presets
mispronounce it.
"""
import base64, difflib, json, os, re, shutil, sys, time, urllib.request, wave
import numpy as np

API = "http://127.0.0.1:8093"
TAKES, OUT = sys.argv[1], sys.argv[2]
os.makedirs(f"{OUT}/raw", exist_ok=True)
TARGET = {"english": (4.2, 5.2), "chinese": (4.3, 5.3), "japanese": (7.0, 8.2), "korean": (5.3, 6.5)}  # syllables/s
MAX_PAUSE = 0.7  # breaths between sentences are fine; the long gaps (up to 1.1 s) were the problem
PACE_EN = "Speak at a lively, natural conversational pace, a little faster than usual, without long pauses."
PACE_ZH = "用自然流畅的语气说话，语速稍快，句子之间不要停顿太久。"


def post_json(path, payload):
    req = urllib.request.Request(API + path, data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"})
    return urllib.request.urlopen(req, timeout=300).read()



def syllables(text, lang):
    brand = len(re.findall(r"OminiX", text))
    if lang == "chinese": return len(re.findall(r"[一-鿿]", text)) + 3 * brand
    if lang == "korean": return len(re.findall(r"[가-힣]", text)) + 3 * brand
    if lang == "japanese": return len(re.findall(r"[぀-ヿ]", text)) + 2 * len(re.findall(r"[一-鿿]", text)) + 4 * brand
    n = 0
    for w in re.findall(r"[A-Za-z']+", text):
        w = w.lower(); c = len(re.findall(r"[aeiouy]+", w))
        if w.endswith("e") and c > 1 and not w.endswith("le"): c -= 1
        n += max(1, c)
    return n


def pace(path, text, lang):
    with wave.open(path) as w:
        sr = w.getframerate(); x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    hop = int(sr * 0.01); n = len(x) // hop
    e = np.sqrt(np.mean(x[: n * hop].reshape(n, hop) ** 2, axis=1))
    voiced = e > max(0.012, 0.06 * e.max()); idx = np.where(voiced)[0]
    first, last = idx[0], idx[-1]
    pauses, run = [], 0
    for v in voiced[first:last + 1]:
        if not v: run += 1
        else:
            if run >= 15: pauses.append(run * 0.01)
            run = 0
    span = (last - first + 1) * 0.01
    return {"rate": round(syllables(text, lang) / span, 2), "max_pause": round(max(pauses, default=0.0), 2),
            "speech_s": round(span, 2), "duration": round(len(x) / sr, 2)}


def norm(s):
    s = re.sub(r"オミニ\S{0,5}?(?=が)|오미\S{0,3}?(?=가)|ominix|omni\s*\w?x?", "", s, flags=re.I).lower()
    return re.sub(r"[\W_]+", "", s)


def asr(wav_bytes):
    return json.loads(post_json("/v1/audio/asr/qwen3", {"file": base64.b64encode(wav_bytes).decode()}))["text"]


def make(spec, strategies, synth):
    lo, hi = TARGET[spec["language"]]; mid = (lo + hi) / 2
    best, k = None, 0
    for instruct, speed, tries in strategies:
        for _ in range(tries):
            t = time.time(); wav = synth(instruct, speed); gen = time.time() - t
            path = f"{TAKES}/{spec['id']}-take{k}.wav"; open(path, "wb").write(wav); k += 1
            p = pace(path, spec["text"], spec["language"])
            text = asr(wav); score = difflib.SequenceMatcher(None, norm(spec["text"]), norm(text)).ratio()
            ok = score >= 0.97 and lo <= p["rate"] <= hi and p["max_pause"] <= MAX_PAUSE
            rank = score * 2 - abs(p["rate"] - mid) / mid - max(0, p["max_pause"] - MAX_PAUSE)
            print(f"  {spec['id']} take{k-1} speed={speed} instruct={'y' if instruct else 'n'}: rate={p['rate']} ({lo}-{hi}) "
                  f"maxpause={p['max_pause']}s asr={score:.3f} dur={p['duration']}s gen={gen:.2f}s {'OK' if ok else ''} | {text}", flush=True)
            cand = {"path": path, "ok": ok, "rank": rank, "instruct": instruct, "speed": speed, "audio_s": p["duration"],
                    "gen_s": round(gen, 2), "rtf": round(p["duration"] / gen, 2), "speaking_rate": p["rate"],
                    "max_pause_s": p["max_pause"], "asr_text": text, "asr_score": round(score, 3)}
            if best is None or (cand["ok"], cand["rank"]) > (best["ok"], best["rank"]): best = cand
            if ok: break
        if best and best["ok"]: break
    shutil.copy(best["path"], f"{OUT}/raw/{spec['id']}.wav")
    print(f"==> {spec['id']}: kept {best['path'].rsplit('/', 1)[1]} ok={best['ok']} rate={best['speaking_rate']} "
          f"speed={best['speed']} instruct={'y' if best['instruct'] else 'n'} asr={best['asr_score']}", flush=True)
    return {**spec, **{k: v for k, v in best.items() if k not in ("path", "rank", "ok")}, "meets_targets": best["ok"]}


def eng_syl(w):
    w = w.lower()
    if w == "ominix": return 3
    c = len(re.findall(r"[aeiouy]+", w))
    if w.endswith("e") and c > 1 and not w.endswith("le"): c -= 1
    return max(1, c)


def syllables(text, lang):  # override: count Latin words inside CJK text too
    latin = sum(eng_syl(w) for w in re.findall(r"[A-Za-z']+", text))
    if lang == "english": return latin
    if lang == "chinese": return len(re.findall(r"[一-鿿]", text)) + latin
    if lang == "korean": return len(re.findall(r"[가-힣]", text)) + latin
    return len(re.findall(r"[぀-ヿ]", text)) + 2 * len(re.findall(r"[一-鿿]", text)) + latin


def norm(s):  # brand + Latin-word spelling is free-form in ASR output
    s = re.sub(r"オミニ\S{0,5}?(?=が)|오미\S{0,3}?(?=가)|ominix|omni\s*\w?x?|欧米尼\S?", "", s, flags=re.I).lower()
    s = s.replace("派森", "python").replace("拉斯特", "rust")
    return re.sub(r"[\W_]+", "", s)



EXC_EN = "Speak in an excited, energetic tone, full of enthusiasm, at a quick, lively pace."
# (locale, spec, pace prompt). Final picks: see voice-samples.json (speed used per clip is recorded there).
SPECS = [
    ("en", {"id": "aiden-excited", "voice": "aiden", "language": "english", "text": "We just shipped it, and the whole thing runs offline!"}, EXC_EN),
    ("zh", {"id": "vivian-zh", "voice": "vivian", "language": "chinese", "text": "你的录音、提示词和声音，都只留在这台设备上。"}, PACE_ZH),
    ("zh", {"id": "dylan-zh", "voice": "dylan", "language": "chinese", "text": "不用 Python，也不用云端，一个 Rust 程序就能跑起来。"}, PACE_ZH),
]
STRAT = lambda prompt: [(prompt, 1.0, 2), (prompt, 1.15, 2), (prompt, 1.25, 2), (prompt, 1.3, 1), (prompt, 1.4, 1)]
py = lambda d: {k: (v.item() if hasattr(v, "item") else v) for k, v in d.items()}

if __name__ == "__main__":
    post_json("/v1/models/load", {"model": "local/qwen3-asr-1.7b", "model_type": "asr"})
    post_json("/v1/audio/speech", {"input": "Warming up.", "voice": "aiden", "language": "english", "response_format": "wav"})
    results = []
    for locale, spec, prompt in SPECS:
        def synth(instruct, speed, spec=spec):
            p = {"input": spec["text"], "voice": spec["voice"], "language": spec["language"], "response_format": "wav", "speed": speed}
            if instruct: p["instruct"] = instruct
            return post_json("/v1/audio/speech", p)
        results.append({**py(make(spec, STRAT(prompt), synth)), "locale": locale})
    json.dump(results, open(f"{TAKES}/results.json", "w"), ensure_ascii=False, indent=2)
    print("DONE", flush=True)
