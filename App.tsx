import React, { useState, useMemo, useEffect } from 'react';
import SimulationCanvas from './components/SimulationCanvas';
import ControlPanel from './components/ControlPanel';
import { SubstanceType, SimulationConfig } from './types';
import { SUBSTANCES, KNOWLEDGE_DATA } from './constants';
import { FlaskConical, Beaker, Eye, EyeOff, Info, Calculator, Activity, ArrowRightLeft, Lightbulb, BookOpen, Atom, Zap, Microscope, ChevronLeft, ChevronRight, BookOpenCheck } from 'lucide-react';

// --- Sub-component: Knowledge & Analysis Panel ---
const KnowledgePanel = ({ 
    substanceType, 
    isVisible 
}: { 
    substanceType: SubstanceType, 
    isVisible: boolean
}) => {
    // Indices for the carousels
    const [examIdx, setExamIdx] = useState(0);
    const [appIdx, setAppIdx] = useState(0);

    // Reset indices when substance changes
    useEffect(() => {
        setExamIdx(0);
        setAppIdx(0);
    }, [substanceType]);

    if (!isVisible) return null;

    if (substanceType === SubstanceType.None) {
        return (
            <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 flex flex-col items-center justify-center text-center h-full min-h-[200px] text-slate-400 gap-3 animate-in fade-in slide-in-from-bottom-4">
                <BookOpen size={48} className="opacity-20" />
                <p className="text-sm">请先选择一种物质<br/>查看其化学性质与平衡分析</p>
            </div>
        );
    }

    const knowledge = KNOWLEDGE_DATA[substanceType];
    const substanceName = SUBSTANCES[substanceType]?.name;

    // Navigation handlers
    const prevExam = () => setExamIdx(curr => curr === 0 ? knowledge.examPoints.length - 1 : curr - 1);
    const nextExam = () => setExamIdx(curr => curr === knowledge.examPoints.length - 1 ? 0 : curr + 1);
    
    const prevApp = () => setAppIdx(curr => curr === 0 ? knowledge.applications.length - 1 : curr - 1);
    const nextApp = () => setAppIdx(curr => curr === knowledge.applications.length - 1 ? 0 : curr + 1);

    return (
        <div className="bg-white p-5 rounded-2xl shadow-lg border border-slate-100 space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <BookOpenCheck className="text-blue-600" size={20} />
                <h3 className="font-bold text-slate-700">核心考点 & 智能分析</h3>
                <span className="ml-auto text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-full">{substanceName}</span>
            </div>

            {/* 1. Exam Points Carousel */}
            <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-bold text-indigo-700">
                    <Atom size={16} />
                    <span>重点考点 ({examIdx + 1}/{knowledge.examPoints.length})</span>
                </div>
                
                <div className="flex items-stretch gap-2">
                    <button onClick={prevExam} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-indigo-600 transition-colors">
                        <ChevronLeft size={20} />
                    </button>
                    
                    <div className="flex-1 bg-indigo-50/50 border border-indigo-100 rounded-lg p-3 min-h-[80px] flex items-center justify-center text-center relative overflow-hidden group">
                        <p className="text-sm text-slate-700 font-medium leading-relaxed px-1">
                            {knowledge.examPoints[examIdx]}
                        </p>
                        <div className="absolute bottom-1 right-2 flex gap-1 justify-center">
                             {/* Small dots indicator */}
                             {knowledge.examPoints.map((_, i) => (
                                 <div key={i} className={`w-1 h-1 rounded-full transition-all ${i === examIdx ? 'bg-indigo-400 w-3' : 'bg-indigo-200'}`}></div>
                             )).slice(0, 5) /* Limit dots if too many, or just simplify design by hiding */}
                        </div>
                    </div>

                    <button onClick={nextExam} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-indigo-600 transition-colors">
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>
            
            <div className="h-px bg-slate-50"></div>

            {/* 2. Applications Carousel */}
            <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-bold text-green-700">
                    <Microscope size={16} />
                    <span>生活与应用 ({appIdx + 1}/{knowledge.applications.length})</span>
                </div>
                
                <div className="flex items-stretch gap-2">
                    <button onClick={prevApp} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-green-600 transition-colors">
                        <ChevronLeft size={20} />
                    </button>
                    
                    <div className="flex-1 bg-green-50/50 border border-green-100 rounded-lg p-3 min-h-[80px] flex items-center justify-center text-center relative">
                        <p className="text-sm text-slate-700 font-medium leading-relaxed px-1">
                            {knowledge.applications[appIdx]}
                        </p>
                    </div>

                    <button onClick={nextApp} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-green-600 transition-colors">
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>

        </div>
    );
};


function App() {
  const [selectedSubstance, setSelectedSubstance] = useState<SubstanceType>(SubstanceType.None);
  const [temperature, setTemperature] = useState<number>(25);
  const [concentration, setConcentration] = useState<number>(1.0);
  const [showEquation, setShowEquation] = useState<boolean>(false);
  const [showConstant, setShowConstant] = useState<boolean>(true); // Default data panel to true for better UX initially? User asked default hidden for others. Keeping this one true is helpful, but user asked to hide equation default. Let's stick to user request for new panel.
  const [showKnowledge, setShowKnowledge] = useState<boolean>(false); // Requirement: Default hidden
  const [isPaused, setIsPaused] = useState<boolean>(false);
  
  // Stats from the canvas simulation
  const [simStats, setSimStats] = useState({ moleculeCount: 0, ionCount: 0, ionizationRate: 0, recombinationRate: 0 });

  // Derived state
  const isInitial = selectedSubstance === SubstanceType.None;
  const currentSubstanceData = isInitial ? null : SUBSTANCES[selectedSubstance];

  // --- Real-time Physics Calculations ---
  // Calculates theoretical values based on T and C
  const physicsData = useMemo(() => {
    if (!currentSubstanceData || isInitial) return null;

    // 1. Calculate K (Equilibrium Constant) adjusted for Temperature
    // Assumption: Ionization is endothermic, K increases with T.
    // Base values roughly at 25C.
    let baseK = 1e-5; 
    let exponent = 5;
    if (currentSubstanceData.strong) {
        return { K: "∞", alpha: "100%", pH: (-Math.log10(concentration)).toFixed(2) };
    }
    
    // Parse base scientific notation roughly
    if (selectedSubstance === SubstanceType.CH3COOH) baseK = 1.75e-5;
    if (selectedSubstance === SubstanceType.NH3H2O) baseK = 1.8e-5;

    // K adjustment for wide range (-50 to 100)
    // 25C is baseline.
    const tempDiff = temperature - 25;
    // Simple model: K doubles every 10 degrees rise approx
    const tempFactor = Math.pow(1.03, tempDiff); // Exponential growth with temp
    const kAdjusted = baseK * tempFactor; 
    
    // 2. Calculate Alpha (Degree of Ionization)
    // For weak acid: K = (C*alpha^2) / (1-alpha)  => approx alpha = sqrt(K/C)
    let alphaVal = Math.sqrt(kAdjusted / concentration);
    if (alphaVal > 1) alphaVal = 1;

    // 3. Calculate pH (or pOH -> pH)
    const ionConc = alphaVal * concentration;
    let phVal = -Math.log10(ionConc);
    
    if (selectedSubstance === SubstanceType.NH3H2O) {
        // It's a base, so we calculated [OH-], need pH = 14 - pOH
        // Note: pKw changes with T too
        // pKw approx 14 at 25C, 15 at 0C, 12 at 100C
        const pKw = 14.0 - (tempDiff * 0.015); 
        phVal = pKw - phVal; 
    }

    return {
        K: kAdjusted.toExponential(2),
        alpha: (alphaVal * 100).toFixed(2) + "%", // Theoretical
        pH: phVal.toFixed(2),
    };
  }, [currentSubstanceData, temperature, concentration, isInitial]);

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
      
      // Ratio of ions
      const ionRatio = simStats.ionCount / totalParticles;
      
      // Concentration factor (more ions = brighter)
      const concFactor = concentration / 3.0; 
      
      // Temp factor (mobility) - Higher temp = brighter
      const tempFactor = (temperature + 50) / 150; // 0 to 1

      // Combined Score (0 to 1)
      let brightness = ionRatio * (0.5 + concFactor) * (0.5 + tempFactor);
      
      return Math.min(1, Math.max(0.1, brightness)); // Min brightness 0.1 to see the bulb
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
    setShowEquation(false);
    setShowConstant(false); // Reset to hidden as per original request, though I kept it false in state init
    setShowKnowledge(false);
    setIsPaused(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <header className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg shadow-lg shadow-blue-200">
                <FlaskConical className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">电离平衡微观模拟 (IonEquilibrium Viz)</h1>
              <p className="text-slate-500 text-sm">强/弱电解质电离过程与动态平衡可视化</p>
            </div>
          </div>
          <div className="hidden md:flex gap-4 text-sm text-slate-500">
             <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-slate-400 blur-[1px]"></div> 初始状态</div>
             <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-red-500"></div> 阳离子 (+)</div>
             <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-green-500"></div> 阴离子 (-)</div>
          </div>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column: Visualization + Data Dashboard (Takes 8/12 cols) */}
          <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-6">
            
            {/* Canvas Container */}
            <div className="w-full relative rounded-xl overflow-hidden shadow-lg border border-slate-200 bg-slate-100 group" style={{ aspectRatio: '800/500' }}>
               <SimulationCanvas 
                 config={config} 
                 isInitial={isInitial} 
                 isPaused={isPaused}
                 onStatsUpdate={setSimStats}
               />
               
               {/* Overlay Legend */}
               {!isInitial && currentSubstanceData && (
                 <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur shadow-md rounded-lg p-3 text-xs border border-slate-100 flex gap-4 z-10 transition-opacity opacity-0 group-hover:opacity-100 duration-300">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full border border-slate-300" style={{backgroundColor: currentSubstanceData.colors.molecule}}></div>
                        <span>{currentSubstanceData.labels.molecule}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full border border-slate-300" style={{backgroundColor: currentSubstanceData.colors.cation}}></div>
                        <span>{currentSubstanceData.labels.cation}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full border border-slate-300" style={{backgroundColor: currentSubstanceData.colors.anion}}></div>
                        <span>{currentSubstanceData.labels.anion}</span>
                    </div>
                 </div>
               )}
            </div>

            {/* Dashboard / Info Panel */}
            <div className={`transition-all duration-500 space-y-4 ${isInitial ? 'opacity-50 grayscale pointer-events-none' : 'opacity-100'}`}>
                
                {/* 1. Control Buttons for Info */}
                <div className="flex gap-3 overflow-x-auto pb-1">
                     <button 
                        onClick={() => setShowEquation(!showEquation)}
                        className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors border ${showEquation ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                    >
                        <Beaker size={16} /> {showEquation ? '隐藏方程式' : '显示方程式'}
                    </button>
                    <button 
                        onClick={() => setShowConstant(!showConstant)}
                        className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors border ${showConstant ? 'bg-purple-50 border-purple-200 text-purple-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                    >
                        <Info size={16} /> {showConstant ? '隐藏数据' : '显示数据'}
                    </button>
                     <button 
                        onClick={() => setShowKnowledge(!showKnowledge)}
                        className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors border ${showKnowledge ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                    >
                        <BookOpenCheck size={16} /> {showKnowledge ? '隐藏考点' : '显示考点'}
                    </button>
                </div>

                {/* 2. Equation Display */}
                {showEquation && currentSubstanceData && (
                    <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 flex justify-center items-center animate-in fade-in slide-in-from-top-2">
                        <span className="text-xl font-serif italic text-slate-800 tracking-wide">
                             {currentSubstanceData.equation}
                        </span>
                    </div>
                )}

                {/* 3. Real-time Parameters Dashboard */}
                {showConstant && physicsData && currentSubstanceData && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in slide-in-from-top-2">
                        
                        {/* 1. Conductivity Meter */}
                         <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200 shadow-sm flex flex-col items-center justify-center relative overflow-hidden group min-h-[140px]">
                            <div className="text-[10px] uppercase text-yellow-600 font-bold mb-1 absolute top-3 left-3 flex items-center gap-1">
                                <Lightbulb size={10} /> 导电能力
                            </div>
                            <div className="relative mt-2">
                                <Lightbulb size={48} className="text-slate-300 relative z-10" strokeWidth={1.5} />
                                <div 
                                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-yellow-400 blur-xl transition-all duration-500"
                                    style={{
                                        width: `${conductivityBrightness * 80}px`,
                                        height: `${conductivityBrightness * 80}px`,
                                        opacity: conductivityBrightness
                                    }}
                                ></div>
                                <Lightbulb 
                                    size={48} 
                                    className="text-yellow-500 absolute top-0 left-0 z-20 transition-all duration-500" 
                                    fill="currentColor"
                                    style={{ opacity: conductivityBrightness }}
                                    strokeWidth={0}
                                />
                            </div>
                            <div className="text-xs text-yellow-700 mt-2 font-medium">
                                {conductivityBrightness > 0.8 ? '极强 (Strong)' : conductivityBrightness > 0.4 ? '较强 (Medium)' : '微弱 (Weak)'}
                            </div>
                        </div>

                         {/* 2. Rate Balance */}
                         <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm ring-1 ring-orange-100 flex flex-col justify-between min-h-[140px]">
                             <div className="text-[10px] uppercase text-orange-400 font-bold mb-1 flex items-center gap-1">
                                <ArrowRightLeft size={10} /> 速率平衡 (v正/v逆)
                             </div>
                             <div className="flex items-end gap-2 h-16 mt-2">
                                <div className="flex-1 bg-slate-100 rounded-sm relative h-full flex items-end overflow-hidden group/bar" title="电离速率">
                                    <div className="w-full bg-blue-400 transition-all duration-500 absolute bottom-0" style={{height: `${Math.min(100, simStats.ionizationRate * 5)}%`}}></div>
                                </div>
                                <div className="text-xs font-mono text-slate-400 mb-2">vs</div>
                                <div className="flex-1 bg-slate-100 rounded-sm relative h-full flex items-end overflow-hidden group/bar" title="结合速率">
                                    <div className="w-full bg-green-400 transition-all duration-500 absolute bottom-0" style={{height: `${Math.min(100, simStats.recombinationRate * 5)}%`}}></div>
                                </div>
                             </div>
                             <div className="text-[10px] text-slate-400 flex justify-between pt-2 border-t border-slate-50 mt-2">
                                 <span>v(ion):{simStats.ionizationRate}</span>
                                 <span>v(rec):{simStats.recombinationRate}</span>
                             </div>
                        </div>

                        {/* 3. Visual Stats */}
                        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm ring-1 ring-blue-100 flex flex-col justify-between min-h-[140px]">
                             <div className="text-[10px] uppercase text-blue-400 font-bold mb-1 flex items-center gap-1">
                                <Activity size={10} /> 模拟观测
                             </div>
                             <div className="text-3xl font-mono font-semibold text-slate-800 self-center my-2">{simulatedAlpha}</div>
                             <div className="text-[10px] text-slate-400 flex justify-between pt-2 border-t border-slate-50">
                                 <span>Mol: {simStats.moleculeCount}</span>
                                 <span>Ion: {simStats.ionCount}</span>
                             </div>
                        </div>

                        {/* 4. K Value */}
                        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between min-h-[100px]">
                            <div className="text-[10px] uppercase text-slate-400 font-bold mb-1 flex items-center gap-1">
                                <Calculator size={10} /> 平衡常数 ({currentSubstanceData.kType})
                            </div>
                            <div className="text-xl font-mono font-semibold text-slate-700 truncate" title={physicsData.K}>{physicsData.K}</div>
                            <div className="text-[10px] text-slate-400">@ {temperature}°C</div>
                        </div>

                        {/* 5. Theoretical Alpha */}
                        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between min-h-[100px]">
                            <div className="text-[10px] uppercase text-slate-400 font-bold mb-1">理论电离度 (α)</div>
                            <div className="text-xl font-mono font-semibold text-blue-600">{physicsData.alpha}</div>
                            <div className="text-[10px] text-slate-400">理论计算值</div>
                        </div>

                        {/* 6. pH Value */}
                        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between min-h-[100px]">
                            <div className="text-[10px] uppercase text-slate-400 font-bold mb-1">pH 值</div>
                            <div className="text-xl font-mono font-semibold text-purple-600">{physicsData.pH}</div>
                            <div className="text-[10px] text-slate-400">
                                {selectedSubstance === SubstanceType.NH3H2O ? '(碱性)' : '(酸性)'}
                            </div>
                        </div>
                        
                    </div>
                )}

            </div>
          </div>

          {/* Right Column: Controls + Knowledge (Takes 4/12 cols) */}
          <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-6 sticky top-6">
            <ControlPanel
              selectedSubstance={selectedSubstance}
              onSelectSubstance={setSelectedSubstance}
              temperature={temperature}
              onTemperatureChange={setTemperature}
              concentration={concentration}
              onConcentrationChange={setConcentration}
              isPaused={isPaused}
              onTogglePause={() => setIsPaused(!isPaused)}
              onReset={handleReset}
            />
            
            <KnowledgePanel 
                substanceType={selectedSubstance}
                isVisible={showKnowledge}
            />
          </div>

        </main>
      </div>
    </div>
  );
}

export default App;