import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { colors, fonts } from "../theme";

const ROLES = [
  { name: "Sales Outreach", icon: "📞" },
  { name: "Appointments", icon: "📅" },
  { name: "Support", icon: "🎧" },
  { name: "Collections", icon: "🏛️" },
  { name: "Onboarding", icon: "👋" },
  { name: "Retention", icon: "🔄" },
];

// Voice waveform for the right side
const VoiceWaveform: React.FC<{ frame: number; fps: number }> = ({
  frame,
  fps,
}) => {
  const bars = 24;
  const timeSeconds = frame / fps;

  return (
    <svg width={200} height={120} style={{ overflow: "visible" }}>
      {Array.from({ length: bars }).map((_, i) => {
        const phase = (i / bars) * Math.PI * 2;
        const height =
          8 +
          Math.sin(phase + timeSeconds * 4) * 20 +
          Math.sin(phase * 2.1 + timeSeconds * 6) * 10 +
          Math.cos(phase * 0.8 + timeSeconds * 3) * 8;

        const barOpacity = interpolate(frame, [15, 30], [0, 0.6], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        return (
          <rect
            key={i}
            x={i * 8 + 2}
            y={60 - Math.abs(height) / 2}
            width={5}
            height={Math.max(3, Math.abs(height))}
            rx={2.5}
            fill={colors.amber}
            opacity={barOpacity}
          />
        );
      })}
    </svg>
  );
};

const RoleCard: React.FC<{
  role: (typeof ROLES)[number];
  index: number;
  frame: number;
  fps: number;
}> = ({ role, index, frame, fps }) => {
  const delay = 20 + index * 8;

  const entrance = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 150 },
    delay,
  });

  const scale = interpolate(entrance, [0, 1], [0.7, 1]);
  const opacity = interpolate(entrance, [0, 1], [0, 1]);
  const translateY = interpolate(entrance, [0, 1], [20, 0]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "14px 20px",
        borderRadius: 16,
        border: `1px solid ${colors.cardBorder}`,
        backgroundColor: colors.cardBg,
        opacity,
        transform: `scale(${scale}) translateY(${translateY}px)`,
        minWidth: 180,
      }}
    >
      <span style={{ fontSize: 20 }}>{role.icon}</span>
      <span
        style={{
          fontFamily: fonts.body,
          fontSize: 16,
          fontWeight: 500,
          color: "rgba(255, 255, 255, 0.7)",
        }}
      >
        {role.name}
      </span>
    </div>
  );
};

export const BuildAgentScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Step label entrance
  const labelEntrance = spring({
    frame,
    fps,
    config: { damping: 200 },
    durationInFrames: 15,
  });

  const labelX = interpolate(labelEntrance, [0, 1], [-40, 0]);
  const labelOpacity = interpolate(labelEntrance, [0, 1], [0, 1]);

  // Title entrance
  const titleOpacity = interpolate(frame, [5, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleY = interpolate(frame, [5, 18], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: "0 120px",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 40,
          width: "100%",
          maxWidth: 1200,
        }}
      >
        {/* Step label */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span
            style={{
              fontFamily: fonts.mono,
              fontSize: 18,
              color: "rgba(251, 191, 36, 0.6)",
              opacity: labelOpacity,
              transform: `translateX(${labelX}px)`,
            }}
          >
            01
          </span>
          <span
            style={{
              fontFamily: fonts.headline,
              fontSize: 48,
              fontWeight: 400,
              color: colors.white,
              opacity: titleOpacity,
              transform: `translateY(${titleY}px)`,
              letterSpacing: "-0.01em",
            }}
          >
            Build your agent.
          </span>
        </div>

        {/* Content: role cards + waveform */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 60,
          }}
        >
          {/* Role cards grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 14,
              flex: 1,
            }}
          >
            {ROLES.map((role, i) => (
              <RoleCard
                key={role.name}
                role={role}
                index={i}
                frame={frame}
                fps={fps}
              />
            ))}
          </div>

          {/* Voice waveform */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
              paddingTop: 20,
            }}
          >
            <VoiceWaveform frame={frame} fps={fps} />
            <span
              style={{
                fontFamily: fonts.body,
                fontSize: 14,
                color: colors.whiteMuted,
                opacity: interpolate(frame, [25, 40], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
              }}
            >
              AI Voice Agent
            </span>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
