/// <reference lib="webworker" />

import { classifySource } from "../knowledge/deterministicClassifier";
import type { ClassificationContext } from "../knowledge/domain";

type ClassificationWorkerRequest = {
  id: number;
  context: ClassificationContext;
};

self.addEventListener("message", (event: MessageEvent<ClassificationWorkerRequest>) => {
  const { id, context } = event.data;
  try {
    self.postMessage({ id, result: classifySource(context) });
  } catch (error) {
    self.postMessage({
      id,
      error: error instanceof Error ? error.message : "分类计算失败",
    });
  }
});

export {};
