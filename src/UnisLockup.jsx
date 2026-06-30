// UnisLockup.jsx
// Horizontal lockup for the sidebar header: themed mark + clean wordmark.
// Drops in where your old chrome "UNIS" wordmark currently sits.
//
//   <UnisLockup height={28} />          // wordmark in --unis-text (white)
//   <UnisLockup height={24} accentI />  // tints the dot of the i with the theme
//
// The mark themes itself; the wordmark stays --unis-text so the color lives in
// one place (the disc), matching how the rest of your UI behaves.

import UnisMark from "./UnisMark";

export default function UnisLockup({
  height = 28,
  accentI = false,       // color the i-dot with --unis-primary for a subtle tie-in
  className = "",
  wordmark = "UNIS",
  ...rest
}) {
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: `${height * 0.34}px`,
        lineHeight: 1,
        userSelect: "none",
      }}
      {...rest}
    >
      <UnisMark size={height} />
      <span
        style={{
          fontFamily: "var(--unis-font-sans, 'Inter', sans-serif)",
          fontWeight: 800,
          fontSize: `${height * 0.92}px`,
          letterSpacing: "-0.045em",
          color: "var(--unis-text, #fff)",
        }}
      >
        {accentI
          ? wordmark.split("").map((ch, i) =>
              ch.toLowerCase() === "i" ? (
                <span key={i} style={{ color: "var(--unis-primary, #1E50EB)" }}>
                  {ch}
                </span>
              ) : (
                ch
              )
            )
          : wordmark}
      </span>
    </span>
  );
}