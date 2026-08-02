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
    sceneText: "#12345f",
    sceneMuted: "#405b7c",
    sceneSurface: "rgba(250, 252, 255, 0.88)",
    sceneTemperature: "warm",
    sceneFallbackRgb: { red: 112, green: 78, blue: 67 },
  },
  {
    id: "florist-studio",
    name: "花房",
    description: "绿墙、木架与自然花艺",
    backgroundUrl: floristStudioUrl,
    backgroundPosition: "center center",
    sceneText: "#4c2d1f",
    sceneMuted: "#725243",
    sceneSurface: "rgba(255, 252, 247, 0.88)",
    sceneTemperature: "cool",
    sceneFallbackRgb: { red: 94, green: 89, blue: 70 },
  },
  {
    id: "golden-horses",
    name: "奔马",
    description: "金色逆光与扬尘马群",
    backgroundUrl: goldenHorsesUrl,
    backgroundPosition: "center center",
    sceneText: "#0f315f",
    sceneMuted: "#3f5f80",
    sceneSurface: "rgba(249, 252, 255, 0.88)",
    sceneTemperature: "warm",
    sceneFallbackRgb: { red: 177, green: 135, blue: 82 },
  },
  {
    id: "classic",
    name: "原版浅色",
    description: "浅灰内容区与深蓝侧栏",
    backgroundUrl: null,
    backgroundPosition: "center center",
    sceneText: "#14345f",
    sceneMuted: "#66758a",
    sceneSurface: "rgba(255, 255, 255, 0.96)",
    sceneTemperature: "neutral",
    sceneFallbackRgb: { red: 238, green: 241, blue: 245 },
  },
] as const;

export type KnowledgeSkinId = typeof KNOWLEDGE_SKINS[number]["id"];
export type KnowledgeSkin = typeof KNOWLEDGE_SKINS[number];
export type SceneTemperature = "warm" | "cool" | "neutral";
export type AdaptiveScenePalette = {
  text: string;
  muted: string;
  accent: string;
  textShadow: string;
  surface: string;
  surfaceText: string;
  surfaceMuted: string;
  background: string;
  luminance: number;
  temperature: SceneTemperature;
};

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

type RgbColor = {
  red: number;
  green: number;
  blue: number;
};

const SURFACE_TEXT = "#17375f";
const SURFACE_MUTED = "#52647a";

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function rgbToHex(color: RgbColor): string {
  return `#${[color.red, color.green, color.blue]
    .map((channel) => clampChannel(channel).toString(16).padStart(2, "0"))
    .join("")}`;
}

function hexToRgb(hex: string): RgbColor {
  return {
    red: Number.parseInt(hex.slice(1, 3), 16),
    green: Number.parseInt(hex.slice(3, 5), 16),
    blue: Number.parseInt(hex.slice(5, 7), 16),
  };
}

function linearizeChannel(channel: number): number {
  const normalized = clampChannel(channel) / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(color: RgbColor): number {
  return (
    0.2126 * linearizeChannel(color.red)
    + 0.7152 * linearizeChannel(color.green)
    + 0.0722 * linearizeChannel(color.blue)
  );
}

export function sceneContrastRatio(foreground: string, background: string): number {
  const foregroundLuminance = relativeLuminance(hexToRgb(foreground));
  const backgroundLuminance = relativeLuminance(hexToRgb(background));
  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05)
    / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  );
}

function mixHexColor(from: string, to: string, amount: number): string {
  const source = hexToRgb(from);
  const target = hexToRgb(to);
  return rgbToHex({
    red: source.red + (target.red - source.red) * amount,
    green: source.green + (target.green - source.green) * amount,
    blue: source.blue + (target.blue - source.blue) * amount,
  });
}

function enforceSceneContrast(
  color: string,
  background: string,
  targetRatio: number,
  lightForeground: boolean,
): string {
  if (sceneContrastRatio(color, background) >= targetRatio) return color;
  const contrastTarget = lightForeground ? "#ffffff" : "#000000";
  let strongest = color;
  for (let step = 1; step <= 20; step += 1) {
    strongest = mixHexColor(color, contrastTarget, step / 20);
    if (sceneContrastRatio(strongest, background) >= targetRatio) return strongest;
  }
  return strongest;
}

function detectSceneTemperature({ red, blue }: RgbColor): SceneTemperature {
  const warmth = red - blue;
  return warmth > 14 ? "warm" : warmth < -14 ? "cool" : "neutral";
}

export function deriveAdaptiveScenePalette(color: RgbColor): AdaptiveScenePalette {
  const background = rgbToHex(color);
  const luminance = relativeLuminance(color);
  const temperature = detectSceneTemperature(color);
  const blackContrast = sceneContrastRatio("#000000", background);
  const whiteContrast = sceneContrastRatio("#ffffff", background);
  const lightForeground = whiteContrast > blackContrast;
  const bases = lightForeground
    ? temperature === "warm"
      ? { text: "#eaf6ff", muted: "#d7eaff", accent: "#8adfff" }
      : temperature === "cool"
        ? { text: "#fff1df", muted: "#f3dcc5", accent: "#ffd07e" }
        : { text: "#f7fbff", muted: "#d9e5f2", accent: "#8de0db" }
    : temperature === "warm"
      ? { text: "#08233f", muted: "#123453", accent: "#00547f" }
      : temperature === "cool"
        ? { text: "#5b2816", muted: "#70402d", accent: "#933818" }
        : { text: "#102f52", muted: "#385676", accent: "#00646c" };
  const text = enforceSceneContrast(bases.text, background, 5, lightForeground);
  const muted = enforceSceneContrast(bases.muted, background, 4.5, lightForeground);
  const accent = enforceSceneContrast(bases.accent, background, 4.5, lightForeground);
  return {
    text,
    muted,
    accent,
    textShadow: lightForeground
      ? "0 1px 2px rgba(2, 12, 26, 0.92), 0 0 10px rgba(2, 12, 26, 0.72)"
      : "0 1px 1px rgba(255, 255, 255, 0.92), 0 0 9px rgba(255, 255, 255, 0.76)",
    surface: luminance < 0.18
      ? "rgba(249, 252, 255, 0.92)"
      : "rgba(250, 252, 255, 0.88)",
    surfaceText: SURFACE_TEXT,
    surfaceMuted: SURFACE_MUTED,
    background,
    luminance,
    temperature,
  };
}

export function getSkinFallbackPalette(skin: KnowledgeSkin): AdaptiveScenePalette {
  if (skin.id === "classic") {
    return {
      text: skin.sceneText,
      muted: skin.sceneMuted,
      accent: "#c84f24",
      textShadow: "none",
      surface: skin.sceneSurface,
      surfaceText: SURFACE_TEXT,
      surfaceMuted: SURFACE_MUTED,
      background: "#eef1f5",
      luminance: relativeLuminance({ red: 238, green: 241, blue: 245 }),
      temperature: "neutral",
    };
  }
  return {
    ...deriveAdaptiveScenePalette(skin.sceneFallbackRgb),
    surface: skin.sceneSurface,
  };
}

export async function analyzeScenePalette(
  skin: KnowledgeSkin,
): Promise<AdaptiveScenePalette> {
  if (!skin.backgroundUrl || typeof document === "undefined") {
    return getSkinFallbackPalette(skin);
  }
  const image = new Image();
  image.decoding = "async";
  image.src = skin.backgroundUrl;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = 48;
  canvas.height = 48;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("无法分析背景颜色");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let red = 0;
  let green = 0;
  let blue = 0;
  let samples = 0;
  for (let index = 0; index < pixels.length; index += 16) {
    red += pixels[index] ?? 0;
    green += pixels[index + 1] ?? 0;
    blue += pixels[index + 2] ?? 0;
    samples += 1;
  }
  red /= samples;
  green /= samples;
  blue /= samples;
  return deriveAdaptiveScenePalette({ red, green, blue });
}
