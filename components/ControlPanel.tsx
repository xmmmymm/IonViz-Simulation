import React from 'react';
import { SubstanceType } from '../types';
import { RotateCcw, Thermometer, BoxSelect, Play, Pause } from 'lucide-react';

interface ControlPanelProps {
  selectedSubstance: SubstanceType;
  onSelectSubstance: (s: SubstanceType) => void;
  temperature: number;
  onTemperatureChange: (t: number) => void;
  concentration: number;
  onConcentrationChange: (c: number) => void;
  isPaused: boolean;
  onTogglePause: () => void;
  onReset: () => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  selectedSubstance,
  onSelectSubstance,
  temperature,
  onTemperatureChange,
  concentration,
  onConcentrationChange,
  isPaused,
  onTogglePause,
  onReset,
}) => {
  return (
    <div className="bg-white p-4 xl:p-5 rounded-2xl shadow-lg border border-slate-100 flex flex-col gap-5">

      {/* Substance Selectors */}
      <div>
        <h3 className="text-[15px] font-bold text-slate-500 uppercase tracking-wider mb-3">选择溶质 (Substance)</h3>
        <div className="grid grid-cols-3 gap-2.5">
          <button
            onClick={() => onSelectSubstance(SubstanceType.HCl)}
            className={`py-2.5 px-1 rounded-lg font-semibold text-[15px] leading-tight transition-all duration-200 flex flex-col items-center gap-0.5 ${
              selectedSubstance === SubstanceType.HCl
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span>HCl</span>
            <span className="text-[13px] font-normal opacity-80">强酸</span>
          </button>

          <button
            onClick={() => onSelectSubstance(SubstanceType.CH3COOH)}
            className={`py-2.5 px-1 rounded-lg font-semibold text-[15px] leading-tight transition-all duration-200 flex flex-col items-center gap-0.5 ${
              selectedSubstance === SubstanceType.CH3COOH
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span>CH₃COOH</span>
            <span className="text-[13px] font-normal opacity-80">弱酸</span>
          </button>

          <button
            onClick={() => onSelectSubstance(SubstanceType.NH3H2O)}
            className={`py-2.5 px-1 rounded-lg font-semibold text-[15px] leading-tight transition-all duration-200 flex flex-col items-center gap-0.5 ${
              selectedSubstance === SubstanceType.NH3H2O
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span>NH₃·H₂O</span>
            <span className="text-[13px] font-normal opacity-80">弱碱</span>
          </button>
        </div>
      </div>

      <div className="h-px bg-slate-100"></div>

      {/* Sliders */}
      <div className="space-y-4">
        <div>
          <div className="flex justify-between items-center mb-2 gap-2">
            <div className="flex items-center gap-1.5 text-slate-700 font-medium text-[15px]">
                <Thermometer size={16} className="shrink-0" />
                <span>温度</span>
            </div>
            <span className="text-sm font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-700 whitespace-nowrap">{temperature}°C</span>
          </div>
          <input
            type="range"
            min="-50"
            max="100"
            value={temperature}
            onChange={(e) => onTemperatureChange(Number(e.target.value))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          <div className="flex justify-between text-[13px] text-slate-500 mt-1">
            <span>-50°C</span>
            <span>100°C</span>
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2 gap-2">
            <div className="flex items-center gap-1.5 text-slate-700 font-medium text-[15px]">
                <BoxSelect size={16} className="shrink-0" />
                <span>浓度</span>
            </div>
            <span className="text-sm font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-700 whitespace-nowrap">{concentration.toFixed(1)} M</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="3.0"
            step="0.1"
            value={concentration}
            onChange={(e) => onConcentrationChange(Number(e.target.value))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
           <div className="flex justify-between text-[13px] text-slate-500 mt-1">
            <span>稀 0.1M</span>
            <span>浓 3.0M</span>
          </div>
        </div>
      </div>

      <div className="flex gap-2.5">
        <button
          onClick={onTogglePause}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 font-semibold text-[15px] transition-colors ${
            isPaused
            ? 'border-green-500 text-green-600 bg-green-50 hover:bg-green-100'
            : 'border-slate-200 text-slate-600 bg-white hover:bg-slate-50'
          }`}
        >
          {isPaused ? <Play size={18} fill="currentColor" /> : <Pause size={18} fill="currentColor" />}
          {isPaused ? '继续反应' : '暂停'}
        </button>

        <button
          onClick={onReset}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 border-slate-200 text-slate-600 font-semibold text-[15px] hover:border-slate-300 hover:bg-slate-50 transition-colors"
        >
          <RotateCcw size={18} />
          还原
        </button>
      </div>
    </div>
  );
};

export default ControlPanel;
