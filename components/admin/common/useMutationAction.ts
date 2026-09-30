"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { adminErrorMessage } from "@/lib/admin/errors";

/**
 * Runs a Convex mutation (or any async call) from a button: tracks `pending`,
 * toasts the server's Serbian error message on failure, optionally toasts a
 * success line. Resolves to the result, or `undefined` when it failed, so the
 * caller can branch without its own try/catch.
 *
 *   const setStatus = useMutationAction(useMutation(api.leadsAdmin.setStatus), "Status je promenjen.");
 *   await setStatus.run({ id, status });
 */
export function useMutationAction<Args, Result>(
  fn: (args: Args) => Promise<Result>,
  success?: string,
): { run: (args: Args) => Promise<Result | undefined>; pending: boolean } {
  const [pending, setPending] = useState(false);

  const run = useCallback(
    async (args: Args): Promise<Result | undefined> => {
      setPending(true);
      try {
        const result = await fn(args);
        if (success !== undefined) toast.success(success);
        return result;
      } catch (error) {
        toast.error(adminErrorMessage(error));
        return undefined;
      } finally {
        setPending(false);
      }
    },
    [fn, success],
  );

  return { run, pending };
}
