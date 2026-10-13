"use client";

import { createContext } from "react";
import { MAGIC_VERSION_ENABLED } from "@/game/v2/data";
import type { PoolMode } from "@/game/v2/types";

/**
 * Which energy rules the cards on screen are being played under. Card faces read it to show what matters there:
 * MP in the magic version, the energy cap in the tabletop version. Outside a battle (the card viewer) it is the tabletop version (the magic version is parked, see MAGIC_VERSION_ENABLED).
 */
export const PoolModeContext = createContext<PoolMode>(MAGIC_VERSION_ENABLED ? "personal" : "table");
