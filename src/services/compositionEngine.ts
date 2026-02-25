import { getPrompt, updatePrompt } from "../firestore/prompts";
import { getSnippet } from "../firestore/snippets";
import type { Snippet } from "../firestore/snippets";

export interface CompositionRequest {
  prompt_id: string;
  snippet_order: string[]; // ordered snippet IDs
}

export interface CompositionPreview {
  prompt_id: string;
  base_body: string;
  snippet_order: string[];
  resolved_snippets: Array<{
    id: string;
    name: string;
    content: string;
  }>;
  missing_snippet_ids: string[];
  composed_body: string;
}

/**
 * Compose a prompt body from base text + ordered snippets.
 * Joins: base_body + \n\n---\n\n + snippet contents (in order).
 */
function composeBody(
  baseBody: string,
  snippets: Array<{ content: string }>,
): string {
  if (snippets.length === 0) return baseBody;
  const parts = [baseBody];
  for (const s of snippets) {
    parts.push(s.content);
  }
  return parts.join("\n\n---\n\n");
}

/**
 * Preview a composed prompt without persisting.
 * Resolves snippet IDs to their content in the given order.
 */
export async function previewComposition(
  req: CompositionRequest,
): Promise<CompositionPreview> {
  const prompt = await getPrompt(req.prompt_id);
  if (!prompt) {
    throw new Error("prompt not found");
  }

  const resolved: CompositionPreview["resolved_snippets"] = [];
  const missing: string[] = [];
  for (const snippetId of req.snippet_order) {
    const snippet = await getSnippet(snippetId);
    if (snippet) {
      resolved.push({
        id: snippet.id,
        name: snippet.name,
        content: snippet.content,
      });
    } else {
      missing.push(snippetId);
    }
  }

  return {
    prompt_id: prompt.id,
    base_body: prompt.body,
    snippet_order: req.snippet_order,
    resolved_snippets: resolved,
    missing_snippet_ids: missing,
    composed_body: composeBody(prompt.body, resolved),
  };
}

export interface CompositionResult {
  prompt_id: string;
  composed_body: string;
  snippet_order: string[];
  snippets_applied: number;
  missing_snippet_ids: string[];
}

/**
 * Compose and persist: resolves snippets, composes the body,
 * and writes the composed text back to the prompt's body field.
 */
export async function applyComposition(
  req: CompositionRequest,
): Promise<CompositionResult> {
  const preview = await previewComposition(req);

  await updatePrompt(req.prompt_id, { body: preview.composed_body });

  return {
    prompt_id: req.prompt_id,
    composed_body: preview.composed_body,
    snippet_order: preview.snippet_order,
    snippets_applied: preview.resolved_snippets.length,
    missing_snippet_ids: preview.missing_snippet_ids,
  };
}

/**
 * Resolve snippet IDs to full snippet objects, preserving order.
 * Skips any IDs that don't resolve.
 */
export async function resolveSnippets(
  snippetIds: string[],
): Promise<Snippet[]> {
  const results: Snippet[] = [];
  for (const id of snippetIds) {
    const snippet = await getSnippet(id);
    if (snippet) results.push(snippet);
  }
  return results;
}
