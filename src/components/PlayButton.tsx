import { LoaderCircle, Pause, Play } from "lucide-react";

/** The round play/pause button of a time scrubber. `loading` shows a spinner while the frames it needs arrive; `what` says what it plays. */
export default function PlayButton({
  playing,
  onClick,
  loading = false,
  disabled = false,
  what,
}: {
  playing: boolean;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  what?: string;
}) {
  const Icon = loading ? LoaderCircle : playing ? Pause : Play;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={`${playing ? "Pause" : "Play"}${what ? ` ${what}` : ""}`}
      aria-busy={loading}
      className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-fg text-bg disabled:opacity-40"
    >
      <Icon size={18} aria-hidden className={loading ? "animate-spin" : ""} />
    </button>
  );
}
