import { spawn, spawnSync } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const qaParent = resolve(repositoryRoot, ".runtime-qa");
const rootArgument = process.argv[2];

if (!rootArgument) {
  throw new Error("用法：node scripts/run-hidden-knowledge-ipc-qa.mjs <.runtime-qa 下的新目录>");
}

const qaRoot = resolve(repositoryRoot, rootArgument);
const relativeQaRoot = relative(qaParent, qaRoot);
if (
  !relativeQaRoot
  || relativeQaRoot.startsWith("..")
  || resolve(qaRoot) === resolve("D:\\南枫知识库")
  || resolve(qaRoot) === resolve("D:\\南枫情报台")
) {
  throw new Error("隐藏 IPC 验收目录必须是 .runtime-qa 下的新目录");
}
if (existsSync(qaRoot)) {
  throw new Error("隐藏 IPC 验收目录已经存在；为保护现有证据，请使用新目录");
}

mkdirSync(join(qaRoot, "logs"), { recursive: true });
writeFileSync(
  join(qaRoot, ".isolated-knowledge-migration-test"),
  "hidden knowledge IPC QA only\n",
  "utf8",
);

const cdpPort = 9337;
const cdpEndpoint = `http://127.0.0.1:${cdpPort}`;
const logPath = join(qaRoot, "logs", "hidden-tauri-ipc.log");
const logDescriptor = openSync(logPath, "a");
let tauriProcess;
let browser;

function startHiddenTauri() {
  const executable = process.platform === "win32" ? process.execPath : "npx";
  const executableArguments = process.platform === "win32"
    ? [join(dirname(process.execPath), "node_modules", "npm", "bin", "npx-cli.js")]
    : [];
  tauriProcess = spawn(
    executable,
    [
      ...executableArguments,
      "tauri",
      "dev",
      "--config",
      "src-tauri/tauri.hidden-qa.conf.json",
      "--no-watch",
    ],
    {
      cwd: repositoryRoot,
      env: {
        ...process.env,
        NANFENG_KNOWLEDGE_BASE_DATA_DIR: qaRoot,
        WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${cdpPort}`,
      },
      windowsHide: true,
      stdio: ["ignore", logDescriptor, logDescriptor],
    },
  );
}

function stopHiddenTauri() {
  if (!tauriProcess?.pid) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(tauriProcess.pid), "/T", "/F"], {
      windowsHide: true,
      stdio: "ignore",
    });
  } else {
    tauriProcess.kill("SIGKILL");
  }
  tauriProcess = undefined;
}

async function waitForCdp(timeoutMs = 120_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (tauriProcess?.exitCode !== null) {
      throw new Error(`隐藏 Tauri 在 CDP 就绪前退出：${tauriProcess?.exitCode}`);
    }
    try {
      const response = await fetch(`${cdpEndpoint}/json/version`);
      if (response.ok) return;
    } catch {
      // 构建和 WebView2 启动期间继续轮询。
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }
  throw new Error("等待隐藏 WebView2 CDP 超时");
}

async function connectPage() {
  await waitForCdp();
  browser = await chromium.connectOverCDP(cdpEndpoint);
  const startedAt = Date.now();
  let page;
  while (Date.now() - startedAt < 30_000) {
    const pages = browser.contexts().flatMap((context) => context.pages());
    page = pages.find((candidate) =>
      candidate.url().includes("localhost:4173")
      || candidate.url().includes("127.0.0.1:4173"));
    if (page) break;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  if (!page) {
    const urls = browser.contexts()
      .flatMap((context) => context.pages())
      .map((candidate) => candidate.url());
    throw new Error(`未找到南枫知识库隐藏 WebView2 页面：${JSON.stringify(urls)}`);
  }
  await page.waitForFunction(() => "__TAURI_INTERNALS__" in window, null, { timeout: 30_000 });
  return page;
}

async function closeBrowserConnection() {
  if (!browser) return;
  await browser.close().catch(() => undefined);
  browser = undefined;
}

async function firstRun(page) {
  return page.evaluate(async () => {
    const invoke = window.__TAURI_INTERNALS__.invoke;
    await invoke("create_record", {
      input: {
        title: "隐藏 IPC 脱敏来源",
        sourceText: "离线渲染在最终交付中表现更稳定。",
      },
    });
    const domain = await invoke("create_knowledge_domain", {
      input: { name: "隐藏 IPC 验收", description: "仅隔离测试" },
    });
    const topic = await invoke("create_knowledge_topic", {
      input: {
        domainId: domain.id,
        parentTopicId: null,
        name: "交付策略",
        description: "仅隔离测试",
        topicKind: "subject",
      },
    });
    const relatedTopic = await invoke("create_knowledge_topic", {
      input: {
        domainId: domain.id,
        parentTopicId: null,
        name: "流程自动化",
        description: "仅隔离测试",
        topicKind: "subject",
      },
    });
    const inbox = await invoke("list_knowledge_inbox", { limit: 20 });
    const source = inbox.find((item) => item.title === "隐藏 IPC 脱敏来源");
    if (!source) throw new Error("新建记录没有同步生成 Source Item");
    await invoke("confirm_knowledge_classification", {
      input: {
        sourceItemId: source.id,
        topicId: topic.id,
        suggestionId: null,
        confidence: 100,
      },
    });
    const note = await invoke("create_knowledge_note", {
      input: {
        title: "隐藏 IPC 独立 Note",
        bodyMarkdown: "通过真实 Tauri IPC 写入。",
        summary: "隔离验收",
        noteType: "review",
        status: "active",
        organizationState: "organized",
        primaryTopicId: topic.id,
        relatedTopicIds: [relatedTopic.id],
        sourceItemIds: [source.id],
      },
    });
    const firstJudgment = await invoke("add_knowledge_topic_judgment", {
      input: {
        topicId: topic.id,
        statementMarkdown: "此前采用实时渲染",
        confidence: 60,
        state: "tentative",
        changeReason: "",
      },
    });
    const secondJudgment = await invoke("add_knowledge_topic_judgment", {
      input: {
        topicId: topic.id,
        statementMarkdown: "当前采用离线渲染",
        confidence: 88,
        state: "current",
        changeReason: "稳定性证据增加",
      },
    });
    const proposition = await invoke("create_knowledge_proposition", {
      input: {
        topicId: topic.id,
        statementMarkdown: "离线渲染能降低最终交付波动",
        status: "supported",
      },
    });
    const evidence = await invoke("add_knowledge_topic_evidence", {
      input: {
        topicId: topic.id,
        sourceItemId: source.id,
        contentMarkdown: "原始来源明确描述稳定性提升",
        stance: "support",
        credibility: 85,
        verificationStatus: "verified",
        validityStatus: "active",
        locatorJson: JSON.stringify({
          kind: "text_quote",
          value: "离线渲染在最终交付中表现更稳定。",
          quote: "表现更稳定",
        }),
      },
    });
    const turningPoint = await invoke("create_knowledge_turning_point", {
      input: {
        topicId: topic.id,
        fromJudgmentId: firstJudgment.id,
        toJudgmentId: secondJudgment.id,
        title: "切换为离线渲染",
        explanation: "稳定性证据改变了交付策略",
        occurredAt: "",
      },
    });
    const detail = await invoke("get_knowledge_topic_detail", { topicId: topic.id });
    const integrity = await invoke("run_integrity_check");
    return {
      domainId: domain.id,
      topicId: topic.id,
      relatedTopicId: relatedTopic.id,
      sourceId: source.id,
      noteId: note.id,
      propositionId: proposition.id,
      evidenceId: evidence.id,
      turningPointId: turningPoint.id,
      counts: {
        notes: detail.notes.length,
        propositions: detail.propositions.length,
        evidence: detail.evidence.length,
        turningPoints: detail.turningPoints.length,
      },
      locatorLabel: evidence.locatorLabel,
      integrity,
    };
  });
}

async function secondRun(page, first) {
  return page.evaluate(async (expected) => {
    const invoke = window.__TAURI_INTERNALS__.invoke;
    const detail = await invoke("get_knowledge_topic_detail", { topicId: expected.topicId });
    const domains = await invoke("list_knowledge_domains");
    const topics = await invoke("list_knowledge_topics");
    const integrity = await invoke("run_integrity_check");
    return {
      domainPresent: domains.some((item) => item.id === expected.domainId),
      topicPresent: topics.some((item) => item.id === expected.topicId),
      notePresent: detail.notes.some((item) => item.id === expected.noteId),
      propositionPresent: detail.propositions.some(
        (item) => item.id === expected.propositionId,
      ),
      evidencePresent: detail.evidence.some((item) => item.id === expected.evidenceId),
      turningPointPresent: detail.turningPoints.some(
        (item) => item.id === expected.turningPointId,
      ),
      locatorLabel: detail.evidence.find((item) => item.id === expected.evidenceId)
        ?.locatorLabel,
      integrity,
    };
  }, first);
}

function inspectIsolatedDatabase() {
  const result = spawnSync(
    "cargo",
    [
      "run",
      "--quiet",
      "--manifest-path",
      "src-tauri/Cargo.toml",
      "--example",
      "knowledge_inspect_isolated",
      "--",
      qaRoot,
    ],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      windowsHide: true,
    },
  );
  if (result.status !== 0) {
    throw new Error(`隔离数据库只读检查失败：${result.stderr || result.stdout}`);
  }
  return JSON.parse(result.stdout);
}

try {
  startHiddenTauri();
  const firstPage = await connectPage();
  const first = await firstRun(firstPage);
  if (
    first.integrity !== "ok"
    || Object.values(first.counts).some((count) => count !== 1)
    || first.locatorLabel !== "短文本引用：离线渲染在最终交付中表现更稳定。"
  ) {
    throw new Error(`首次隐藏 IPC 结果不符合合同：${JSON.stringify(first)}`);
  }
  await closeBrowserConnection();
  stopHiddenTauri();
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 1_500));

  startHiddenTauri();
  const secondPage = await connectPage();
  const second = await secondRun(secondPage, first);
  if (
    second.integrity !== "ok"
    || !second.domainPresent
    || !second.topicPresent
    || !second.notePresent
    || !second.propositionPresent
    || !second.evidencePresent
    || !second.turningPointPresent
    || second.locatorLabel !== first.locatorLabel
  ) {
    throw new Error(`重启持久化结果不符合合同：${JSON.stringify(second)}`);
  }
  await closeBrowserConnection();
  stopHiddenTauri();
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 1_000));
  const inspection = inspectIsolatedDatabase();
  if (
    inspection.integrityCheck !== "ok"
    || inspection.foreignKeyViolations !== 0
    || JSON.stringify(inspection.schemaVersions) !== JSON.stringify([1, 2, 3])
    || inspection.activeRecords !== 1
    || inspection.sourceItems !== 1
    || inspection.notes !== 1
    || inspection.propositions !== 1
    || inspection.evidence !== 1
    || inspection.turningPoints !== 1
  ) {
    throw new Error(`隔离数据库检查不符合合同：${JSON.stringify(inspection)}`);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    dataRoot: qaRoot,
    visibleWindow: false,
    firstRun: first,
    secondRun: second,
    inspection,
  };
  writeFileSync(
    join(qaRoot, "logs", "hidden-knowledge-ipc-report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} finally {
  await closeBrowserConnection();
  stopHiddenTauri();
  closeSync(logDescriptor);
}
