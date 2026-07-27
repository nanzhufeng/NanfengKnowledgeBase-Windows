import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { createServer } from "vite";

const [, , baseInputArgument, outputArgument, ...sourceArguments] = process.argv;
if (!baseInputArgument || !outputArgument || !sourceArguments.length) {
  console.error("用法：node scripts/merge-chatgpt-classification-input.mjs <基础输入.json> <组合输入.json> <conversations-*.json...>");
  process.exit(1);
}

const server = await createServer({
  appType: "custom",
  logLevel: "error",
  server: { middlewareMode: true },
});

try {
  const { mergeSupplementalChatGptConversations } = await server.ssrLoadModule(
    "/src/knowledge/supplementalChatGptInput.ts",
  );
  const baseInput = JSON.parse(await readFile(path.resolve(baseInputArgument), "utf8"));
  const sources = [];
  for (const argument of sourceArguments) {
    const filePath = path.resolve(argument);
    const bytes = await readFile(filePath);
    const conversations = JSON.parse(bytes.toString("utf8"));
    if (!Array.isArray(conversations)) {
      throw new Error(`补充文件不是 ChatGPT 会话数组：${filePath}`);
    }
    sources.push({
      filePath,
      fileName: path.basename(filePath),
      sha256: createHash("sha256").update(bytes).digest("hex").toUpperCase(),
      conversations,
    });
  }
  const merged = mergeSupplementalChatGptConversations(baseInput, sources);
  await writeFile(
    path.resolve(outputArgument),
    `${JSON.stringify(merged)}\n`,
    { encoding: "utf8", flag: "wx" },
  );
  console.log("ChatGPT 补充会话合并完成");
  console.log(`基础记录：${merged.supplementalMerge.baseRecordCount}`);
  console.log(`原有 ChatGPT：${merged.supplementalMerge.existingChatGptConversationCount}`);
  console.log(`补充文件会话：${merged.supplementalMerge.suppliedConversationCount}`);
  console.log(`跳过重复：${merged.supplementalMerge.overlapSkippedCount + merged.supplementalMerge.crossFileDuplicateCount}`);
  console.log(`新增到预演：${merged.supplementalMerge.addedConversationCount}`);
  console.log(`组合记录：${merged.recordCount}`);
  console.log(`组合输入：${path.resolve(outputArgument)}`);
} finally {
  await server.close();
}
