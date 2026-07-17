/**
 * Sentiment Research official mark (public/sr-logo.webp — the colour mark on
 * white from sentimentresearch.com). Plain <img> on purpose: tiny static
 * asset, no optimizer latency.
 */
export function BrandMark({ size = 40 }: { size?: number; inverted?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/sr-logo.webp"
      alt="Sentiment Research"
      width={size}
      height={size}
      className="shrink-0"
    />
  );
}
