// ============================================================
// PANDU — Avatar System
// ============================================================

'use client';

const AVATAR_COLORS = [
  ['#f43f5e', '#fb923c'],  // Rose → Orange
  ['#8b5cf6', '#ec4899'],  // Violet → Pink
  ['#06b6d4', '#3b82f6'],  // Cyan → Blue
  ['#10b981', '#06b6d4'],  // Emerald → Cyan
  ['#f59e0b', '#ef4444'],  // Amber → Red
  ['#6366f1', '#8b5cf6'],  // Indigo → Violet
  ['#14b8a6', '#10b981'],  // Teal → Emerald
  ['#e11d48', '#9333ea'],  // Rose → Purple
  ['#f97316', '#eab308'],  // Orange → Yellow
  ['#0ea5e9', '#6366f1'],  // Sky → Indigo
  ['#d946ef', '#f43f5e'],  // Fuchsia → Rose
  ['#84cc16', '#22c55e'],  // Lime → Green
  ['#2dd4bf', '#3b82f6'],  // Teal → Blue
  ['#fb7185', '#c084fc'],  // Pink → Purple
  ['#fbbf24', '#f97316'],  // Yellow → Orange
  ['#a78bfa', '#38bdf8'],  // Purple → Sky
];

const AVATAR_EMOJIS = [
  '🦊', '🐼', '🦁', '🐯',
  '🦄', '🐲', '🦅', '🐺',
  '🦋', '🐬', '🦚', '🐙',
  '🦝', '🐨', '🦈', '🐢',
];

export function Avatar({
  avatarId,
  size = 48,
  selected,
  onClick,
}: {
  avatarId: number;
  size?: number;
  selected?: boolean;
  onClick?: () => void;
}) {
  const idx = avatarId % AVATAR_COLORS.length;
  const colors = AVATAR_COLORS[idx];
  const emoji = AVATAR_EMOJIS[idx];

  return (
    <div
      className={`relative rounded-full flex items-center justify-center cursor-pointer transition-all duration-200 ${
        selected ? 'ring-3 ring-amber-400 scale-110' : ''
      }`}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`,
        fontSize: size * 0.45,
        boxShadow: selected ? `0 0 20px ${colors[0]}50` : `0 2px 8px ${colors[0]}30`,
      }}
      onClick={onClick}
    >
      {emoji}
    </div>
  );
}

export function AvatarPicker({
  selectedId,
  onSelect,
}: {
  selectedId: number;
  onSelect: (id: number) => void;
}) {
  return (
    <div className="grid grid-cols-8 gap-2">
      {AVATAR_EMOJIS.map((_, i) => (
        <Avatar
          key={i}
          avatarId={i}
          size={44}
          selected={selectedId === i}
          onClick={() => onSelect(i)}
        />
      ))}
    </div>
  );
}
