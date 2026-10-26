// What CricDesk's QR codes hold: ordinary links, so a phone's own camera
// opens them too. A player's code opens their profile (/p/<id>) and carries
// a short-lived signed token (?t=) that lets a scanner add them to a team; a
// team's is its join link (/join/<code>).

export const playerQrUrl = (playerId: number, token: string) => {
  const url = new URL(`/p/${playerId}`, window.location.origin);
  url.searchParams.set("t", token);
  return url.toString();
};

export const teamJoinUrl = (code: string) => new URL(`/join/${code}`, window.location.origin).toString();

export type QrTarget = { kind: "player"; playerId: number; token: string | null } | { kind: "team"; code: string };

// The player or team a scanned code is for; null for any other code. The
// address doesn't matter, so codes made on another one (a test site) still
// work.
export function parseQr(text: string): QrTarget | null {
  let url: URL;
  try {
    url = new URL(text.trim());
  } catch {
    return null;
  }
  const path = url.pathname;
  const player = /^\/p\/(\d+)\/?$/.exec(path);
  if (player) return { kind: "player", playerId: Number(player[1]), token: url.searchParams.get("t") };
  const team = /^\/join\/([A-Za-z0-9]{4,20})\/?$/.exec(path);
  if (team) return { kind: "team", code: team[1].toUpperCase() };
  return null;
}
