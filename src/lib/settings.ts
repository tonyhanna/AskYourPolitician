import { db } from "@/db";
import { appSettings } from "@/db/schema";

const DEFAULTS: Record<string, string> = {
  colorBg0: "#FFFFFF",
  colorBg0Dark: "#000000",
  colorBg0Contrast: "#000000",
  colorBg0ContrastDark: "#FFFFFF",
  colorBg1: "#F6F6F5",
  colorBg1Dark: "#202020",
  colorBg2: "#000000",
  colorBg2Dark: "#000000",
  colorText0: "#000000",
  colorText0Dark: "#000000",
  colorText0Contrast: "#FFFFFF",
  colorText0ContrastDark: "#000000",
  colorText1: "#000000",
  colorText1Dark: "#000000",
  colorText2: "#000000",
  colorText2Dark: "#000000",
  colorText3: "#000000",
  colorText3Dark: "#000000",
  colorIcon0: "#000000",
  colorIcon0Dark: "#000000",
  colorIcon0Contrast: "#FFFFFF",
  colorIcon0ContrastDark: "#000000",
  colorIcon1: "#000000",
  colorIcon1Dark: "#000000",
  colorIcon2: "#000000",
  colorIcon2Dark: "#000000",
  colorIcon3: "#000000",
  colorIcon3Dark: "#000000",
  colorAccent0: "#000000",
  colorAccent0Dark: "#000000",
  colorAccent0Contrast: "#FFFFFF",
  colorAccent0ContrastDark: "#000000",
  colorAccent1: "#000000",
  colorAccent1Dark: "#000000",
  colorAccent1Contrast: "#FFFFFF",
  colorAccent1ContrastDark: "#000000",
  colorSuccess: "#98CA6D",
  colorSuccessDark: "#98CA6D",
  colorSuccessContrast: "#FFFFFF",
  colorSuccessContrastDark: "#000000",
  colorPending: "#FFC904",
  colorPendingDark: "#FFC904",
  colorPendingContrast: "#000000",
  colorPendingContrastDark: "#FFFFFF",
  colorError: "#FF4105",
  colorErrorDark: "#FF4105",
  colorErrorContrast: "#FFFFFF",
  colorErrorContrastDark: "#000000",
  colorOverlay: "#000000",
  colorOverlayDark: "#000000",
};

export type AppSettings = {
  colorBg0: string;
  colorBg0Dark: string;
  colorBg0Contrast: string;
  colorBg0ContrastDark: string;
  colorBg1: string;
  colorBg1Dark: string;
  colorBg2: string;
  colorBg2Dark: string;
  colorText0: string;
  colorText0Dark: string;
  colorText0Contrast: string;
  colorText0ContrastDark: string;
  colorText1: string;
  colorText1Dark: string;
  colorText2: string;
  colorText2Dark: string;
  colorText3: string;
  colorText3Dark: string;
  colorIcon0: string;
  colorIcon0Dark: string;
  colorIcon0Contrast: string;
  colorIcon0ContrastDark: string;
  colorIcon1: string;
  colorIcon1Dark: string;
  colorIcon2: string;
  colorIcon2Dark: string;
  colorIcon3: string;
  colorIcon3Dark: string;
  colorAccent0: string;
  colorAccent0Dark: string;
  colorAccent0Contrast: string;
  colorAccent0ContrastDark: string;
  colorAccent1: string;
  colorAccent1Dark: string;
  colorAccent1Contrast: string;
  colorAccent1ContrastDark: string;
  colorSuccess: string;
  colorSuccessDark: string;
  colorSuccessContrast: string;
  colorSuccessContrastDark: string;
  colorPending: string;
  colorPendingDark: string;
  colorPendingContrast: string;
  colorPendingContrastDark: string;
  colorError: string;
  colorErrorDark: string;
  colorErrorContrast: string;
  colorErrorContrastDark: string;
  colorOverlay: string;
  colorOverlayDark: string;
};

export async function getAppSettings(): Promise<AppSettings> {
  const rows = await db.select().from(appSettings);
  const map = new Map(rows.map((r) => [r.key, r.value]));

  return {
    colorBg0: map.get("colorBg0") || DEFAULTS.colorBg0,
    colorBg0Dark: map.get("colorBg0Dark") || DEFAULTS.colorBg0Dark,
    colorBg0Contrast: map.get("colorBg0Contrast") || DEFAULTS.colorBg0Contrast,
    colorBg0ContrastDark: map.get("colorBg0ContrastDark") || DEFAULTS.colorBg0ContrastDark,
    colorBg1: map.get("colorBg1") || DEFAULTS.colorBg1,
    colorBg1Dark: map.get("colorBg1Dark") || DEFAULTS.colorBg1Dark,
    colorBg2: map.get("colorBg2") || DEFAULTS.colorBg2,
    colorBg2Dark: map.get("colorBg2Dark") || DEFAULTS.colorBg2Dark,
    colorText0: map.get("colorText0") || DEFAULTS.colorText0,
    colorText0Dark: map.get("colorText0Dark") || DEFAULTS.colorText0Dark,
    colorText0Contrast: map.get("colorText0Contrast") || DEFAULTS.colorText0Contrast,
    colorText0ContrastDark: map.get("colorText0ContrastDark") || DEFAULTS.colorText0ContrastDark,
    colorText1: map.get("colorText1") || DEFAULTS.colorText1,
    colorText1Dark: map.get("colorText1Dark") || DEFAULTS.colorText1Dark,
    colorText2: map.get("colorText2") || DEFAULTS.colorText2,
    colorText2Dark: map.get("colorText2Dark") || DEFAULTS.colorText2Dark,
    colorText3: map.get("colorText3") || DEFAULTS.colorText3,
    colorText3Dark: map.get("colorText3Dark") || DEFAULTS.colorText3Dark,
    colorIcon0: map.get("colorIcon0") || DEFAULTS.colorIcon0,
    colorIcon0Dark: map.get("colorIcon0Dark") || DEFAULTS.colorIcon0Dark,
    colorIcon0Contrast: map.get("colorIcon0Contrast") || DEFAULTS.colorIcon0Contrast,
    colorIcon0ContrastDark: map.get("colorIcon0ContrastDark") || DEFAULTS.colorIcon0ContrastDark,
    colorIcon1: map.get("colorIcon1") || DEFAULTS.colorIcon1,
    colorIcon1Dark: map.get("colorIcon1Dark") || DEFAULTS.colorIcon1Dark,
    colorIcon2: map.get("colorIcon2") || DEFAULTS.colorIcon2,
    colorIcon2Dark: map.get("colorIcon2Dark") || DEFAULTS.colorIcon2Dark,
    colorIcon3: map.get("colorIcon3") || DEFAULTS.colorIcon3,
    colorIcon3Dark: map.get("colorIcon3Dark") || DEFAULTS.colorIcon3Dark,
    colorAccent0: map.get("colorAccent0") || DEFAULTS.colorAccent0,
    colorAccent0Dark: map.get("colorAccent0Dark") || DEFAULTS.colorAccent0Dark,
    colorAccent0Contrast: map.get("colorAccent0Contrast") || DEFAULTS.colorAccent0Contrast,
    colorAccent0ContrastDark: map.get("colorAccent0ContrastDark") || DEFAULTS.colorAccent0ContrastDark,
    colorAccent1: map.get("colorAccent1") || DEFAULTS.colorAccent1,
    colorAccent1Dark: map.get("colorAccent1Dark") || DEFAULTS.colorAccent1Dark,
    colorAccent1Contrast: map.get("colorAccent1Contrast") || DEFAULTS.colorAccent1Contrast,
    colorAccent1ContrastDark: map.get("colorAccent1ContrastDark") || DEFAULTS.colorAccent1ContrastDark,
    colorSuccess: map.get("colorSuccess") || DEFAULTS.colorSuccess,
    colorSuccessDark: map.get("colorSuccessDark") || DEFAULTS.colorSuccessDark,
    colorSuccessContrast: map.get("colorSuccessContrast") || DEFAULTS.colorSuccessContrast,
    colorSuccessContrastDark: map.get("colorSuccessContrastDark") || DEFAULTS.colorSuccessContrastDark,
    colorPending: map.get("colorPending") || DEFAULTS.colorPending,
    colorPendingDark: map.get("colorPendingDark") || DEFAULTS.colorPendingDark,
    colorPendingContrast: map.get("colorPendingContrast") || DEFAULTS.colorPendingContrast,
    colorPendingContrastDark: map.get("colorPendingContrastDark") || DEFAULTS.colorPendingContrastDark,
    colorError: map.get("colorError") || DEFAULTS.colorError,
    colorErrorDark: map.get("colorErrorDark") || DEFAULTS.colorErrorDark,
    colorErrorContrast: map.get("colorErrorContrast") || DEFAULTS.colorErrorContrast,
    colorErrorContrastDark: map.get("colorErrorContrastDark") || DEFAULTS.colorErrorContrastDark,
    colorOverlay: map.get("colorOverlay") || DEFAULTS.colorOverlay,
    colorOverlayDark: map.get("colorOverlayDark") || DEFAULTS.colorOverlayDark,
  };
}
