import bronzeBotanicalUrl from "../assets/skins/bronze-botanical.png";
import desertLanternUrl from "../assets/skins/desert-lantern.jpg";
import floristStudioUrl from "../assets/skins/florist-studio.jpeg";
import goldenHorsesUrl from "../assets/skins/golden-horses.png";

export const KNOWLEDGE_SKIN_STORAGE_KEY = "nanfeng-knowledge-base:appearance-skin";

export const KNOWLEDGE_SKINS = [
  {
    id: "desert-lantern",
    name: "沙漠灯笼",
    description: "晚霞、沙丘与暖光灯笼",
    backgroundUrl: desertLanternUrl,
    backgroundPosition: "center center",
  },
  {
    id: "florist-studio",
    name: "花房",
    description: "绿墙、木架与自然花艺",
    backgroundUrl: floristStudioUrl,
    backgroundPosition: "center center",
  },
  {
    id: "golden-horses",
    name: "奔马",
    description: "金色逆光与扬尘马群",
    backgroundUrl: goldenHorsesUrl,
    backgroundPosition: "center center",
  },
  {
    id: "bronze-botanical",
    name: "铜金发簪",
    description: "铜棕织物与金色植物发簪",
    backgroundUrl: bronzeBotanicalUrl,
    backgroundPosition: "center center",
  },
  {
    id: "classic",
    name: "原版浅色",
    description: "浅灰内容区与深蓝侧栏",
    backgroundUrl: null,
    backgroundPosition: "center center",
  },
] as const;

export type KnowledgeSkinId = typeof KNOWLEDGE_SKINS[number]["id"];
export type KnowledgeSkin = typeof KNOWLEDGE_SKINS[number];

export const DEFAULT_KNOWLEDGE_SKIN: KnowledgeSkinId = "desert-lantern";

export function isKnowledgeSkinId(value: unknown): value is KnowledgeSkinId {
  return typeof value === "string"
    && KNOWLEDGE_SKINS.some((skin) => skin.id === value);
}

export function readKnowledgeSkin(
  storage: Pick<Storage, "getItem"> | null | undefined = typeof window === "undefined"
    ? undefined
    : window.localStorage,
): KnowledgeSkinId {
  try {
    const saved = storage?.getItem(KNOWLEDGE_SKIN_STORAGE_KEY);
    return isKnowledgeSkinId(saved) ? saved : DEFAULT_KNOWLEDGE_SKIN;
  } catch {
    return DEFAULT_KNOWLEDGE_SKIN;
  }
}

export function persistKnowledgeSkin(
  skinId: KnowledgeSkinId,
  storage: Pick<Storage, "setItem"> | null | undefined = typeof window === "undefined"
    ? undefined
    : window.localStorage,
): void {
  try {
    storage?.setItem(KNOWLEDGE_SKIN_STORAGE_KEY, skinId);
  } catch {
    // 外观偏好不可写时仅维持当前会话，不影响任何正式知识数据。
  }
}

export function getKnowledgeSkin(skinId: KnowledgeSkinId): KnowledgeSkin {
  return KNOWLEDGE_SKINS.find((skin) => skin.id === skinId) ?? KNOWLEDGE_SKINS[0];
}
