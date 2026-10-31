import Image from "next/image";
import screenshots from "../../../public/landing/screenshots.json";

export type ScreenshotName = keyof typeof screenshots;

export default function ProductScreenshot({ name, alt, eager = false }: { name: ScreenshotName; alt: string; eager?: boolean }) {
  return <>{(["light", "dark"] as const).map(theme => {
    const desktop = screenshots[name][`${theme}-desktop`];
    const mobile = screenshots[name][`${theme}-mobile`];
    return <picture key={theme} className={`dr-landing-${theme}`}>
      <source media="(max-width: 639px)" srcSet={mobile.src} width={mobile.width} height={mobile.height} />
      <Image src={desktop.src} width={desktop.width} height={desktop.height} alt={alt}
        unoptimized loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "high" : undefined} className="h-auto w-full" />
    </picture>;
  })}</>;
}

export function FullSizeScreenshot({ name }: { name: ScreenshotName }) {
  return <>{(["light", "dark"] as const).map(theme => <span key={theme} className={`dr-landing-${theme}`}>
    <a href={screenshots[name][`${theme}-mobile`].src} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-md text-sm font-semibold text-primary underline-offset-4 hover:underline sm:hidden">Open full-size screenshot<span className="sr-only"> (new tab)</span></a>
    <a href={screenshots[name][`${theme}-desktop`].src} target="_blank" rel="noreferrer" className="hidden min-h-11 items-center rounded-md text-sm font-semibold text-primary underline-offset-4 hover:underline sm:inline-flex">Open full-size screenshot<span className="sr-only"> (new tab)</span></a>
  </span>)}</>;
}
