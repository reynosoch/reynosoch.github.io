# Public speech fixture

`speech.wav`: John F. Kennedy's public inaugural speech sample supplied in OpenAI Whisper's MIT-licensed tests: https://github.com/openai/whisper/blob/main/tests/jfk.flac . Converted to mono PCM16 / 16 kHz using `ffmpeg -i jfk.flac -ar 16000 -ac 1 speech.wav`. No user/corporate recording is included. Whisper's license is preserved here. Used only for testing; excluded from dist by the build's tests filter.
