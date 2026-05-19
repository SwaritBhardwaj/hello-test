import type { GameState, ProfessionId, Player } from '@/types';
import type { PRNG } from '@/engine/prng/prng';

/**
 * Profession-specific salary curves.
 * baseSalaryMonthly: starting salary at experience=0
 * salaryCAGR: annual real growth rate (stochastic around this)
 * promotionEveryYears: average years between promotions
 * promotionBumpRange: [min, max] one-time bump on promotion
 * layoffProbability: monthly probability of layoff
 */
export interface ProfessionProfile {
  id: ProfessionId;
  label: string;
  baseSalaryMonthly: number;
  salaryCAGR: number;
  promotionEveryYears: number;
  promotionBumpRange: [number, number];
  layoffProbability: number;
  cityMultiplier: { T1: number; T2: number; T3: number };
}

// TODO: expand to 25-40 professions in /data/professions.ts
export const PROFESSIONS: Record<ProfessionId, ProfessionProfile> = {
  sde:             { id: 'sde',             label: 'Software Engineer',  baseSalaryMonthly: 80_000, salaryCAGR: 0.10, promotionEveryYears: 3, promotionBumpRange: [0.15, 0.30], layoffProbability: 0.0015, cityMultiplier: { T1: 1.0, T2: 0.7, T3: 0.5 } },
  doctor:          { id: 'doctor',          label: 'Doctor',             baseSalaryMonthly: 60_000, salaryCAGR: 0.08, promotionEveryYears: 5, promotionBumpRange: [0.10, 0.25], layoffProbability: 0.0002, cityMultiplier: { T1: 1.0, T2: 0.85, T3: 0.7 } },
  product_manager: { id: 'product_manager', label: 'Product Manager',    baseSalaryMonthly: 100_000, salaryCAGR: 0.11, promotionEveryYears: 3, promotionBumpRange: [0.18, 0.35], layoffProbability: 0.002,  cityMultiplier: { T1: 1.0, T2: 0.7, T3: 0.5 } },
  teacher:         { id: 'teacher',         label: 'Teacher',            baseSalaryMonthly: 35_000, salaryCAGR: 0.05, promotionEveryYears: 5, promotionBumpRange: [0.08, 0.15], layoffProbability: 0.0008, cityMultiplier: { T1: 1.0, T2: 0.9, T3: 0.8 } },
  ca:              { id: 'ca',              label: 'Chartered Accountant', baseSalaryMonthly: 70_000, salaryCAGR: 0.09, promotionEveryYears: 4, promotionBumpRange: [0.12, 0.25], layoffProbability: 0.001, cityMultiplier: { T1: 1.0, T2: 0.8, T3: 0.65 } },
  designer:        { id: 'designer',        label: 'Designer',           baseSalaryMonthly: 65_000, salaryCAGR: 0.09, promotionEveryYears: 3, promotionBumpRange: [0.12, 0.25], layoffProbability: 0.002, cityMultiplier: { T1: 1.0, T2: 0.7, T3: 0.55 } },
  sales:           { id: 'sales',           label: 'Sales (B2B)',        baseSalaryMonthly: 55_000, salaryCAGR: 0.08, promotionEveryYears: 3, promotionBumpRange: [0.10, 0.30], layoffProbability: 0.0035, cityMultiplier: { T1: 1.0, T2: 0.8, T3: 0.65 } },
  govt_clerk:      { id: 'govt_clerk',      label: 'Govt Employee',      baseSalaryMonthly: 40_000, salaryCAGR: 0.06, promotionEveryYears: 6, promotionBumpRange: [0.08, 0.12], layoffProbability: 0,     cityMultiplier: { T1: 1.0, T2: 0.95, T3: 0.9 } },
  founder:         { id: 'founder',         label: 'Founder',            baseSalaryMonthly: 40_000, salaryCAGR: 0.15, promotionEveryYears: 99, promotionBumpRange: [0, 0], layoffProbability: 0.004,    cityMultiplier: { T1: 1.0, T2: 0.85, T3: 0.7 } },
};

export function buildInitialPlayer(opts: {
  name: string;
  age: number;
  profession: ProfessionId;
  city: 'T1' | 'T2' | 'T3';
  family: 'single' | 'married' | 'married_with_kids';
}): Player {
  return {
    name: opts.name,
    age: opts.age,
    ageInMonths: opts.age * 12,
    profession: opts.profession,
    city: opts.city,
    family: opts.family,
    dependents: [], // TODO: build from family status
    yearsOfExperience: Math.max(0, opts.age - 22),
  };
}

/** Compute starting monthly salary for a player profile. */
export function startingSalary(profession: ProfessionId, city: 'T1' | 'T2' | 'T3', yoe: number): number {
  const profile = PROFESSIONS[profession];
  const yoeBump = 1 + profile.salaryCAGR * yoe;
  return Math.round(profile.baseSalaryMonthly * profile.cityMultiplier[city] * yoeBump);
}

/**
 * Per-tick career update.
 * Mutates state in place. Called by tick orchestrator.
 *
 * TODO:
 *  - apply base monthly salary drift (CAGR/12 + gaussian noise)
 *  - sample promotion event
 *  - sample layoff event
 *  - update yearsOfExperience every 12 ticks
 */
export function applyCareerTick(state: GameState, _rng: PRNG): void {
  // Increment age
  state.player.ageInMonths += 1;
  // STUB: implement salary drift, promotions, layoffs
}
