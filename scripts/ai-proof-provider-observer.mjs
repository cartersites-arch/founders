import fs from "node:fs";
const output = new URL("../docs/ai-generation-proof/provider.jsonl", import.meta.url);
const original = globalThis.fetch;
globalThis.fetch = async (...args) => {
  const response = await original(...args);
  const url = String(args[0]?.url ?? args[0]);
  if (url === "https://openrouter.ai/api/v1/chat/completions") {
    const data = await response
      .clone()
      .json()
      .catch(() => ({}));
    fs.appendFileSync(
      output,
      JSON.stringify({
        at: new Date().toISOString(),
        status: response.status,
        id: data.id,
        model: data.model,
        provider: data.provider,
        usage: data.usage,
        error: data.error?.message,
      }) + "\n",
    );
  }
  return response;
};
