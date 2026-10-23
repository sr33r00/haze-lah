import CoffeeButton from "./CoffeeButton";

/** A short, honest ask: the site is free and ad-free, and support pays for keeping it online. */
export default function SupportCard({ className = "" }: { className?: string }) {
  return (
    <div className={`mx-4 flex flex-col items-center rounded-3xl bg-surface p-5 text-center ${className}`}>
      <p className="text-[17px] font-bold">Keep Haze Lah running</p>
      {/* Written by hand: update when new supporters agree to be named. */}
      <p className="mt-1 text-[14px] font-semibold leading-snug">Kept running by Tanu, Vincent, Jonathan, Annie, Jessica, S and others.</p>
      <p className="mt-1 text-[14px] leading-snug text-muted">Free, no ads, made by one person. A coffee pays for the servers and the data.</p>
      <CoffeeButton className="mt-4" />
    </div>
  );
}
