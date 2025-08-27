import React, { useRef, useState, useEffect } from "react";

const Player = () => {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  // Toggle play/pause
  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  // Update progress bar
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateProgress = () => {
      setProgress((audio.currentTime / audio.duration) * 100 || 0);
    };

    audio.addEventListener("timeupdate", updateProgress);
    return () => audio.removeEventListener("timeupdate", updateProgress);
  }, []);

  return (
    <div className="player">
      <audio ref={audioRef} src="/song.mp3"></audio>

      <div className="controls">
        <button onClick={togglePlay}>{isPlaying ? "⏸" : "▶️"}</button>
        <div className="progress-bar">
          <div
            className="progress"
            style={{ width: `${progress}%`, height: "4px", background: "green" }}
          />
        </div>
      </div>
    </div>
  );
};

export default Player;
