import React, { useState, useMemo, useCallback } from 'react';
import SimulationCanvas from './components/SimulationCanvas';
import ControlPanel from './components/ControlPanel';
import { SubstanceType, SimulationConfig } from './types';
import { SUBSTANCES } from './constants';
import { FlaskConical, Calculator, Activity, ArrowRightLeft, Lightbulb, Beaker } from 'lucide-react';

interface SimStats {
  moleculeCount: number;
  ionCount: number;
  ionizationRate: number;
  recombinationRate: number;
}

/**
 * 方程式显示转换：
 * 源数据里 HCl 用了单向箭头 →、弱电解质用了可逆符号 ⇌，
 * 这里统一转成教学书写法 “==”（如 HCl(aq) == H⁺(aq) + Cl⁻(aq)）。
 */
const toDisplayEquation = (equation: string) =>
  equation.replace(/⇌|⇋|↔|→|⟶|⟹|=/g, '==').replace(/\s+/g, ' ');

/** 图例里的分子名去掉“分子”后缀，避免在角标里太长 */
const shortMoleculeLabel = (label: string) => label.replace(/分子$/, '');

function App() {
  const [selectedSubstance, setSelectedSubstance] = useState<SubstanceType>(SubstanceType.None);
  const [temperature, setTemperature] = useState<number>(25);
  const [concentration, setConcentration] = useState<number>(1.0);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  // Stats from the canvas simulation
  const [simStats, setSimStats] = useState<SimStats>({ moleculeCount: 0, ionCount: 0, ionizationRate: 0, recombinationRate: 0 });

  // 性能：画布每 400ms 回传一次统计，数值未变化时不触发 React 重渲染
  const handleStatsUpdate = useCallback((next: SimStats) => {
    setSimStats(prev =>
      prev.moleculeCount === next.moleculeCount &&
      prev.ionCount === next.ionCount &&
      prev.ionizationRate === next.ionizationRate &&
      prev.recombinationRate === next.recombinationRate
        ? prev
        : next
    );
  }, []);

  const handleTogglePause = useCallback(() => setIsPaused(p => !p), []);

  // Derived state
  const isInitial = selectedSubstance === SubstanceType.None;
  const currentSubstanceData = isInitial ? null : SUBSTANCES[selectedSubstance];

  // 常驻显示的方程式（统一为 “==” 写法）
  const displayEquation = useMemo(
    () => (currentSubstanceData ? toDisplayEquation(currentSubstanceData.equation) : ''),
    [currentSubstanceData]
  );

  // --- Real-time Physics Calculations ---
  const physicsData = useMemo(() => {
    if (!currentSubstanceData || isInitial) return null;

    let baseK = 1e-5;
    if (currentSubstanceData.strong) {
        return { K: "∞", alpha: "100%", pH: (-Math.log10(concentration)).toFixed(2) };
    }

    if (selectedSubstance === SubstanceType.CH3COOH) baseK = 1.75e-5;
    if (selectedSubstance === SubstanceType.NH3H2O) baseK = 1.8e-5;

    const tempDiff = temperature - 25;
    const tempFactor = Math.pow(1.03, tempDiff);
    const kAdjusted = baseK * tempFactor;

    let alphaVal = Math.sqrt(kAdjusted / concentration);
    if (alphaVal > 1) alphaVal = 1;

    const ionConc = alphaVal * concentration;
    let phVal = -Math.log10(ionConc);

    if (selectedSubstance === SubstanceType.NH3H2O) {
        const pKw = 14.0 - (tempDiff * 0.015);
        phVal = pKw - phVal;
    }

    return {
        K: kAdjusted.toExponential(2),
        alpha: (alphaVal * 100).toFixed(2) + "%",
        pH: phVal.toFixed(2),
    };
  }, [currentSubstanceData, temperature, concentration, isInitial, selectedSubstance]);

  // Visual Alpha from simulation stats
  const simulatedAlpha = useMemo(() => {
      const total = simStats.moleculeCount + simStats.ionCount;
      if (total === 0) return "0%";
      const ratio = simStats.ionCount / total;
      return (ratio * 100).toFixed(1) + "%";
  }, [simStats]);

  // Conductivity Calculation (Virtual Lightbulb Brightness)
  const conductivityBrightness = useMemo(() => {
      if (!physicsData || isInitial) return 0;

      const totalParticles = simStats.moleculeCount + simStats.ionCount;
      if (totalParticles === 0) return 0;

      const ionRatio = simStats.ionCount / totalParticles;
      const concFactor = concentration / 3.0;
      const tempFactor = (temperature + 50) / 150;

      const brightness = ionRatio * (0.5 + concFactor) * (0.5 + tempFactor);

      return Math.min(1, Math.max(0.1, brightness));
  }, [simStats, concentration, temperature, isInitial, physicsData]);

  const config: SimulationConfig = {
    substance: selectedSubstance,
    temperature,
    concentration,
  };

  const handleReset = () => {
    setSelectedSubstance(SubstanceType.None);
    setTemperature(25);
    setConcentration(1.0);
    setIsPaused(false);
  };

  return (
    // 全宽自适应：窗口最大化时内容铺满，两侧不留大片空白
    <div className="min-h-screen bg-slate-50 font-sans">
      <div className="w-full px-4 py-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 space-y-4 xl:space-y-5">

        {/* Header（标题字号收敛，图例已移除） */}
        <header className="flex items-center gap-3 pb-3 border-b border-slate-200">
          <div className="bg-blue-600 p-2 rounded-lg shadow-lg shadow-blue-200 shrink-0">
              <FlaskConical className="text-white w-5 h-5 xl:w-6 xl:h-6" />
          </div>
          <div>
            <h1 className="text-xl xl:text-2xl font-bold text-slate-800 leading-tight">电离平衡微观模拟</h1>
            <p className="text-slate-600 text-[15px] leading-snug">强/弱电解质电离过程与动态平衡可视化</p>
          </div>
        </header>

        {/* 左：演示区（保持 8:5 正常比例） / 右：方程式 + 控制 + 数据，便于边看边分析 */}
        <main className="grid grid-cols-1 xl:grid-cols-12 gap-4 xl:gap-5 items-start">

          <div className="xl:col-span-8 2xl:col-span-9">
            <div
              className="w-full relative rounded-xl shadow-lg border border-slate-200 bg-cyan-50"
              style={{ aspectRatio: '800 / 500' }}
            >
              <SimulationCanvas
                config={config}
                isInitial={isInitial}
                isPaused={isPaused}
                onStatsUpdate={handleStatsUpdate}
              />

              {/* 粒子图例：常驻显示在展示区左下角 */}
              {!isInitial && currentSubstanceData && (
                <div className="absolute bottom-3 left-3 z-20 bg-white/90 backdrop-blur shadow-md rounded-lg px-3 py-2 border border-slate-200 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-slate-700">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3.5 h-3.5 rounded-full border border-slate-300" style={{ backgroundColor: currentSubstanceData.colors.molecule }}></div>
                    <span>{shortMoleculeLabel(currentSubstanceData.labels.molecule)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3.5 h-3.5 rounded-full border border-slate-300" style={{ backgroundColor: currentSubstanceData.colors.cation }}></div>
                    <span>{currentSubstanceData.labels.cation}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3.5 h-3.5 rounded-full border border-slate-300" style={{ backgroundColor: currentSubstanceData.colors.anion }}></div>
                    <span>{currentSubstanceData.labels.anion}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 右侧栏：方程式 → 控制 → 数据 */}
          <div className="xl:col-span-4 2xl:col-span-3 flex flex-col gap-4 xl:gap-5">

            {/* 1. 电离方程式（常驻） */}
            <section className="bg-white rounded-2xl shadow-lg border border-slate-100 p-4 xl:p-5">
              <div className="flex items-center gap-2 text-slate-500 font-bold text-sm uppercase tracking-wider mb-2.5">
                <Beaker size={16} /> 电离方程式
              </div>
              {isInitial ? (
                <p className="text-slate-400 text-[15px] py-2">请先选择一种溶质</p>
              ) : (
                <div className="bg-blue-50/70 border border-blue-100 rounded-xl px-3 py-3.5">
                  <p className="text-lg xl:text-xl font-semibold text-slate-800 tracking-wide text-center leading-relaxed break-words">
                    {displayEquation}
                  </p>
                </div>
              )}
            </section>

            {/* 2. 控制面板 */}
            <ControlPanel
              selectedSubstance={selectedSubstance}
              onSelectSubstance={setSelectedSubstance}
              temperature={temperature}
              onTemperatureChange={setTemperature}
              concentration={concentration}
              onConcentrationChange={setConcentration}
              isPaused={isPaused}
              onTogglePause={handleTogglePause}
              onReset={handleReset}
            />

            {/* 3. 实时数据（常驻在右侧，便于边看演示边分析） */}
            {physicsData && currentSubstanceData && (
              <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">

                {/* 模拟观测（电离度） */}
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm ring-1 ring-blue-100">
                  <div className="flex items-center gap-1.5 text-blue-500 font-bold text-sm uppercase tracking-wider">
                    <Activity size={14} /> 模拟观测 (电离度 α)
                  </div>
                  <div className="text-4xl font-mono font-semibold text-slate-800 text-center my-1.5">{simulatedAlpha}</div>
                  <div className="flex justify-between text-[13px] text-slate-500 pt-2 border-t border-slate-50">
                    <span>分子数 {simStats.moleculeCount}</span>
                    <span>离子对数 {simStats.ionCount}</span>
                  </div>
                </div>

                {/* 其余四项（2×2 排布，侧栏宽度下比单列更紧凑） */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                  {/* 导电能力 */}
                  <div className="bg-yellow-50 p-3.5 rounded-xl border border-yellow-200 shadow-sm flex flex-col items-center justify-center relative overflow-hidden min-h-[132px]">
                    <div className="text-[13px] uppercase text-yellow-700 font-bold absolute top-2.5 left-3 flex items-center gap-1">
                      <Lightbulb size={13} /> 导电能力
                    </div>
                    <div className="relative mt-4">
                      <Lightbulb size={44} className="text-slate-300 relative z-10" strokeWidth={1.5} />
                      <div
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-yellow-400 blur-xl transition-all duration-500"
                        style={{ width: `${conductivityBrightness * 78}px`, height: `${conductivityBrightness * 78}px`, opacity: conductivityBrightness }}
                      ></div>
                      <Lightbulb
                        size={44}
                        className="text-yellow-500 absolute top-0 left-0 z-20 transition-all duration-500"
                        fill="currentColor"
                        style={{ opacity: conductivityBrightness }}
                        strokeWidth={0}
                      />
                    </div>
                    <div className="text-sm text-yellow-800 mt-2 font-medium">
                      {conductivityBrightness > 0.8 ? '极强' : conductivityBrightness > 0.4 ? '较强' : '微弱'}
                    </div>
                  </div>

                  {/* 速率平衡 */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-sm ring-1 ring-orange-100 flex flex-col justify-between min-h-[132px]">
                    <div className="text-[13px] uppercase text-orange-500 font-bold flex items-center gap-1">
                      <ArrowRightLeft size={13} /> 速率平衡 (v正/v逆)
                    </div>
                    <div className="flex items-end gap-2 h-14 my-1">
                      <div className="flex-1 bg-slate-100 rounded-sm relative h-full flex items-end overflow-hidden" title="电离速率">
                        <div className="w-full bg-blue-400 transition-all duration-500 absolute bottom-0" style={{ height: `${Math.min(100, simStats.ionizationRate * 5)}%` }}></div>
                      </div>
                      <div className="text-[13px] font-mono text-slate-400 mb-1">vs</div>
                      <div className="flex-1 bg-slate-100 rounded-sm relative h-full flex items-end overflow-hidden" title="结合速率">
                        <div className="w-full bg-green-400 transition-all duration-500 absolute bottom-0" style={{ height: `${Math.min(100, simStats.recombinationRate * 5)}%` }}></div>
                      </div>
                    </div>
                    <div className="text-[13px] text-slate-500 flex justify-between pt-1.5 border-t border-slate-50">
                      <span>电离 {simStats.ionizationRate}</span>
                      <span>结合 {simStats.recombinationRate}</span>
                    </div>
                  </div>

                  {/* 平衡常数 */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between min-h-[92px]">
                    <div className="text-[13px] uppercase text-slate-500 font-bold flex items-center gap-1">
                      <Calculator size={13} /> 平衡常数 ({currentSubstanceData.kType})
                    </div>
                    <div className="text-xl font-mono font-semibold text-slate-700 truncate my-1" title={physicsData.K}>{physicsData.K}</div>
                    <div className="text-[13px] text-slate-500">@ {temperature}°C</div>
                  </div>

                  {/* 理论电离度 */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between min-h-[92px]">
                    <div className="text-[13px] uppercase text-slate-500 font-bold">理论电离度 (α)</div>
                    <div className="text-xl font-mono font-semibold text-blue-600 my-1">{physicsData.alpha}</div>
                    <div className="text-[13px] text-slate-500">理论计算值</div>
                  </div>

                  {/* pH 值 */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between min-h-[92px] sm:col-span-2">
                    <div className="text-[13px] uppercase text-slate-500 font-bold">pH 值</div>
                    <div className="text-xl font-mono font-semibold text-purple-600 my-1">{physicsData.pH}</div>
                    <div className="text-[13px] text-slate-500">
                      {selectedSubstance === SubstanceType.NH3H2O ? '(碱性)' : '(酸性)'}
                    </div>
                  </div>

                </div>
              </div>
            )}

          </div>

        </main>
      </div>
    </div>
  );
}

export default App;
