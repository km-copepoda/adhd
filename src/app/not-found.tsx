import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 text-center bg-quest-bg text-quest-text">
      <p className="text-5xl mb-4" aria-hidden>🗺️</p>
      <h1 className="font-serif text-quest-gold text-3xl tracking-wider mb-2">404</h1>
      <p className="text-quest-text text-base mb-1">ページが見つかりませんでした</p>
      <p className="text-quest-muted text-sm mb-8">URLが違うか、ページが移動した可能性があります。</p>
      <Link href="/" className="btn-gold inline-flex items-center justify-center min-h-11">
        トップへもどる
      </Link>
    </div>
  );
}
