import { Sheet } from "./Sheet.js";
import { Glyph } from "../lib/glyphs.js";
import { CheckIcon } from "../lib/icons.js";
import type { Soundscape } from "../lib/types.js";

/** Bottom sheet grid for choosing a soundscape. */
export function SoundscapePicker({
  open,
  onClose,
  soundscapes,
  selectedId,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  soundscapes: Soundscape[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Soundscapes">
      <div className="grid grid-cols-2 gap-3">
        {soundscapes.map((s) => {
          const active = s.id === selectedId;
          return (
            <button
              key={s.id}
              onClick={() => {
                onSelect(s.id);
                onClose();
              }}
              className={`relative flex flex-col items-start gap-3 overflow-hidden rounded-3xl border p-4 text-left transition active:scale-[0.97] ${
                active
                  ? "border-white/25 bg-white/[0.08]"
                  : "border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.06]"
              }`}
            >
              <span
                className="absolute -right-6 -top-6 h-20 w-20 rounded-full blur-2xl"
                style={{ backgroundColor: s.color, opacity: active ? 0.5 : 0.25 }}
              />
              <span
                className="relative flex h-11 w-11 items-center justify-center rounded-2xl"
                style={{ backgroundColor: `${s.color}22`, color: s.color }}
              >
                <Glyph icon={s.icon} className="h-6 w-6" />
              </span>
              <span className="relative">
                <span className="flex items-center gap-1.5 text-[15px] font-semibold text-white">
                  {s.name}
                  {active && <CheckIcon className="h-4 w-4 text-accent" />}
                </span>
                <span className="text-[12px] text-zinc-400">{s.description}</span>
              </span>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
