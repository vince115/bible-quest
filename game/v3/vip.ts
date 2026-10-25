/**
 * Free pick (every card in the game, owned or not, one of each) is for VIPs and developers. Until there are accounts it is
 * on in development builds, and on a deploy that sets NEXT_PUBLIC_FREE_PICK=1.
 */
export const FREE_PICK_ENABLED = process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_FREE_PICK === "1";
