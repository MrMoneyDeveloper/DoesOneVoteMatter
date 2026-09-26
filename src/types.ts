export type Party = {
  party: string;
  name: string;
  abbreviation: string;
  votes: number;
  share: number;
  officialSeats: number;
  regionalVotes?: number;
  provinceVotes: Record<string, number>;
  sourceId: string;
};
export type Election = {
  year: number;
  parties: Party[];
  voteTotal: number;
  totals: Record<string, number>;
  metrics: { effectiveParties: number; oneBallotWeightPP: number; smoothSeatEquivalent: number; averageBallotsPerSeat: number };
  anc: {
    share: number;
    votes: number;
    seats: number;
    belowHalf: Record<string, number | null>;
  };
};
export type Source = {
  id: string;
  url: string;
  sourcePage: string;
  retrievedAt: string;
  sha256: string;
  sizeBytes: number;
  format: string;
  note?: string;
  year?: number;
};
export type Report = {
  regionalValidation: {
    year: number;
    status: string;
    regionalCellsMatched?: number;
    compensatoryRowsMatched?: number;
    oneBallotChecks?: { tested: number; changes: unknown[]; ties: unknown[] };
    capacities?: Record<string, number>;
    calculated?: {
      regional: Record<string, Record<string, number>>;
      compensatory: Record<string, number>;
      overall: Record<string, number>;
    };
  }[];
  switchChecks: {
    year: number;
    tested: number;
    changes: string[][];
    ties: string[][];
  }[];
  elections: Election[];
  history: {
    mean: number;
    sampleSD: number;
    thresholdDistanceSD: number;
    holdoutDistanceSD: number;
    swings: {
      from: number;
      to: number;
      changePP: number;
      annualisedPP: number;
    }[];
  };
  validation: {
    year: number;
    parties: number;
    matched: number;
    status: string;
  }[];
  sources: Source[];
  analysisUnit: string;
  terminology: {
    oneVoteMeaning: string;
    voterBallotDistinction: string;
  };
  thresholds: {
    year: number;
    party: string;
    action: string;
    metric: string;
    criterion: string;
    scope: string;
    k: number | null;
    searchedThrough: number;
    status: string;
    tieAt?: number;
    selectedPartyDelta?: number;
    changes?: {
      party: string;
      before: number;
      after: number;
      delta: number;
    }[];
  }[];
  pivotality: {
    year: number;
    party: string;
    action: string;
    entitlementChanged: boolean | null;
    shareChangePP: number;
  }[];
  limitations: string[];
};
