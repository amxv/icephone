import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { colors, SCENE_STARTS } from "./theme";

const WAVEFORM_BARS = 48;

const WaveformBar: React.FC<{
  index: number;
  activationProgress: number;
  frame: number;
  fps: number;
}> = ({ index, activationProgress, frame, fps }) => {
  // Each bar has a unique phase offset for organic movement
  const phase = (index / WAVEFORM_BARS) * Math.PI * 2;
  const timeSeconds = frame / fps;

  // Flat state: very subtle, barely visible
  const flatHeight = 2 + Math.sin(phase + timeSeconds * 0.5) * 1;

  // Active state: lively, varying heights
  const activeHeight =
    8 +
    Math.sin(phase + timeSeconds * 3) * 12 +
    Math.sin(phase * 2.3 + timeSeconds * 5) * 6 +
    Math.cos(phase * 0.7 + timeSeconds * 2) * 4;

  const height = interpolate(
    activationProgress,
    [0, 1],
    [flatHeight, Math.max(2, activeHeight)],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Opacity: subtle when flat, brighter when active
  const opacity = interpolate(
    activationProgress,
    [0, 1],
    [0.15, 0.3 + Math.sin(phase + timeSeconds * 4) * 0.15],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <rect
      x={index * (1920 / WAVEFORM_BARS) + 4}
      y={980 - height / 2}
      width={Math.max(1, 1920 / WAVEFORM_BARS - 8)}
      height={Math.max(1, height)}
      rx={2}
      fill={colors.amber}
      opacity={opacity}
    />
  );
};

export const AmbientBackground: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Waveform activation: flat during problem scene, springs to life at solution
  const activationFrame = SCENE_STARTS.solution;
  const activationProgress = interpolate(
    frame,
    [activationFrame, activationFrame + 30],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Glow intensity: subtle during problem, brighter after solution
  const glowOpacity = interpolate(
    activationProgress,
    [0, 1],
    [0.03, 0.06],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Subtle glow pulse
  const timeSeconds = frame / fps;
  const glowPulse = 1 + Math.sin(timeSeconds * 1.5) * 0.15;

  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg }}>
      {/* Top-center amber glow */}
      <div
        style={{
          position: "absolute",
          top: -200,
          left: "50%",
          transform: `translateX(-50%) scale(${glowPulse})`,
          width: 900,
          height: 700,
          borderRadius: "50%",
          background: `radial-gradient(ellipse, rgba(245, 158, 11, ${glowOpacity}) 0%, transparent 70%)`,
        }}
      />

      {/* Bottom-right amber glow */}
      <div
        style={{
          position: "absolute",
          bottom: -150,
          right: -100,
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: `radial-gradient(ellipse, rgba(245, 158, 11, ${glowOpacity * 0.7}) 0%, transparent 70%)`,
        }}
      />

      {/* Waveform visualization */}
      <svg
        width={1920}
        height={1080}
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        {Array.from({ length: WAVEFORM_BARS }).map((_, i) => (
          <WaveformBar
            key={i}
            index={i}
            activationProgress={activationProgress}
            frame={frame}
            fps={fps}
          />
        ))}
      </svg>

      {/* Noise grain overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.03,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
        }}
      />
    </AbsoluteFill>
  );
};
