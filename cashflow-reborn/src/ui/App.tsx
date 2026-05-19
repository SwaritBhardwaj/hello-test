import { useState } from 'react';
import { useGameStore } from './store';
import { formatINR, formatPct } from '@/utils/money';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import type { ProfessionId } from '@/types';

export default function App() {
  const state = useGameStore((s) => s.state);
  if (!state) return <SetupScreen />;
  return <Dashboard />;
}

function SetupScreen() {
  const initGame = useGameStore((s) => s.initGame);
  const [name, setName] = useState('Swarit');
  const [age, setAge] = useState(28);
  const [profession, setProfession] = useState<ProfessionId>('product_manager');
  const [city, setCity] = useState<'T1' | 'T2' | 'T3'>('T1');
  const [family, setFamily] = useState<'single' | 'married' | 'married_with_kids'>('single');

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="bg-white p-8 rounded-2xl shadow w-full max-w-md space-y-4">
        <h1 className="text-2xl font-bold">Cashflow Reborn</h1>
        <p className="text-sm text-slate-600">Set up your run.</p>
        <Field label="Name"><input className="border rounded p-2 w-full" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Age"><input type="number" className="border rounded p-2 w-full" value={age} onChange={(e) => setAge(+e.target.value)} /></Field>
        <Field label="Profession">
          <select className="border rounded p-2 w-full" value={profession} onChange={(e) => setProfession(e.target.value as ProfessionId)}>
            <option value="sde">Software Engineer</option>
            <option value="product_manager">Product Manager</option>
            <option value="doctor">Doctor</option>
            <option value="ca">Chartered Accountant</option>
            <option value="teacher">Teacher</option>
            <option value="designer">Designer</option>
            <option value="sales">Sales</option>
            <option value="govt_clerk">Govt Employee</option>
            <option value="founder">Founder</option>
          </select>
        </Field>
        <Field label="City Tier">
          <select className="border rounded p-2 w-full" value={city} onChange={(e) => setCity(e.target.value as 'T1' | 'T2' | 'T3')}>
            <option value="T1">T1 (Mumbai/Delhi/BLR)</option>
            <option value="T2">T2 (Pune/Jaipur/Indore)</option>
            <option value="T3">T3 (smaller cities)</option>
          </select>
        </Field>
        <Field label="Family">
          <select className="border rounded p-2 w-full" value={family} onChange={(e) => setFamily(e.target.value as typeof family)}>
            <option value="single">Single</option>
            <option value="married">Married</option>
            <option value="married_with_kids">Married + kids</option>
          </select>
        </Field>
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded w-full hover:bg-blue-700"
          onClick={() => initGame({ seed: Math.floor(Math.random() * 1e9), playerName: name, age, profession, city, family })}
        >
          Start
        </button>
      </div>
    </div>
  );
}

function Dashboard() {
  const state = useGameStore((s) => s.state)!;
  const step = useGameStore((s) => s.step);
  const ff = useGameStore((s) => s.fastForward);
  const reset = useGameStore((s) => s.reset);
  const notes = useGameStore((s) => s.notifications);

  const chartData = state.history.map((h) => ({ tick: h.tick, netWorth: h.netWorth, cash: h.cashOnHand }));

  return (
    <div className="min-h-screen bg-slate-50 p-6 space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">{state.player.name}, {Math.floor(state.player.ageInMonths / 12)}y</h1>
          <p className="text-slate-600 text-sm">Tick {state.meta.tick} · Market: {state.market.phase}</p>
        </div>
        <div className="space-x-2">
          <button className="bg-slate-200 px-3 py-1.5 rounded" onClick={() => step()}>+1 month</button>
          <button className="bg-slate-200 px-3 py-1.5 rounded" onClick={() => ff(12)}>+1 year</button>
          <button className="bg-slate-200 px-3 py-1.5 rounded" onClick={() => ff(60)}>+5 years</button>
          <button className="bg-red-100 px-3 py-1.5 rounded" onClick={reset}>Reset</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Net worth" value={formatINR(state.statement.netWorth, { compact: true })} />
        <Stat label="Cash on hand" value={formatINR(state.cashOnHand, { compact: true })} />
        <Stat label="Monthly income" value={formatINR(state.statement.totalIncome, { compact: true })} />
        <Stat label="Monthly expenses" value={formatINR(state.statement.totalExpenses, { compact: true })} />
        <Stat label="Total assets" value={formatINR(state.statement.totalAssets, { compact: true })} />
        <Stat label="Total liabilities" value={formatINR(state.statement.totalLiabilities, { compact: true })} />
        <Stat label="Passive income" value={formatINR(state.statement.passiveIncome, { compact: true })} />
        <Stat label="Savings rate" value={formatPct(state.statement.savingsRate, 1)} />
      </div>

      <div className="bg-white p-4 rounded-xl shadow">
        <h2 className="font-semibold mb-2">Net worth over time</h2>
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="tick" />
              <YAxis tickFormatter={(v) => formatINR(v, { compact: true })} />
              <Tooltip formatter={(v: number) => formatINR(v)} />
              <Line type="monotone" dataKey="netWorth" stroke="#2E75B6" dot={false} />
              <Line type="monotone" dataKey="cash" stroke="#94A3B8" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow">
        <h2 className="font-semibold mb-2">Notifications</h2>
        <ul className="text-sm text-slate-700 space-y-1 max-h-40 overflow-auto">
          {notes.length === 0 && <li className="text-slate-400">No notifications.</li>}
          {notes.map((n, i) => <li key={i}>• {n}</li>)}
        </ul>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white p-4 rounded-xl shadow">
      <div className="text-xs uppercase text-slate-500">{label}</div>
      <div className="text-xl font-semibold mt-1">{value}</div>
    </div>
  );
}
