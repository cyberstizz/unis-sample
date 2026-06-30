// UnisMark.jsx
// The Unis brand mark (Vote-alizer). The disc reads `--unis-primary`, so it
// re-colors itself automatically under every theme — no per-theme files.
// The equalizer bars stay white in all themes (the approved look).
//
// Usage:
//   <UnisMark size={32} />                      // themes itself via --unis-primary
//   <UnisMark size={48} color="#16C172" />      // force a specific color
//   <UnisMark size={28} bars="var(--unis-bg)" />// e.g. knockout bars on a tile
//
// ★ Lives anywhere inside #root, where your [data-theme] sets --unis-primary.

export default function UnisMark({
  size = 32,
  color = "var(--unis-primary, #1E50EB)", // disc color; defaults to active theme
  bars = "#FFFFFF",                        // bar color; white in every theme
  title = "Unis",
  className = "",
  ...rest
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 128 128"
      role="img"
      aria-label={title}
      className={className}
      {...rest}
    >
      <path
        d="M8,64 a56,56 0 1 0 112,0 a56,56 0 1 0 -112,0 Z"
        fill={color}
      />
      <path
        d="M34,44 h0 a6,6 0 0 1 6,6 v28 a6,6 0 0 1 -6,6 h0 a6,6 0 0 1 -6,-6 v-28 a6,6 0 0 1 6,-6 Z M54,32 h0 a6,6 0 0 1 6,6 v52 a6,6 0 0 1 -6,6 h0 a6,6 0 0 1 -6,-6 v-52 a6,6 0 0 1 6,-6 Z M74,40 h0 a6,6 0 0 1 6,6 v36 a6,6 0 0 1 -6,6 h0 a6,6 0 0 1 -6,-6 v-36 a6,6 0 0 1 6,-6 Z M94,28 h0 a6,6 0 0 1 6,6 v60 a6,6 0 0 1 -6,6 h0 a6,6 0 0 1 -6,-6 v-60 a6,6 0 0 1 6,-6 Z"
        fill={bars}
      />
    </svg>
  );
}