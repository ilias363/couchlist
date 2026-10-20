"use client";

import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

// Convex pagination throws query errors. Keep a failed check local, including
// on the home page, rather than hiding the rest of the page or claiming success.
export class CatchUpBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="flex flex-col items-start gap-3 text-sm text-muted-foreground">
        <p>Catch-up checks could not be loaded. Results are incomplete.</p>
        <Button variant="outline" size="sm" onClick={() => this.setState({ failed: false })}>Retry catch-up checks</Button>
      </div>
    );
  }
}
