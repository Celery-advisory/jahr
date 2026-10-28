"use client";

import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  supportRequestKindLabel,
  supportRequestStatusLabel,
  type SupportRequest,
  type SupportRequestStatus,
} from "@/lib/support/types";
import { cn } from "@/lib/utils";

const STATUS_BADGE_CLASSES: Record<SupportRequestStatus, string> = {
  new: "border-transparent bg-[color-mix(in_srgb,#0070F3_12%,white)] text-[#0B4FBF]",
  in_review:
    "border-transparent bg-[color-mix(in_srgb,#F6B93B_20%,white)] text-[#8A5B00]",
  done: "border-transparent bg-success/10 text-success",
  declined: "border-transparent bg-secondary text-muted-foreground",
};

interface SupportRequestListProps {
  requests: SupportRequest[];
  onAddRequest?: () => void;
}

export function SupportRequestList({
  requests,
  onAddRequest,
}: SupportRequestListProps) {
  return (
    <Card>
      <CardContent className="space-y-2 pt-(--card-spacing)">
        {requests.length === 0 ? (
          <EmptyState
            kind="ideas"
            title="No requests yet"
            description="Share an idea or report a bug."
            action={
              onAddRequest ? (
                <Button type="button" variant="outline" onClick={onAddRequest}>
                  Add request
                </Button>
              ) : null
            }
          />
        ) : (
          requests.map((request) => (
            <div
              key={request.id}
              className="space-y-2 rounded-md border border-border px-3 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-0.5">
                  <p className="truncate text-sm font-medium">
                    {request.subject}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {[
                      supportRequestKindLabel(request.kind),
                      format(new Date(request.createdAt), "d MMM yyyy"),
                    ].join(" · ")}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "shrink-0 rounded-md",
                    STATUS_BADGE_CLASSES[request.status],
                  )}
                >
                  {supportRequestStatusLabel(request.status)}
                </Badge>
              </div>

              <p className="text-sm whitespace-pre-line text-muted-foreground">
                {request.details}
              </p>

              {request.reviewer && request.reviewedAt ? (
                <p className="text-[11px] text-muted-foreground">
                  Updated on{" "}
                  {format(new Date(request.reviewedAt), "d MMM yyyy")}
                </p>
              ) : null}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
