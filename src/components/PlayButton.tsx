import { LoaderCircle, Pause, Play } from "lucide-react";

/**
 * The round play/pause button of a time scrubber, a 44 px target. `loading` shows a spinner while the frames it needs arrive;
 * `what` says what it plays; `className` sets its colours (the default suits the site's themes).
 */
export default function PlayButton({
  playing,
  onClick,
  loading = false,
  disabled = false,
  what,
  className = "bg-fg text-bg",
}: {
  playing: boolean;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  what?: string;
  className?: string;
}) {
  const Icon = loading ? LoaderCircle : playing ? Pause : Play;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={`Play${what ? ` ${what}` : ""}`}
      aria-pressed={playing}
      aria-busy={loading}
      className={`grid size-11 shrink-0 place-items-center rounded-full disabled:opacity-40 ${className}`}
    >
      <Icon size={18} aria-hidden className={loading ? "animate-spin" : ""} />
    </button>
  );
}
