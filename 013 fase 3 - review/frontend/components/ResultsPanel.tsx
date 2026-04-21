"use client";

import type { VoyageRequest, VoyageResponse } from "../lib/types";
import CostSummary from "./CostSummary";
import ServiceBreakdown from "./ServiceBreakdown";
import StopsList from "./StopsList";
import SaveToRegistry from "./SaveToRegistry";

interface Props {
  request: VoyageRequest;
  result: VoyageResponse;
}

export default function ResultsPanel({ request, result }: Props) {
  return (
    <div className="space-y-6">
      <CostSummary result={result} />
      {result.stops.length > 1 && <StopsList stops={result.stops} />}
      <ServiceBreakdown result={result} />
      <SaveToRegistry request={request} response={result} />
    </div>
  );
}
