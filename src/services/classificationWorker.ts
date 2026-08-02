import { classifySource } from "../knowledge/deterministicClassifier";
import type {
  ClassificationContext,
  ClassificationResult,
} from "../knowledge/domain";

type WorkerResponse = {
  id: number;
  result?: ClassificationResult;
  error?: string;
};

type PendingClassification = {
  resolve: (result: ClassificationResult) => void;
  reject: (error: Error) => void;
};

let worker: Worker | null = null;
let requestSequence = 0;
const pending = new Map<number, PendingClassification>();

function rejectPending(error: Error) {
  for (const request of pending.values()) request.reject(error);
  pending.clear();
}

function getWorker(): Worker | null {
  if (typeof Worker === "undefined") return null;
  if (worker) return worker;
  worker = new Worker(new URL("../workers/classification.worker.ts", import.meta.url), {
    type: "module",
    name: "nanfeng-classification",
  });
  worker.addEventListener("message", (event: MessageEvent<WorkerResponse>) => {
    const request = pending.get(event.data.id);
    if (!request) return;
    pending.delete(event.data.id);
    if (event.data.error || !event.data.result) {
      request.reject(new Error(event.data.error ?? "分类 Worker 没有返回结果"));
      return;
    }
    request.resolve(event.data.result);
  });
  worker.addEventListener("error", () => {
    rejectPending(new Error("分类 Worker 运行失败"));
    worker?.terminate();
    worker = null;
  });
  return worker;
}

/**
 * 正式 WebView 始终把分类计算交给 Worker。无 Worker 的 Node 单测环境才使用
 * 同一确定性函数同步回退，保证算法合同与桌面实现完全一致。
 */
export function classifySourceAsync(
  context: ClassificationContext,
): Promise<ClassificationResult> {
  const classificationWorker = getWorker();
  if (!classificationWorker) return Promise.resolve(classifySource(context));
  requestSequence += 1;
  const id = requestSequence;
  return new Promise<ClassificationResult>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    classificationWorker.postMessage({ id, context });
  });
}
