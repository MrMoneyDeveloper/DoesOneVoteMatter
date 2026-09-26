// A deliberately simplified teaching model, separate from the IEC allocator.
// 100 ballots, 10 seats, proportional shares and largest remainders.
export function classroom(switches: number) {
  if (!Number.isInteger(switches) || switches < 0 || switches > 60)
    throw new Error("Choose between 0 and 60 whole ballots");
  const a = 60 - switches,
    b = 40 + switches;
  let seatsA = Math.floor(a / 10),
    seatsB = Math.floor(b / 10);
  const tie = seatsA + seatsB < 10 && a % 10 === b % 10;
  if (!tie && seatsA + seatsB < 10) {
    if (a % 10 > b % 10) seatsA++;
    else seatsB++;
  }
  return {
    a,
    b,
    seatsA: tie ? null : seatsA,
    seatsB: tie ? null : seatsB,
    majority: tie
      ? "Unresolved"
      : seatsA >= 6
        ? "Group A"
        : seatsB >= 6
          ? "Group B"
          : "Neither group",
  };
}
