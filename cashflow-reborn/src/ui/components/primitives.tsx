import { motion } from 'framer-motion';

// ============================================================
// Shared primitives
// ============================================================
export function ModalShell({ children, onClose, center, align, labelledBy }: { children: React.ReactNode; onClose?: () => void; center?: boolean; align?: 'end'; labelledBy?: string }) {
  const justify = align === 'end' ? 'justify-end' : center ? 'justify-center' : 'justify-center';
  const items = center ? 'items-center' : 'items-end sm:items-center';
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className={`fixed inset-0 z-50 flex ${items} ${justify} p-0 sm:p-4`}
      style={{ background: 'oklch(0.14 0.04 158 / 0.93)' }}
      onClick={onClose}
      role="dialog" aria-modal="true" aria-labelledby={labelledBy}
    >
      {align === 'end' ? children : <div className="w-full flex justify-center" onClick={onClose}><div onClick={(e) => e.stopPropagation()} className="w-full flex justify-center">{children}</div></div>}
    </motion.div>
  );
}

export function PrimaryButton({ children, onClick, disabled, className = '' }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; className?: string }) {
  return (
    <button onClick={onClick} disabled={disabled} className={`btn-3d bg-brass-500 enabled:hover:bg-brass-600 text-wood-900 px-4 py-3 ${className}`}>{children}</button>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-sm font-display text-ink-soft">{label}</span><div className="mt-1">{children}</div></label>;
}

export function TextInput({ value, onChange, placeholder, autoFocus }: { value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean }) {
  return <input className="w-full rounded-lg border border-card-edge p-2.5 focus:outline-none focus:ring-2 focus:ring-brass/50" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoFocus={autoFocus} />;
}

export function Select({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return <select className="w-full rounded-lg border border-card-edge p-2.5 bg-card focus:outline-none focus:ring-2 focus:ring-brass/50" value={value} onChange={(e) => onChange(e.target.value)}>{children}</select>;
}

export function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return <div className={`flex justify-between text-sm ${bold ? 'font-bold border-t border-card-edge pt-1 mt-1' : ''}`}><span className="text-ink-soft">{label}</span><span className="font-mono tnum">{value}</span></div>;
}
