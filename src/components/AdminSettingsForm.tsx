"use client";

import React, { useState } from "react";
import { updateAppSettings } from "@/app/admin/actions";

type Props = {
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
  colorFormBg0: string;
  colorFormBg0Dark: string;
  colorFormBg1: string;
  colorFormBg1Dark: string;
  colorFormText0: string;
  colorFormText0Dark: string;
  colorFormText1: string;
  colorFormText1Dark: string;
};

function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex-1 min-w-0">
      <span className="block text-xs text-gray-500 mb-1">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-8 rounded border border-gray-300 cursor-pointer flex-shrink-0"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 min-w-0 border border-gray-300 rounded-lg px-2 py-1.5 text-sm font-mono"
          pattern="^#[0-9a-fA-F]{6}$"
          maxLength={7}
        />
      </div>
    </div>
  );
}

function ColorRow({ label, lightValue, darkValue, onLightChange, onDarkChange }: {
  label: string;
  lightValue: string;
  darkValue: string;
  onLightChange: (v: string) => void;
  onDarkChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <div className="flex gap-4">
        <ColorPicker label="Light" value={lightValue} onChange={onLightChange} />
        <ColorPicker label="Dark" value={darkValue} onChange={onDarkChange} />
      </div>
    </div>
  );
}

function ColorRowWithSub({
  label, lightValue, darkValue, onLightChange, onDarkChange,
  subLabel, subLightValue, subDarkValue, onSubLightChange, onSubDarkChange,
}: {
  label: string; lightValue: string; darkValue: string; onLightChange: (v: string) => void; onDarkChange: (v: string) => void;
  subLabel: string; subLightValue: string; subDarkValue: string; onSubLightChange: (v: string) => void; onSubDarkChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <ColorRow label={label} lightValue={lightValue} darkValue={darkValue} onLightChange={onLightChange} onDarkChange={onDarkChange} />
      <button type="button" onClick={() => setOpen(!open)} className="text-xs text-gray-400 hover:text-gray-600 mt-1 cursor-pointer transition-colors">
        {open ? "▾" : "▸"} {subLabel}
      </button>
      {open && (
        <div className="mt-2 pl-3 border-l-2 border-gray-200">
          <ColorRow label={subLabel} lightValue={subLightValue} darkValue={subDarkValue} onLightChange={onSubLightChange} onDarkChange={onSubDarkChange} />
        </div>
      )}
    </div>
  );
}

export function AdminSettingsForm(initial: Props) {
  const [colors, setColors] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const set = (key: keyof Props) => (value: string) =>
    setColors((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);

    const formData = new FormData();
    for (const [key, value] of Object.entries(colors)) {
      formData.set(key, value);
    }

    await updateAppSettings(formData);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">Systemfarver</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-5">
        {/* Left column: Baggrund, Tekst, Ikon */}
        <div className="space-y-5">
          <ColorRowWithSub
            label="Baggrund 0" lightValue={colors.colorBg0} darkValue={colors.colorBg0Dark} onLightChange={set("colorBg0")} onDarkChange={set("colorBg0Dark")}
            subLabel="Kontrastfarve" subLightValue={colors.colorBg0Contrast} subDarkValue={colors.colorBg0ContrastDark} onSubLightChange={set("colorBg0Contrast")} onSubDarkChange={set("colorBg0ContrastDark")}
          />
          <ColorRow label="Baggrund 1" lightValue={colors.colorBg1} darkValue={colors.colorBg1Dark} onLightChange={set("colorBg1")} onDarkChange={set("colorBg1Dark")} />
          <ColorRow label="Baggrund 2" lightValue={colors.colorBg2} darkValue={colors.colorBg2Dark} onLightChange={set("colorBg2")} onDarkChange={set("colorBg2Dark")} />
          {[0, 1, 2, 3].map((i) => (
            <React.Fragment key={`text${i}`}>
              {i === 0 ? (
                <ColorRowWithSub
                  label="Tekst 0" lightValue={colors.colorText0} darkValue={colors.colorText0Dark} onLightChange={set("colorText0")} onDarkChange={set("colorText0Dark")}
                  subLabel="Kontrastfarve" subLightValue={colors.colorText0Contrast} subDarkValue={colors.colorText0ContrastDark} onSubLightChange={set("colorText0Contrast")} onSubDarkChange={set("colorText0ContrastDark")}
                />
              ) : (
                <ColorRow label={`Tekst ${i}`} lightValue={colors[`colorText${i}` as keyof Props]} darkValue={colors[`colorText${i}Dark` as keyof Props]} onLightChange={set(`colorText${i}` as keyof Props)} onDarkChange={set(`colorText${i}Dark` as keyof Props)} />
              )}
            </React.Fragment>
          ))}
          {[0, 1, 2, 3].map((i) => (
            <React.Fragment key={`icon${i}`}>
              {i === 0 ? (
                <ColorRowWithSub
                  label="Ikon 0" lightValue={colors.colorIcon0} darkValue={colors.colorIcon0Dark} onLightChange={set("colorIcon0")} onDarkChange={set("colorIcon0Dark")}
                  subLabel="Kontrastfarve" subLightValue={colors.colorIcon0Contrast} subDarkValue={colors.colorIcon0ContrastDark} onSubLightChange={set("colorIcon0Contrast")} onSubDarkChange={set("colorIcon0ContrastDark")}
                />
              ) : (
                <ColorRow label={`Ikon ${i}`} lightValue={colors[`colorIcon${i}` as keyof Props]} darkValue={colors[`colorIcon${i}Dark` as keyof Props]} onLightChange={set(`colorIcon${i}` as keyof Props)} onDarkChange={set(`colorIcon${i}Dark` as keyof Props)} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Right column: Accent, Succes, Afventende, Alarmerende */}
        <div className="space-y-5">
          {[0, 1].map((i) => (
            <ColorRowWithSub
              key={`accent${i}`}
              label={`Accent ${i}`} lightValue={colors[`colorAccent${i}` as keyof Props]} darkValue={colors[`colorAccent${i}Dark` as keyof Props]} onLightChange={set(`colorAccent${i}` as keyof Props)} onDarkChange={set(`colorAccent${i}Dark` as keyof Props)}
              subLabel="Kontrastfarve" subLightValue={colors[`colorAccent${i}Contrast` as keyof Props]} subDarkValue={colors[`colorAccent${i}ContrastDark` as keyof Props]} onSubLightChange={set(`colorAccent${i}Contrast` as keyof Props)} onSubDarkChange={set(`colorAccent${i}ContrastDark` as keyof Props)}
            />
          ))}
          <ColorRowWithSub
            label="Succes" lightValue={colors.colorSuccess} darkValue={colors.colorSuccessDark} onLightChange={set("colorSuccess")} onDarkChange={set("colorSuccessDark")}
            subLabel="Kontrastfarve" subLightValue={colors.colorSuccessContrast} subDarkValue={colors.colorSuccessContrastDark} onSubLightChange={set("colorSuccessContrast")} onSubDarkChange={set("colorSuccessContrastDark")}
          />
          <ColorRowWithSub
            label="Afventende" lightValue={colors.colorPending} darkValue={colors.colorPendingDark} onLightChange={set("colorPending")} onDarkChange={set("colorPendingDark")}
            subLabel="Kontrastfarve" subLightValue={colors.colorPendingContrast} subDarkValue={colors.colorPendingContrastDark} onSubLightChange={set("colorPendingContrast")} onSubDarkChange={set("colorPendingContrastDark")}
          />
          <ColorRowWithSub
            label="Alarmerende" lightValue={colors.colorError} darkValue={colors.colorErrorDark} onLightChange={set("colorError")} onDarkChange={set("colorErrorDark")}
            subLabel="Kontrastfarve" subLightValue={colors.colorErrorContrast} subDarkValue={colors.colorErrorContrastDark} onSubLightChange={set("colorErrorContrast")} onSubDarkChange={set("colorErrorContrastDark")}
          />
          <ColorRow label="Mørkt overlag" lightValue={colors.colorOverlay} darkValue={colors.colorOverlayDark} onLightChange={set("colorOverlay")} onDarkChange={set("colorOverlayDark")} />

          <ColorRow label="Formular baggrund 0" lightValue={colors.colorFormBg0} darkValue={colors.colorFormBg0Dark} onLightChange={set("colorFormBg0")} onDarkChange={set("colorFormBg0Dark")} />
          <ColorRow label="Formular baggrund 1" lightValue={colors.colorFormBg1} darkValue={colors.colorFormBg1Dark} onLightChange={set("colorFormBg1")} onDarkChange={set("colorFormBg1Dark")} />
          <ColorRow label="Formular tekst 0" lightValue={colors.colorFormText0} darkValue={colors.colorFormText0Dark} onLightChange={set("colorFormText0")} onDarkChange={set("colorFormText0Dark")} />
          <ColorRow label="Formular tekst 1" lightValue={colors.colorFormText1} darkValue={colors.colorFormText1Dark} onLightChange={set("colorFormText1")} onDarkChange={set("colorFormText1Dark")} />
        </div>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50 cursor-pointer"
      >
        {saving ? "Gemmer..." : saved ? "Gemt ✓" : "Gem indstillinger"}
      </button>
    </form>
  );
}
