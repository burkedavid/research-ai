import { ResearchLoader } from "@/components/research-loader";

/** Shown in the content area during any (app) route transition that suspends. */
export default function Loading() {
  return <ResearchLoader fullScreen />;
}
