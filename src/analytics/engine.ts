export type Votes = Record<string, number>;
export type Mechanism = "add" | "abstain" | "switch";

// Exact integer comparisons for quota/remainder and highest-average rankings.
// BigInt cross products avoid rounding a close allocation boundary.
export function allocate(votes: Votes, seats = 400): Votes {
  if (
    !Number.isSafeInteger(seats) ||
    seats < 1 ||
    !Object.keys(votes).length ||
    Object.values(votes).some((v) => !Number.isSafeInteger(v) || v < 0)
  )
    throw new Error("Invalid vote counts");
  const total = Object.values(votes).reduce((a, b) => a + b, 0);
  if (!Number.isSafeInteger(total) || !total)
    throw new Error("At least one valid vote is required");
  const quota = Math.floor(total / (seats + 1)) + 1;
  const result = Object.fromEntries(
    Object.entries(votes).map(([p, n]) => [p, Math.floor(n / quota)]),
  );
  let remaining = seats - Object.values(result).reduce((a, b) => a + b, 0);
  const ranked = Object.keys(votes).sort(
    (a, b) => (votes[b] % quota) - (votes[a] % quota),
  );
  const n = Math.min(5, remaining, ranked.length);
  if (
    n &&
    n < ranked.length &&
    votes[ranked[n - 1]] % quota === votes[ranked[n]] % quota
  )
    throw new Error(
      "An exact remainder tie requires a tie decision. No unique result is shown.",
    );
  ranked.slice(0, n).forEach((p) => result[p]++);
  remaining -= n;
  while (remaining > 0) {
    let best = "";
    let tied = false;
    for (const p of ranked) {
      if (!result[p]) continue;
      if (!best) {
        best = p;
        continue;
      }
      const delta =
        BigInt(votes[p]) * BigInt(result[best]) -
        BigInt(votes[best]) * BigInt(result[p]);
      if (delta > 0n) {
        best = p;
        tied = false;
      } else if (delta === 0n) tied = true;
    }
    if (tied)
      throw new Error("An exact highest-average tie requires a tie decision.");
    result[best]++;
    remaining--;
  }
  return result;
}

export function perturb(
  votes: Votes,
  party: string,
  k: number,
  mechanism: Mechanism,
  destination?: string,
): Votes {
  if (!Number.isSafeInteger(k) || k < 0 || !(party in votes))
    throw new Error("Enter a nonnegative whole number of votes");
  const next = { ...votes };
  if (mechanism === "add") next[party] += k;
  else if (mechanism === "abstain" || mechanism === "switch") {
    if (k > votes[party])
      throw new Error("This party does not have that many votes");
    next[party] -= k;
    if (mechanism === "switch") {
      if (!destination || !(destination in votes) || destination === party)
        throw new Error("Choose a different destination party");
      next[destination] += k;
    }
  } else throw new Error("Unknown mechanism");
  return next;
}
