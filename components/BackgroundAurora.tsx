/**
 * Linear/Stripe-style background aurora.
 *
 * Three large blurred radial gradients drift slowly, blended on top of pure
 * black with a subtle grid overlay. Pointer-events disabled so it never
 * intercepts clicks. Pure CSS animation, no JS.
 *
 * Performance: each layer is a single fixed-position div with transform-only
 * animation. Stays on the compositor — no layout/paint per frame.
 */

export function BackgroundAurora() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-black"
    >
      {/* Amber */}
      <div
        className="aurora-a absolute -top-40 -left-32 h-[42rem] w-[42rem] rounded-full opacity-30 blur-[120px]"
        style={{
          background:
            "radial-gradient(circle at center, rgba(251, 191, 36, 0.55), transparent 60%)",
        }}
      />
      {/* Emerald */}
      <div
        className="aurora-b absolute top-1/3 -right-32 h-[40rem] w-[40rem] rounded-full opacity-25 blur-[140px]"
        style={{
          background:
            "radial-gradient(circle at center, rgba(16, 185, 129, 0.5), transparent 60%)",
        }}
      />
      {/* Violet */}
      <div
        className="aurora-c absolute bottom-0 left-1/3 h-[36rem] w-[36rem] rounded-full opacity-20 blur-[140px]"
        style={{
          background:
            "radial-gradient(circle at center, rgba(167, 139, 250, 0.5), transparent 60%)",
        }}
      />
      {/* Grid overlay — fades out at the edges via mask */}
      <div className="grid-overlay absolute inset-0" />
    </div>
  );
}
