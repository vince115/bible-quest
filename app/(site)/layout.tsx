import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";

/** Every page that is not a battle: the site's top bar and left menu around the page. */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
