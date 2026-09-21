import { useCallback, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { store } from "@/data/store";
import { CURRENT_USER_ID } from "@/data/seed";
import { t } from "@/i18n/t";

/** `Jt` (app-initial-Bxa6k09t): route segment for a Devin session id — the `devin-` prefix is dropped. */
export function stripDevinPrefix(id: string): string {
  return id.replace(/^devin-/, "");
}

/** `x()` (useQuery-CpMyOosR): client-minted session identifier. */
export function newDevinId(): string {
  const hex = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  return `devin-${hex}`;
}

/** Exact request body of `POST sessions` (useGenerateAutomationWithDevin-DjIbxaeY.js:20-35). */
export type GenerateSessionRequest = {
  devin_id: string;
  user_message: string;
  username: string;
  snapshot_id: null;
  additional_args: { planning_mode: "automatic"; planner_type: "fast" };
};

/** Replaceable transport boundary: the shipped client POSTs `sessions`; here it resolves locally. */
async function postSession(body: GenerateSessionRequest): Promise<{ devin_id: string }> {
  await new Promise((r) => setTimeout(r, 600));
  return { devin_id: body.devin_id };
}

/**
 * Port of useGenerateAutomationWithDevin-DjIbxaeY.js (`S`): single-flight bootstrap of a normal session.
 * `generateWithDevin()` sends `generateAutomationPrompt`; `generateWithDevin(automationId)` sends
 * `improveAutomationPrompt` with `{id}`. On success the caller hook fires and the app routes to
 * `/sessions/<id without devin- prefix>`; on failure the shared `failedToStartSession` copy surfaces.
 */
export function useGenerateWithDevin(onSuccess?: (devinId: string) => void) {
  const inflight = useRef(false);
  const [isGenerating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const generateWithDevin = useCallback(async (improveAutomationId?: string) => {
    if (inflight.current) return;
    inflight.current = true;
    setGenerating(true);
    setError(null);
    const devinId = newDevinId();
    try {
      await postSession({
        devin_id: devinId,
        user_message: improveAutomationId ? t("improveAutomationPrompt", { id: improveAutomationId }) : t("generateAutomationPrompt"),
        username: store.userName(CURRENT_USER_ID)?.split(" ")[0] ?? "user",
        snapshot_id: null,
        additional_args: { planning_mode: "automatic", planner_type: "fast" },
      });
      onSuccess?.(devinId);
      navigate({ to: "/sessions/$id", params: { id: stripDevinPrefix(devinId) } });
      inflight.current = false;
      setGenerating(false);
    } catch (e) {
      inflight.current = false;
      setGenerating(false);
      setError(e instanceof Error && e.message ? e.message : t("failedToStartSession"));
    }
  }, [navigate, onSuccess]);

  /** Back-compat alias used by the detail page: `Improve with Devin` = generate with the automation id. */
  const improveWithDevin = useCallback((automationId: string) => generateWithDevin(automationId), [generateWithDevin]);

  return { generateWithDevin, improveWithDevin, isGenerating, error };
}
