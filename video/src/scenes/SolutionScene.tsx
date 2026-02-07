import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { colors, fonts } from "../theme";
import { Logo } from "../Logo";

export const SolutionScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Logo entrance with spring
  const logoScale = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 150 },
    durationInFrames: 20,
  });

  const logoOpacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Glow behind logo
  const glowScale = spring({
    frame,
    fps,
    config: { damping: 200 },
    durationInFrames: 25,
  });

  const glowOpacity = interpolate(frame, [0, 12], [0, 0.4], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Headline typewriter effect
  const headline = "Your AI workforce for the phones.";
  const typewriterStart = 12;
  const charsPerFrame = headline.length / (fps * 0.8); // type over 0.8 seconds
  const visibleChars = Math.min(
    headline.length,
    Math.max(0, Math.floor((frame - typewriterStart) * charsPerFrame))
  );
  const displayedText = headline.slice(0, visibleChars);

  // Cursor blink
  const cursorVisible =
    visibleChars < headline.length
      ? true
      : Math.floor(frame / 8) % 2 === 0;

  // Headline container opacity
  const headlineOpacity = interpolate(frame, [8, 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 40,
        }}
      >
        {/* Glow behind logo */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: `translate(-50%, -60%) scale(${glowScale})`,
            width: 400,
            height: 300,
            borderRadius: "50%",
            background: `radial-gradient(ellipse, rgba(255, 202, 128, ${glowOpacity}) 0%, transparent 70%)`,
            pointerEvents: "none",
          }}
        />

        {/* Logo */}
        <div
          style={{
            transform: `scale(${logoScale})`,
            opacity: logoOpacity,
          }}
        >
          <Logo width={200} height={115} color={colors.amber} />
        </div>

        {/* Typewriter headline */}
        <div
          style={{
            opacity: headlineOpacity,
            fontFamily: fonts.headline,
            fontSize: 54,
            fontWeight: 400,
            color: colors.white,
            textAlign: "center",
            maxWidth: 800,
            lineHeight: 1.2,
            letterSpacing: "-0.01em",
          }}
        >
          <span>
            {displayedText.includes("for the phones")
              ? (
                <>
                  {displayedText.split("for the phones")[0]}
                  <span style={{ color: "rgba(252, 211, 77, 0.9)" }}>
                    {"for the phones" +
                      (displayedText.endsWith(".")
                        ? "."
                        : displayedText.split("for the phones")[1] || "")}
                  </span>
                </>
              )
              : displayedText}
          </span>
          {cursorVisible && (
            <span
              style={{
                color: colors.amber,
                fontWeight: 300,
                marginLeft: 2,
              }}
            >
              |
            </span>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};
