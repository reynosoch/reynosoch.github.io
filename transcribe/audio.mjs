export const SAMPLE_RATE = 16000;

export function stats(samples) {
  let energy = 0, peak = 0;
  for (const value of samples) { energy += value * value; peak = Math.max(peak, Math.abs(value)); }
  const rms = Math.sqrt(energy / Math.max(1, samples.length));
  return { rms, peak, db: rms > 0 ? 20 * Math.log10(rms) : -Infinity };
}

// Detect anti-phase stereo before averaging, which otherwise cancels the voice.
export function mixChannels(channels, mode = 'mix') {
  if (!channels.length || !channels[0].length) throw new Error('El archivo no contiene muestras de audio.');
  if (mode === 'left' || channels.length === 1) return channels[0].slice();
  if (mode === 'right') return (channels[1] || channels[0]).slice();
  let leftEnergy = 0, rightEnergy = 0, cross = 0;
  for (let i = 0; i < channels[0].length; i++) {
    const a = channels[0][i], b = channels[1][i];
    leftEnergy += a * a; rightEnergy += b * b; cross += a * b;
  }
  const correlation = cross / (Math.sqrt(leftEnergy * rightEnergy) || 1);
  if (correlation < -0.5) return channels[leftEnergy >= rightEnergy ? 0 : 1].slice();
  const result = new Float32Array(channels[0].length);
  for (const channel of channels) for (let i = 0; i < result.length; i++) result[i] += channel[i] / channels.length;
  return result;
}

export function prepareSamples(input, { enhance = true, highpass = true, sampleRate = SAMPLE_RATE } = {}) {
  const output = input.slice();
  if (highpass) {
    const alpha = sampleRate / (sampleRate + 2 * Math.PI * 65);
    let previousInput = 0, previousOutput = 0;
    for (let i = 0; i < output.length; i++) {
      const current = output[i];
      previousOutput = alpha * (previousOutput + current - previousInput);
      previousInput = current; output[i] = previousOutput;
    }
  }
  if (!enhance) return output;
  // No silence gate, trimming or time compression. Smooth gain, capped at +30 dB.
  const window = Math.max(1, Math.floor(sampleRate * 0.5));
  const gains = [];
  for (let start = 0; start < output.length; start += window) {
    const { rms, peak } = stats(output.subarray(start, start + window));
    gains.push(peak < 1e-8 ? 1 : Math.min(31.62, 0.12 / Math.max(rms, 1e-8), 0.95 / peak));
  }
  for (let i = 0; i < output.length; i++) {
    const position = i / window - 0.5;
    const index = Math.floor(position), fraction = position - index;
    const before = gains[Math.max(0, index)], after = gains[Math.min(gains.length - 1, Math.max(0, index + 1))];
    output[i] = Math.max(-0.98, Math.min(0.98, output[i] * (before + (after - before) * fraction)));
  }
  return output;
}

export function timestamp(seconds = 0, srt = false) {
  const total = Math.max(0, Math.round((Number(seconds) || 0) * 1000));
  const h = Math.floor(total / 3600000), m = Math.floor(total / 60000) % 60, s = Math.floor(total / 1000) % 60;
  return [h, m, s].map(n => String(n).padStart(2, '0')).join(':') + (srt ? ',' : '.') + String(total % 1000).padStart(3, '0');
}

export function toSrt(segments, duration) {
  return segments.map((segment, index) => `${index + 1}\n${timestamp(segment.timestamp[0], true)} --> ${timestamp(segment.timestamp[1] ?? duration, true)}\n${segment.text.trim()}\n`).join('\n');
}
