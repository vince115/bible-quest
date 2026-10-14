import type { ReactNode } from "react";
import { AudioToggle } from "@/components/AudioToggle";
import { LanguageToggle } from "@/components/LanguageToggle";

/** Battle pages are full-screen: no site navigation, only the small sound and language switches in the corner. */
export default function ImmersiveLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AudioToggle />
      <LanguageToggle />
      {children}
    </>
  );
}
