import { SubstanceType, SubstanceData } from './types';

export const SUBSTANCES: Record<SubstanceType, SubstanceData | null> = {
  [SubstanceType.None]: null,
  [SubstanceType.HCl]: {
    id: SubstanceType.HCl,
    name: '盐酸 (HCl)',
    formula: 'HCl',
    equation: 'HCl(aq) → H⁺(aq) + Cl⁻(aq)',
    kType: 'Ka',
    kValue: '很大 (∞)',
    description: '强酸。在水中完全电离，不存在分子形式。',
    strong: true,
    colors: {
      molecule: '#94a3b8', // 灰色 (仅在初始瞬间存在)
      cation: '#ef4444',   // 红色 (H+)
      anion: '#22c55e',    // 绿色 (Cl-)
    },
    labels: {
      molecule: 'HCl分子',
      cation: 'H⁺',
      anion: 'Cl⁻',
    }
  },
  [SubstanceType.CH3COOH]: {
    id: SubstanceType.CH3COOH,
    name: '乙酸 (CH₃COOH)',
    formula: 'CH3COOH',
    equation: 'CH3COOH(aq) ⇌ H⁺(aq) + CH3COO⁻(aq)',
    kType: 'Ka',
    kValue: '1.75 × 10⁻⁵',
    description: '弱酸。部分电离。存在电离平衡，受温度和浓度影响。',
    strong: false,
    colors: {
      molecule: '#3b82f6', // 蓝色
      cation: '#ef4444',   // 红色 (H+)
      anion: '#60a5fa',    // 浅蓝 (乙酸根)
    },
    labels: {
      molecule: 'CH₃COOH分子',
      cation: 'H⁺',
      anion: 'CH₃COO⁻',
    }
  },
  [SubstanceType.NH3H2O]: {
    id: SubstanceType.NH3H2O,
    name: '一水合氨 (NH₃·H₂O)',
    formula: 'NH3·H2O',
    equation: 'NH3·H2O(aq) ⇌ NH4⁺(aq) + OH⁻(aq)',
    kType: 'Kb',
    kValue: '1.8 × 10⁻⁵',
    description: '弱碱。部分电离生成铵根和氢氧根离子。',
    strong: false,
    colors: {
      molecule: '#f97316', // 橙色
      cation: '#fdba74',   // 浅橙 (NH4+)
      anion: '#8b5cf6',    // 紫色 (OH-)
    },
    labels: {
      molecule: 'NH₃·H₂O分子',
      cation: 'NH4⁺',
      anion: 'OH⁻',
    }
  },
};

export const KNOWLEDGE_DATA: Record<SubstanceType, {
  examPoints: string[];
  applications: string[];
}> = {
  [SubstanceType.None]: { examPoints: [], applications: [] },
  [SubstanceType.HCl]: {
    examPoints: [
      "强电解质：HCl在水中完全电离，不存在电离平衡，不存在HCl分子。",
      "pH计算：c(H⁺) = c(HCl)，pH = -lg[c(H⁺)]。",
      "导电性：同浓度下，HCl溶液导电性显著强于弱酸（如醋酸）。",
      "稀释规律：pH=a的强酸稀释10ⁿ倍，pH = a + n (a+n < 7)。",
      "强酸制弱酸：HCl + CH₃COONa → CH₃COOH + NaCl (强酸制备弱酸)。",
      "离子共存：H⁺与OH⁻, CO₃²⁻, AlO₂⁻等不能大量共存。",
      "氧化还原：浓盐酸与MnO₂加热可制取Cl₂ (体现还原性)。",
      "挥发性：浓盐酸具有挥发性，打开瓶盖出现白雾 (盐酸小液滴)。",
      "试纸变色：能使紫色石蕊试液变红，pH试纸变红。",
      "离子检验：加AgNO₃溶液和稀HNO₃，产生不溶于酸的白色沉淀(AgCl)。",
      "反应速率：与活泼金属反应剧烈，生成H₂速率取决于c(H⁺)。",
      "工业制备：氢气在氯气中燃烧 (H₂ + Cl₂ → 2HCl)。"
    ],
    applications: [
      "人体胃液：胃酸主要成分是盐酸，帮助消化食物、激活胃蛋白酶并杀灭细菌。",
      "金属除锈：工业上用于酸洗钢材，去除表面的铁锈(Fe₂O₃)，反应快。",
      "制造PVC：用于生产聚氯乙烯塑料的前体氯乙烯单体。",
      "食品加工：调节食品pH值，制造明胶，水解淀粉制造葡萄糖。",
      "制取氯气：实验室利用浓盐酸与高锰酸钾或二氧化锰反应制取氯气。",
      "印染工业：用于织物漂白后的酸洗，中和残留碱性，使棉布柔软。",
      "制药工业：许多药物（如盐酸普鲁卡因）制成盐酸盐以增加溶解度和稳定性。",
      "日常清洁：家用洁厕灵的主要成分，能有效去除尿垢和水垢。",
      "石油开采：酸化油井，注入盐酸溶解岩石孔隙，提高原油产量。",
      "湿法冶金：用于提取钨、稀土等稀有金属。",
      "制备无机盐：如ZnCl₂ (焊药)、FeCl₃ (净水剂)。",
      "调节pH：化学实验和化工生产中常用的pH调节剂。"
    ]
  },
  [SubstanceType.CH3COOH]: {
    examPoints: [
      "弱电解质：在水中部分电离，存在电离平衡 CH₃COOH ⇌ CH₃COO⁻ + H⁺。",
      "电离常数Ka：Ka只受温度影响，升温Ka增大 (吸热)；Ka不随浓度改变。",
      "越稀越电离：加水稀释，平衡正向移动，电离度α增大，但c(H⁺)和导电性减小。",
      "同离子效应：加入CH₃COONa固体，c(CH₃COO⁻)增大，平衡逆向移动，c(H⁺)减小。",
      "pH计算：c(H⁺) ≈ √(Ka·c)，同浓度下pH值比强酸大。",
      "中和滴定：用NaOH滴定醋酸，化学计量点时溶液呈碱性 (生成CH₃COONa水解)。",
      "反应速率：同浓度下与Zn反应速率慢于HCl；同pH下反应速率起始相同，但醋酸持续时间长。",
      "酯化反应：与乙醇在浓硫酸加热下发生酯化反应生成乙酸乙酯 (取代反应)。",
      "酸性比较：酸性：CH₃COOH > H₂CO₃ > C₆H₅OH (醋酸能制取二氧化碳)。",
      "缓冲溶液：CH₃COOH 与 CH₃COONa 混合液具有缓冲作用，抵抗pH剧烈改变。",
      "结晶特性：纯乙酸又称冰醋酸，熔点16.6℃，低于此温度凝结成冰状晶体。",
      "弱酸置换弱酸：乙酸能与苯酚钠反应生成苯酚。"
    ],
    applications: [
      "食用醋：食醋的主要成分(3-5%)，调味品，具有杀菌防腐作用。",
      "除水垢：利用其酸性去除水壶中的碳酸钙和氢氧化镁沉淀。",
      "工业溶剂：冰醋酸是良好的极性有机溶剂，用于重结晶纯化有机物。",
      "合成纤维：制造醋酸纤维素，用于生产胶片、人造丝和香烟过滤嘴。",
      "农药生产：制造2,4-D等除草剂和其他农药中间体。",
      "印染助剂：调节染浴pH值，中和碱性，提高染色鲜艳度。",
      "合成塑料：制造醋酸乙烯酯，进而生产PVA（聚乙烯醇）和白乳胶。",
      "食品防腐：用于泡菜、酱菜等食品的防腐保鲜，抑制细菌生长。",
      "医药合成：生产阿司匹林 (乙酰水杨酸)、扑热息痛的重要原料。",
      "橡胶工业：用作乳胶的凝固剂。",
      "化学分析：用于配制缓冲溶液，维持特定pH环境。",
      "摄影业：作为定影液和停显液的成分。"
    ]
  },
  [SubstanceType.NH3H2O]: {
    examPoints: [
      "弱碱性：部分电离 NH₃·H₂O ⇌ NH₄⁺ + OH⁻，溶液显碱性。",
      "不稳定性：受热易分解 NH₃·H₂O △ NH₃↑ + H₂O，需密封阴凉保存。",
      "Kb常数：Kb只受温度影响，电离吸热，升温Kb增大，碱性略增强。",
      "同离子效应：加入NH₄Cl固体，c(NH₄⁺)增大，平衡逆向移动，c(OH⁻)减小，pH减小。",
      "络合反应：能溶解AgCl沉淀，生成银氨溶液 [Ag(NH₃)₂]⁺。",
      "沉淀试剂：实验室常用氨水沉淀Al³⁺，生成Al(OH)₃，因其弱碱性不能溶解氢氧化铝。",
      "喷泉实验：氨气极易溶于水 (1:700)，可形成红色喷泉（加酚酞）。",
      "试纸变色：能使湿润的红色石蕊试纸变蓝，是中学唯一常见的碱性气体。",
      "比较碱性：碱性弱于NaOH、KOH，但强于大多数不溶性碱 (Mg(OH)₂等)。",
      "密度特性：市售浓氨水密度约为0.91g/cm³，浓度越大密度越小。",
      "相互转化：NH₃ + H₂O ⇌ NH₃·H₂O ⇌ NH₄⁺ + OH⁻ (大部分以一水合氨分子存在)。",
      "制备氨气：加热浓氨水或将浓氨水滴入CaO/NaOH固体中可快速制取NH₃。"
    ],
    applications: [
      "农业化肥：制造铵态氮肥（硝酸铵、硫酸铵、尿素），促进作物生长。",
      "玻璃清洁剂：家用清洁剂常用成分，去油污效果好且挥发不留白色痕迹。",
      "工业制冷：液氨汽化吸热很大，广泛用于大型工业制冷系统和冷库。",
      "制硝酸：氨氧化法制硝酸的基础原料 (4NH₃ + 5O₂ → 4NO + 6H₂O)。",
      "银镜反应：配制银氨溶液，用于检验醛基、葡萄糖或制作热水瓶胆镀银。",
      "纺织工业：制造尼龙 (锦纶)、腈纶等合成纤维的原料。",
      "橡胶硫化：在橡胶工业中作为硫化促进剂或稳定剂。",
      "水处理：调节水质pH值，中和酸性废水，杀菌。",
      "医药用途：嗅盐（由于强刺激性气味刺激呼吸中枢，用于唤醒昏厥者）。",
      "实验室试剂：用于定性分析阳离子和制备金属氢氧化物沉淀。",
      "去除污渍：能有效去除衣服上的血渍、汗渍和霉斑。",
      "烟气脱硫：用于电厂烟气脱硫，生成硫酸铵化肥，变废为宝。"
    ]
  }
};

export const INITIAL_PARTICLE_COUNT_BASE = 50;
export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 500;