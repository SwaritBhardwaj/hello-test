import { useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store';
import { useT } from '../lang';
import { formatINR } from '@/utils/money';
import { PROFESSIONS, startingSalary } from '@/modules/player/career';
import type { ProfessionId } from '@/types';
import { Die } from '../art/Die';
import { Coin } from '../art/Pieces';
import { play } from '../sound/sound';
import { PrimaryButton, Field, TextInput, Select } from './primitives';
import { LanguageToggle } from './HudBar';

export function rollRandomCharacter(): {
  age: number;
  profession: ProfessionId;
  city: 'T1' | 'T2' | 'T3';
  family: 'single' | 'married' | 'married_with_kids';
} {
  const r = Math.random;
  const professionIds = Object.keys(PROFESSIONS) as ProfessionId[];
  const profession = professionIds[Math.floor(r() * professionIds.length)];
  const ageBands: Record<ProfessionId, [number, number]> = {
    sde: [23, 38], product_manager: [26, 42], doctor: [28, 50], teacher: [24, 50],
    ca: [25, 45], designer: [23, 40], sales: [24, 48], govt_clerk: [23, 55], founder: [27, 45],
  };
  const [aMin, aMax] = ageBands[profession];
  const age = aMin + Math.floor(r() * (aMax - aMin + 1));
  const cityRoll = r();
  const city: 'T1' | 'T2' | 'T3' = cityRoll < 0.5 ? 'T1' : cityRoll < 0.8 ? 'T2' : 'T3';
  let family: 'single' | 'married' | 'married_with_kids';
  if (age < 27) family = r() < 0.85 ? 'single' : 'married';
  else if (age < 32) family = r() < 0.45 ? 'single' : r() < 0.7 ? 'married' : 'married_with_kids';
  else family = r() < 0.2 ? 'single' : r() < 0.5 ? 'married' : 'married_with_kids';
  return { age, profession, city, family };
}

// ============================================================
// Setup
// ============================================================
export function SetupScreen() {
  const { t } = useT();
  const initGame = useGameStore((s) => s.initGame);
  const [mode, setMode] = useState<'menu' | 'custom' | 'random'>('menu');
  const [name, setName] = useState('Swarit');
  const [age, setAge] = useState(28);
  const [profession, setProfession] = useState<ProfessionId>('product_manager');
  const [city, setCity] = useState<'T1' | 'T2' | 'T3'>('T1');
  const [family, setFamily] = useState<'single' | 'married' | 'married_with_kids'>('single');

  const yoe = Math.max(0, age - 22);
  const monthlySalary = startingSalary(profession, city, yoe);

  function rollRandom() {
    play('dice');
    const c = rollRandomCharacter();
    setAge(c.age);
    setProfession(c.profession);
    setCity(c.city);
    setFamily(c.family);
    setMode('random');
  }

  function start() {
    play('click');
    initGame({ seed: Math.floor(Math.random() * 1e9), playerName: name, age, profession, city, family });
  }

  return (
    <div className="min-h-[100dvh] felt-table flex items-center justify-center p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 24 }}
        className="paper w-full max-w-md rounded-game shadow-card ring-4 ring-brass/40 overflow-hidden"
      >
        <div className="bg-wood-700 px-6 py-5 flex items-center gap-3 border-b-4 border-brass/50">
          <Die value={5} size={44} />
          <div className="flex-1">
            <h1 className="font-display text-2xl text-card leading-none">Cashflow Reborn</h1>
            <p className="text-xs text-brass-100/80 mt-1">{t('app.tagline')}</p>
          </div>
          <LanguageToggle />
        </div>

        <div className="p-6 space-y-4">
          {mode === 'menu' && (
            <div className="space-y-3">
              <PrimaryButton onClick={rollRandom} className="w-full">
                <span className="flex items-center justify-center gap-2"><Die value={3} size={22} /> {t('setup.rollRandom')}</span>
                <span className="block text-2xs font-normal opacity-80 mt-1">{t('setup.rollRandomSub')}</span>
              </PrimaryButton>
              <button
                onClick={() => { play('click'); setMode('custom'); }}
                className="btn-3d w-full bg-card text-ink px-4 py-3 text-base"
              >
                {t('setup.customise')}
                <span className="block text-2xs font-normal text-ink-soft mt-0.5">{t('setup.customiseSub')}</span>
              </button>
            </div>
          )}

          {mode === 'random' && (
            <>
              <Field label={t('setup.yourName')}>
                <TextInput value={name} onChange={setName} placeholder="e.g. Swarit" autoFocus />
              </Field>
              <div className="rounded-xl bg-income-soft border border-income/30 p-3 text-sm space-y-1">
                <div className="font-display text-income-ink">{t('setup.handDealt')}</div>
                <div className="text-ink-soft">
                  {t('setup.lives', { age, profession: PROFESSIONS[profession].label, city })}, {t(`family.${family}.phrase` as 'family.single.phrase')}.
                </div>
                <div className="text-ink-soft text-xs flex items-center gap-1">
                  {t('setup.monthlySalary')} <Coin size={14} /> <b className="text-ink tnum">{formatINR(monthlySalary)}</b> ({t('setup.yrsExp', { n: yoe })})
                </div>
                <button className="text-xs text-income-ink underline mt-1" onClick={rollRandom}>{t('setup.reroll')}</button>
              </div>
            </>
          )}

          {mode === 'custom' && (
            <div className="space-y-3">
              <Field label={t('setup.name')}><TextInput value={name} onChange={setName} /></Field>
              <Field label={t('setup.age')}>
                <input type="number" className="w-full rounded-lg border border-card-edge p-2 tnum" value={age} onChange={(e) => setAge(+e.target.value)} />
              </Field>
              <Field label={t('setup.profession')}>
                <Select value={profession} onChange={(v) => setProfession(v as ProfessionId)}>
                  {(Object.keys(PROFESSIONS) as ProfessionId[]).map((p) => <option key={p} value={p}>{PROFESSIONS[p].label}</option>)}
                </Select>
              </Field>
              <Field label={t('setup.cityTier')}>
                <Select value={city} onChange={(v) => setCity(v as 'T1' | 'T2' | 'T3')}>
                  <option value="T1">T1 (Mumbai / Delhi / BLR)</option>
                  <option value="T2">T2 (Pune / Jaipur / Indore)</option>
                  <option value="T3">T3 (smaller cities)</option>
                </Select>
              </Field>
              <Field label={t('setup.family')}>
                <Select value={family} onChange={(v) => setFamily(v as typeof family)}>
                  <option value="single">{t('family.single')}</option>
                  <option value="married">{t('family.married')}</option>
                  <option value="married_with_kids">{t('family.married_with_kids')}</option>
                </Select>
              </Field>
              <div className="text-xs text-ink-soft flex items-center gap-1">
                {t('setup.startingSalary')} <Coin size={13} /> <b className="text-ink tnum">{formatINR(monthlySalary)}/mo</b>
              </div>
            </div>
          )}

          {mode !== 'menu' && (
            <div className="flex items-center gap-2 pt-1">
              <button onClick={() => setMode('menu')} className="text-xs text-ink-faint hover:text-ink px-2 py-2">{t('setup.back')}</button>
              <PrimaryButton onClick={start} disabled={!name.trim()} className="flex-1">{t('setup.start')}</PrimaryButton>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
