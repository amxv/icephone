# OpenAI TTS Voice Sample URLs - Research Findings

## Summary

OpenAI hosts official voice preview audio files on their CDN at `https://cdn.openai.com/API/docs/audio/{voice}.wav`. These are WAV files used in the official OpenAI documentation and referenced by multiple projects. **9 out of 13 voices** have hosted samples at this URL pattern. The newer voices (ballad, verse, marin, cedar) do not have samples at this CDN location. For those, OpenAI directs users to [OpenAI.fm](https://openai.fm) to hear them.

---

## Official OpenAI CDN Voice Sample URLs

### Available (HTTP 200 - Confirmed Working)

| Voice | URL | File Size |
|-------|-----|-----------|
| alloy | `https://cdn.openai.com/API/docs/audio/alloy.wav` | ~223 KB |
| ash | `https://cdn.openai.com/API/docs/audio/ash.wav` | ~457 KB |
| coral | `https://cdn.openai.com/API/docs/audio/coral.wav` | ~558 KB |
| echo | `https://cdn.openai.com/API/docs/audio/echo.wav` | ~287 KB |
| fable | `https://cdn.openai.com/API/docs/audio/fable.wav` | ~292 KB |
| nova | `https://cdn.openai.com/API/docs/audio/nova.wav` | ~297 KB |
| onyx | `https://cdn.openai.com/API/docs/audio/onyx.wav` | ~277 KB |
| sage | `https://cdn.openai.com/API/docs/audio/sage.wav` | ~476 KB |
| shimmer | `https://cdn.openai.com/API/docs/audio/shimmer.wav` | ~271 KB |

### Not Available (HTTP 404)

| Voice | URL | Status |
|-------|-----|--------|
| ballad | `https://cdn.openai.com/API/docs/audio/ballad.wav` | 404 Not Found |
| verse | `https://cdn.openai.com/API/docs/audio/verse.wav` | 404 Not Found |
| marin | `https://cdn.openai.com/API/docs/audio/marin.wav` | 404 Not Found |
| cedar | `https://cdn.openai.com/API/docs/audio/cedar.wav` | 404 Not Found |

---

## Source Verification

### 1. OpenAI Official Documentation (Primary Source)

The URL `https://cdn.openai.com/API/docs/audio/alloy.wav` is used directly in OpenAI's official "Audio and Speech" documentation as an example for audio input:

```python
# From OpenAI's official docs: https://platform.openai.com/docs/guides/audio
url = "https://cdn.openai.com/API/docs/audio/alloy.wav"
response = requests.get(url)
```

```javascript
// From OpenAI's official docs
const url = "https://cdn.openai.com/API/docs/audio/alloy.wav";
const audioResponse = await fetch(url);
```

**Source**: [Audio and speech | OpenAI API](https://platform.openai.com/docs/guides/audio) -- used in the "Audio input to model" code example.

### 2. OpenedAI-Speech Project (Confirms Full URL Pattern)

The `test_voices.sh` script in the openedai-speech project iterates over all original voices using the same CDN URL pattern:

```bash
# From: https://github.com/matatonic/openedai-speech/blob/main/test_voices.sh
for voice in alloy echo fable onyx nova shimmer ; do
  curl -s https://cdn.openai.com/API/docs/audio/$voice.wav | mpv --really-quiet -
done
```

**Source**: [openedai-speech/test_voices.sh](https://github.com/matatonic/openedai-speech/blob/main/test_voices.sh)

### 3. OpenAI TTS Documentation (Voice List)

The official TTS documentation lists 13 built-in voices and directs users to [OpenAI.fm](https://openai.fm) for previewing them:

> "The TTS endpoint provides 13 built-in voices to control how speech is rendered from text. Hear and play with these voices in OpenAI.fm, our interactive demo for trying the latest text-to-speech model in the OpenAI API."

The 13 voices are: `alloy`, `ash`, `ballad`, `coral`, `echo`, `fable`, `nova`, `onyx`, `sage`, `shimmer`, `verse`, `marin`, `cedar`

**Source**: [Text to speech | OpenAI API](https://platform.openai.com/docs/guides/text-to-speech)

---

## Voice Descriptions

Based on multiple sources (OpenAI docs, Mastra docs, openai-fm library):

| Voice | Description | Used in openai-fm demos for |
|-------|-------------|----------------------------|
| alloy | Neutral and balanced | (default example in docs) |
| ash | Clear and precise | Dramatic, Sincere, Santa, Robot, Pirate, True Crime, Eternal Optimist, Noir Detective |
| ballad | Melodic and smooth | Medieval Knight, Patient Teacher |
| coral | Warm and friendly | Fitness Instructor, Serene, Sports Coach, Mad Scientist, Professional, Gourmet Chef, Cowboy |
| echo | Resonant and deep | Connoisseur |
| fable | (British-accented) | (original voice, no new demos) |
| nova | (Bright, higher voice) | (original voice, no new demos) |
| onyx | (Deep, lower voice) | (original voice, no new demos) |
| sage | Calm and thoughtful | Calm, Sympathetic, Bedtime Story, Friendly |
| shimmer | Bright and energetic | Old-Timey, Auctioneer |
| verse | Versatile and expressive | Emo Teenager, Smooth Jazz DJ, Chill Surfer, NYC Cabbie, Cheerleader |
| marin | (Newest voice) | N/A |
| cedar | (Newest voice) | N/A |

OpenAI recommends `marin` or `cedar` for best quality, though they lack CDN preview samples.

---

## For Voices Without CDN Samples (ballad, verse, marin, cedar)

### Option 1: OpenAI.fm (Interactive Demo)
- URL: https://openai.fm
- Open source: https://github.com/openai/openai-fm
- Requires API key to generate audio, but you can listen to voice samples directly

### Option 2: Generate via API
Use the OpenAI TTS API to generate your own samples:
```bash
curl https://api.openai.com/v1/audio/speech \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini-tts",
    "input": "Hello, I am the ballad voice from OpenAI text to speech.",
    "voice": "ballad"
  }' \
  --output ballad-sample.mp3
```

### Option 3: OpenAI Platform TTS Playground
- URL: https://platform.openai.com/playground/tts
- Requires OpenAI account login
- Allows previewing all voices directly in browser

---

## Quick Copy-Paste: All Available URLs

```
https://cdn.openai.com/API/docs/audio/alloy.wav
https://cdn.openai.com/API/docs/audio/ash.wav
https://cdn.openai.com/API/docs/audio/coral.wav
https://cdn.openai.com/API/docs/audio/echo.wav
https://cdn.openai.com/API/docs/audio/fable.wav
https://cdn.openai.com/API/docs/audio/nova.wav
https://cdn.openai.com/API/docs/audio/onyx.wav
https://cdn.openai.com/API/docs/audio/sage.wav
https://cdn.openai.com/API/docs/audio/shimmer.wav
```

---

## openai-fm Voice List (from Source Code)

The openai-fm app defines its voice list in `src/lib/library.ts`:

```typescript
export const VOICES = [
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "fable",
  "onyx",
  "nova",
  "sage",
  "shimmer",
  "verse",
];

export const DEFAULT_VOICE = "coral";
```

Note: `marin` and `cedar` were added later (after openai-fm was published) and are not in the openai-fm voice list.

---

## Technical Details

- **File format**: WAV (audio/wav)
- **CORS**: Enabled (`access-control-allow-origin: *`) -- can be fetched from any browser
- **Caching**: `cache-control: public, max-age=31536000` (1 year cache)
- **CDN**: Served via Azure CDN (x-azure-ref headers present)
- **Last modified**: Original 6 voices (alloy, echo, fable, nova, onyx, shimmer) last modified Nov 4, 2023; newer voices (ash, coral, sage) added later

---

## Sources

- [Audio and speech | OpenAI API](https://platform.openai.com/docs/guides/audio) -- Official docs using `cdn.openai.com/API/docs/audio/alloy.wav`
- [Text to speech | OpenAI API](https://platform.openai.com/docs/guides/text-to-speech) -- Voice list and OpenAI.fm reference
- [openai/openai-fm on GitHub](https://github.com/openai/openai-fm) -- Official openai.fm source code with voice definitions
- [openai-fm/src/lib/library.ts](https://github.com/openai/openai-fm/blob/main/src/lib/library.ts) -- Voice list and demo configurations
- [matatonic/openedai-speech test_voices.sh](https://github.com/matatonic/openedai-speech/blob/main/test_voices.sh) -- Confirms CDN URL pattern for all original voices
- [OpenAI API Reference: Audio](https://platform.openai.com/docs/api-reference/audio/) -- Full voice list including marin and cedar
- [There are no examples of new voices in the documentation](https://community.openai.com/t/there-are-no-examples-of-new-voices-in-the-documentation/1064999) -- Community thread confirming missing previews for newer voices
