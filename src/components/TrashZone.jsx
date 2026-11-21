export default function TrashZone({ isVisible, onDrop, side = "left", shelfWidth = 1200 }) {
  const playTrashSound = () => {
    // Create a cute "poof" sound using Web Audio API
    const audioContext = new (
      window.AudioContext || window.webkitAudioContext
    )();

    // Create a gentle, cute pop sound
    const duration = 0.4;
    const sampleRate = audioContext.sampleRate;
    const buffer = audioContext.createBuffer(
      1,
      duration * sampleRate,
      sampleRate,
    );
    const data = buffer.getChannelData(0);

    // Generate a cute bubble-pop sound with harmonics
    for (let i = 0; i < buffer.length; i++) {
      const t = i / sampleRate;
      const envelope = Math.exp(-t * 6) * (1 - Math.exp(-t * 30)); // Gentle attack and decay

      // Main tone - soft and round
      const fundamental = Math.sin(2 * Math.PI * 220 * t) * envelope * 0.3;

      // Add some harmonics for warmth
      const harmonic2 = Math.sin(2 * Math.PI * 440 * t) * envelope * 0.15;
      const harmonic3 = Math.sin(2 * Math.PI * 660 * t) * envelope * 0.08;

      // Add a tiny bit of sparkle
      const sparkle = Math.sin(2 * Math.PI * 1320 * t) * envelope * 0.05;

      data[i] = fundamental + harmonic2 + harmonic3 + sparkle;
    }

    const source = audioContext.createBufferSource();
    const gainNode = audioContext.createGain();

    source.buffer = buffer;
    source.connect(gainNode);
    gainNode.connect(audioContext.destination);
    gainNode.gain.value = 0.3; // Gentle volume

    source.start();
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();

    // Play trash sound
    try {
      playTrashSound();
    } catch (error) {
      console.log("Audio not supported or blocked:", error.message);
    }

    onDrop();
  };

  if (!isVisible) return null;

  return (
    <div
      className="fixed z-50"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{
        top: "0",
        bottom: "0",
        height: "100vh",
        width: `calc((100vw - ${shelfWidth}px) / 2)`,
        left: side === "left" ? "0" : "auto",
        right: side === "right" ? "0" : "auto",
      }}
    />
  );
}
