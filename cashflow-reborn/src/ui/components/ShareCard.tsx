import { useEffect, useRef, useState } from 'react';
import { formatINR } from '@/utils/money';
import { PROFESSIONS } from '@/modules/player/career';
import type { ProfessionId } from '@/types';
import type { Grade } from '@/modules/progression/score';
import { play } from '../sound/sound';
import { PrimaryButton } from './primitives';

// ============================================================
// Share card — share text + a 640×360 canvas result card.
// Used by OutcomeModal; all canvas drawing lives here.
// ============================================================

export const SHARE_URL = 'https://swaritbhardwaj.github.io/cashflow-reborn/';

export interface ShareResultData {
  won: boolean;
  playerName: string;
  profession: ProfessionId;
  netWorth: number;
  /** total months survived / to escape */
  months: number;
  grade: Grade;
}

export function buildShareText(d: ShareResultData): string {
  const y = Math.floor(d.months / 12);
  const m = d.months % 12;
  const span = `${y}y ${m}m`;
  const professionLabel = PROFESSIONS[d.profession]?.label ?? d.profession;
  const outcome = d.won ? `Escaped the rat race in ${span}` : `Went bankrupt after ${span}`;
  return `🎲 Cashflow Reborn — ${outcome} as a ${professionLabel}. Net worth ${formatINR(d.netWorth, { compact: true })}. Grade ${d.grade}. Can you beat me? ${SHARE_URL}`;
}

/** Draw the 640×360 result card: felt-green table, brass border, big grade. */
export function drawShareCard(d: ShareResultData): HTMLCanvasElement {
  const W = 640;
  const H = 360;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // Felt-green background with a subtle radial vignette
  const bg = ctx.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, 460);
  bg.addColorStop(0, '#1d5c3d');
  bg.addColorStop(1, '#0e3522');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Brass double border
  ctx.strokeStyle = '#c9a227';
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, W - 16, H - 16);
  ctx.strokeStyle = 'rgba(201, 162, 39, 0.45)';
  ctx.lineWidth = 2;
  ctx.strokeRect(18, 18, W - 36, H - 36);

  const cream = '#f4ead2';
  const brass = '#e0bd4f';

  // App title
  ctx.fillStyle = brass;
  ctx.font = 'bold 22px Georgia, serif';
  ctx.textAlign = 'left';
  ctx.fillText('🎲 CASHFLOW REBORN', 40, 60);

  // Outcome line
  const y = Math.floor(d.months / 12);
  const m = d.months % 12;
  ctx.fillStyle = cream;
  ctx.font = 'bold 26px Georgia, serif';
  ctx.fillText(d.won ? 'ESCAPED THE RAT RACE' : 'WENT BANKRUPT', 40, 110);

  // Big grade letter in a brass roundel, right side
  const gx = W - 130;
  const gy = H / 2;
  ctx.beginPath();
  ctx.arc(gx, gy, 78, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#c9a227';
  ctx.stroke();
  ctx.fillStyle = d.won ? brass : '#e07b6a';
  ctx.font = 'bold 92px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(d.grade, gx, gy + 6);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  // Name / profession line
  const professionLabel = PROFESSIONS[d.profession]?.label ?? d.profession;
  ctx.fillStyle = cream;
  ctx.font = '20px Georgia, serif';
  ctx.fillText(`${d.playerName} · ${professionLabel}`, 40, 160);

  // Stats
  ctx.fillStyle = 'rgba(244, 234, 210, 0.75)';
  ctx.font = '16px Georgia, serif';
  ctx.fillText('NET WORTH', 40, 215);
  ctx.fillText('TIME', 40, 280);
  ctx.fillStyle = cream;
  ctx.font = 'bold 30px Georgia, serif';
  ctx.fillText(formatINR(d.netWorth, { compact: true }), 40, 248);
  ctx.fillText(`${y}y ${m}m`, 40, 313);

  // Footer
  ctx.fillStyle = 'rgba(224, 189, 79, 0.85)';
  ctx.font = '14px Georgia, serif';
  ctx.textAlign = 'right';
  ctx.fillText('Can you beat me? — swaritbhardwaj.github.io/cashflow-reborn', W - 32, H - 32);
  ctx.textAlign = 'left';

  return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

/** "Share result" button + PNG download fallback. Rendered inside OutcomeModal. */
export function ShareResult({ data }: { data: ShareResultData }) {
  const [copied, setCopied] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const canFileShare = useRef(false);

  // Pre-render the PNG; if file-sharing is unsupported, expose it as a download.
  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    (async () => {
      try {
        const blob = await canvasToBlob(drawShareCard(data));
        if (!blob || cancelled) return;
        const file = new File([blob], 'cashflow-reborn-result.png', { type: 'image/png' });
        canFileShare.current = typeof navigator !== 'undefined'
          && !!navigator.canShare && navigator.canShare({ files: [file] });
        if (!canFileShare.current) {
          url = URL.createObjectURL(blob);
          setDownloadUrl(url);
        }
      } catch {
        /* canvas unavailable — text share still works */
      }
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
    // The result is final once the modal shows; draw once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleShare() {
    play('click');
    const text = buildShareText(data);
    try {
      if (typeof navigator.share === 'function') {
        if (canFileShare.current) {
          const blob = await canvasToBlob(drawShareCard(data));
          if (blob) {
            const file = new File([blob], 'cashflow-reborn-result.png', { type: 'image/png' });
            await navigator.share({ text, files: [file] });
            return;
          }
        }
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // user cancelled the share sheet, or clipboard denied — try the clipboard once more quietly
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2200);
      } catch { /* give up silently */ }
    }
  }

  return (
    <div className="space-y-1.5">
      <PrimaryButton onClick={handleShare} className="w-full">
        {copied ? 'Copied!' : 'Share result'}
      </PrimaryButton>
      {downloadUrl && (
        <a
          href={downloadUrl}
          download="cashflow-reborn-result.png"
          className="block text-center text-xs text-brass-600 underline underline-offset-2 hover:text-brass-500"
        >
          Download result card (PNG)
        </a>
      )}
    </div>
  );
}
