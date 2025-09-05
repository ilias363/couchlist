import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PaginationProps {
  page: number;
  totalPages: number;
  loading?: boolean;
  onPageChange: (newPage: number) => void;
}

export function Pagination({ page, totalPages, loading, onPageChange }: PaginationProps) {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(Math.max(1, page - 10))}
        disabled={page <= 1 || loading}
        aria-label="Jump back 10 pages"
        title="-10"
      >
        <ChevronsLeft className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page <= 1 || loading}
        aria-label="Previous Page"
        title="Prev"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-xs font-medium tabular-nums">
        Page {page} / {totalPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages || loading}
        aria-label="Next Page"
        title="Next"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(Math.min(totalPages, page + 10))}
        disabled={page >= totalPages || loading}
        aria-label="Jump forward 10 pages"
        title="+10"
      >
        <ChevronsRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
