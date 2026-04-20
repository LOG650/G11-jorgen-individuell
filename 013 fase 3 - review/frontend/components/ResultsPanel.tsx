"use client";

import type { VoyageResponse } from "../lib/types";
import CostSummary from "./CostSummary";
import ServiceBreakdown from "./ServiceBreakdown";
import StopsList from "./StopsList";

export default function ResultsPanel({ result }: { result: VoyageResponse }) {
  return (
    <div className="space-y-6">
      <CostSummary result={result} />
      {result.stops.length > 1 && <StopsList stops={result.stops} />}
      <ServiceBreakdown result={result} />
    </div>
  );
}
