const ctx = () => new (window.AudioContext || window.webkitAudioContext)();

// Very subtle high-pitched crystal ting on hover
export const playHoverSound = () => {
  const ac = ctx();
  const osc = ac.createOscillator();
  const gain = ac.createGain();

  osc.connect(gain);
  gain.connect(ac.destination);

  osc.type = "sine";
  osc.frequency.setValueAtTime(1050, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(820, ac.currentTime + 0.12);

  gain.gain.setValueAtTime(0.06, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.14);

  osc.start(ac.currentTime);
  osc.stop(ac.currentTime + 0.15);
};

// Soft low thud with slight rising pitch — picking up a book
export const playGrabSound = () => {
  const ac = ctx();
  const duration = 0.22;
  const sr = ac.sampleRate;
  const buffer = ac.createBuffer(1, duration * sr, sr);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < buffer.length; i++) {
    const t = i / sr;
    const env = Math.exp(-t * 14) * (1 - Math.exp(-t * 60));
    const freq = 140 + 90 * (t / duration);
    const tone = Math.sin(2 * Math.PI * freq * t) * env * 0.45;
    const noise = (Math.random() * 2 - 1) * Math.exp(-t * 40) * 0.07;
    data[i] = tone + noise;
  }

  const src = ac.createBufferSource();
  const gain = ac.createGain();
  src.buffer = buffer;
  src.connect(gain);
  gain.connect(ac.destination);
  gain.gain.value = 0.28;
  src.start();
};

// Soft descending thud — book settles onto the shelf
export const playDropSound = () => {
  const ac = ctx();
  const duration = 0.28;
  const sr = ac.sampleRate;
  const buffer = ac.createBuffer(1, duration * sr, sr);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < buffer.length; i++) {
    const t = i / sr;
    const env = Math.exp(-t * 10) * (1 - Math.exp(-t * 90));
    const freq = 270 - 110 * (t / duration);
    const tone = Math.sin(2 * Math.PI * freq * t) * env * 0.5;
    const sub = Math.sin(2 * Math.PI * (freq * 0.5) * t) * env * 0.18;
    const noise = (Math.random() * 2 - 1) * Math.exp(-t * 35) * 0.06;
    data[i] = tone + sub + noise;
  }

  const src = ac.createBufferSource();
  const gain = ac.createGain();
  src.buffer = buffer;
  src.connect(gain);
  gain.connect(ac.destination);
  gain.gain.value = 0.32;
  src.start();
};


export const safePlay = (fn) => {
  try {
    fn();
  } catch (_) {}
};
