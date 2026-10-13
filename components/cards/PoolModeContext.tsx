"use client";

import { createContext } from "react";
import type { PoolMode } from "@/game/v2/types";

/**
 * Which energy rules the cards on screen are being played under. Card faces read it to show what matters there:
 * MP in the magic version, the energy cap in the tabletop version. Outside a battle (the card viewer) it is the magic version.
 */
export const PoolModeContext = createContext<PoolMode>("personal");
