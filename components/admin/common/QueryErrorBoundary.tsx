"use client";

import { ShieldAlert, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { adminErrorMessage, isForbidden } from "@/lib/admin/errors";

type Props = { children: ReactNode; backHref?: string; backLabel?: string };
type State = { error: unknown };

/**
 * `useQuery` throws a failed query's error during render. This boundary turns
 * that into a readable panel — most importantly `FORBIDDEN`, which is what an
 * agent sees when opening a colleague's listing.
 */
export class QueryErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    if (!isForbidden(error)) console.error("[admin] query failed", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (error === null) return this.props.children;
    const forbidden = isForbidden(error);
    const Icon = forbidden ? ShieldAlert : TriangleAlert;
    return (
      <div
        role="alert"
        data-testid={forbidden ? "admin-forbidden" : "admin-query-error"}
        className="mx-auto mt-10 max-w-md rounded-lg border bg-card p-8 text-center"
      >
        <Icon className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
        <h2 className="mt-4 text-lg font-semibold">
          {forbidden ? "Nemate pristup" : "Podaci nisu učitani"}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{adminErrorMessage(error)}</p>
        <div className="mt-6 flex justify-center gap-2">
          {this.props.backHref !== undefined ? (
            <Button variant="outline" asChild>
              <Link href={this.props.backHref}>{this.props.backLabel ?? "Nazad"}</Link>
            </Button>
          ) : null}
          {forbidden ? null : (
            <Button onClick={() => this.setState({ error: null })}>Pokušajte ponovo</Button>
          )}
        </div>
      </div>
    );
  }
}
