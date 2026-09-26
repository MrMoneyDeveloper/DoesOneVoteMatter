"""National entitlement calculation, not candidate assignment or regional allocation.

Schedule 1A: Droop quota, at most five largest remainders, then the highest
average votes per seat ALREADY awarded (not the D'Hondt s+1 denominator).
Exact ties requiring a decision are reported, never broken alphabetically.
"""
from fractions import Fraction


class AllocationTie(ValueError):
    pass


class UnsupportedAllocation(ValueError):
    """A scenario needs rules that this implementation has not validated."""


def allocate_region(votes: dict[str, int], seats: int) -> dict[str, int]:
    """Droop quota followed by largest remainders, with no five-seat cap.

    IEC seat-calculation guides, regional step. Independent candidates may be
    included in the input, but capping/forfeiture must be handled separately.
    """
    if type(seats) is not int or seats < 1:
        raise ValueError("seats must be a positive integer")
    if not votes or any(type(v) is not int or v < 0 for v in votes.values()):
        raise ValueError("votes must be nonnegative integers")
    total = sum(votes.values())
    if total == 0:
        raise ValueError("at least one valid vote is required")
    quota = total // (seats + 1) + 1
    result = {p: v // quota for p, v in votes.items()}
    remaining = seats - sum(result.values())
    ranked = sorted(votes, key=lambda p: votes[p] % quota, reverse=True)
    if remaining > len(ranked):
        raise UnsupportedAllocation("Too few votes to apply the regional remainder rule")
    if 0 < remaining < len(ranked) and votes[ranked[remaining-1]] % quota == votes[ranked[remaining]] % quota:
        raise AllocationTie("Tie at the regional largest-remainder cutoff")
    for party in ranked[:remaining]:
        result[party] += 1
    return result


def allocate(votes: dict[str, int], seats: int = 400) -> dict[str, int]:
    if type(seats) is not int or seats < 1:
        raise ValueError("seats must be a positive integer")
    if not votes or any(type(v) is not int or v < 0 for v in votes.values()):
        raise ValueError("votes must be nonnegative integers")
    total = sum(votes.values())
    if total == 0:
        raise ValueError("at least one valid vote is required")
    quota = total // (seats + 1) + 1
    result = {p: v // quota for p, v in votes.items()}
    remaining = seats - sum(result.values())
    ranked = sorted(votes, key=lambda p: votes[p] % quota, reverse=True)
    count = min(5, remaining, len(votes))
    if count < len(ranked) and count and votes[ranked[count-1]] % quota == votes[ranked[count]] % quota:
        raise AllocationTie("Tie at the largest-remainder cutoff")
    for party in ranked[:count]:
        result[party] += 1
    while sum(result.values()) < seats:
        averages = {p: Fraction(votes[p], s) for p, s in result.items() if s > 0}
        highest = max(averages.values())
        winners = [p for p, value in averages.items() if value == highest]
        if len(winners) != 1:
            raise AllocationTie("Tie in highest-average allocation")
        result[winners[0]] += 1
    return result


def perturb(votes, party, k=1, mechanism="add", destination=None):
    if type(k) is not int or k < 0:
        raise ValueError("k must be a nonnegative integer")
    if party not in votes:
        raise ValueError("Unknown party")
    result = dict(votes)
    if mechanism == "add":
        result[party] += k
    elif mechanism in ("abstain", "switch"):
        if k > votes[party]:
            raise ValueError("Cannot remove more votes than the party has")
        result[party] -= k
        if mechanism == "switch":
            if destination not in votes or destination == party:
                raise ValueError("Switching requires a different destination party")
            result[destination] += k
    else:
        raise ValueError("Unknown change mechanism")
    return result


def first_change(
    votes,
    party,
    mechanism="add",
    destination=None,
    limit=10000,
    criterion="vector",
):
    """Exhaustive bounded threshold search without assuming monotonicity.

    criterion separates questions that must not be conflated:
    vector finds the first change anywhere in the entitlement vector;
    party_change finds the first change in the selected party seats;
    party_gain / party_loss find the first directional party change;
    majority_status finds the first crossing of the 201-seat threshold;
    largest_party_status finds the first change in whether the selected
    party is the unique largest party.

    A null k means not found within the bound, NEVER zero or impossible.
    Search stops at an unresolved tie because a guaranteed minimum is then
    unknown.
    """
    if type(limit) is not int or limit < 1:
        raise ValueError("limit must be a positive integer")
    if criterion not in {
        "vector",
        "party_change",
        "party_gain",
        "party_loss",
        "majority_status",
        "largest_party_status",
    }:
        raise ValueError("Unknown threshold criterion")

    baseline = allocate(votes)
    total_seats = sum(baseline.values())
    majority = total_seats // 2 + 1

    def unique_largest(result):
        selected = result[party]
        return selected == max(result.values()) and sum(
            value == selected for value in result.values()
        ) == 1

    baseline_majority = baseline[party] >= majority
    baseline_largest = unique_largest(baseline)

    def matches(changed):
        if criterion == "vector":
            return changed != baseline
        if criterion == "party_change":
            return changed[party] != baseline[party]
        if criterion == "party_gain":
            return changed[party] > baseline[party]
        if criterion == "party_loss":
            return changed[party] < baseline[party]
        if criterion == "majority_status":
            return (changed[party] >= majority) != baseline_majority
        return unique_largest(changed) != baseline_largest

    bound = min(limit, votes[party]) if mechanism != "add" else limit
    for k in range(1, bound + 1):
        try:
            changed = allocate(perturb(votes, party, k, mechanism, destination))
        except AllocationTie:
            return {
                "criterion": criterion,
                "k": None,
                "searchedThrough": k - 1,
                "status": "tie",
                "tieAt": k,
            }
        if matches(changed):
            return {
                "criterion": criterion,
                "k": k,
                "searchedThrough": k,
                "status": "found",
                "seats": changed,
            }
    return {
        "criterion": criterion,
        "k": None,
        "searchedThrough": bound,
        "status": "not_found_within_bound",
    }

def below_half_threshold(votes, party, mechanism):
    """Minimum integer k to make the party's vote share STRICTLY below 50%."""
    a, v = votes[party], sum(votes.values())
    if 2*a < v:
        return 0
    if mechanism == "switch":
        return (2*a-v)//2 + 1
    if mechanism in ("opposition_add", "abstain"):
        k = 2*a-v+1
        return None if mechanism == "abstain" and (k > a or v-k == 0) else k
    raise ValueError("Unknown mechanism")
