export const clamp01 = (x) => Math.max(0, Math.min(1, x))
export const ramp = (p, a, b) => clamp01((p - a) / (b - a))
export const bell = (p, r0, r1, f0, f1) => Math.min(ramp(p, r0, r1), 1 - ramp(p, f0, f1))
