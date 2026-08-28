/** Parse the classic Mollie webhook body into the payload the provider expects. */
export function parseMollieWebhookBody(
  body: string,
  contentType: string | null | undefined,
): { id: string } | null {
  const formId = () => {
    const id = new URLSearchParams(body).get("id");
    return id?.trim() ? { id: id.trim() } : null;
  };

  if (contentType?.toLowerCase().includes("application/x-www-form-urlencoded")) {
    return formId();
  }

  try {
    const parsed: unknown = JSON.parse(body);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "id" in parsed &&
      typeof (parsed as { id?: unknown }).id === "string" &&
      (parsed as { id: string }).id.trim()
    ) {
      return { id: (parsed as { id: string }).id.trim() };
    }
  } catch {
    // Some webhook proxies omit or rewrite the content type. Fall through to
    // the documented form payload before declaring the request invalid.
  }

  return formId();
}
