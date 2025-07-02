import { HealthParameter } from "../models/healthParameter.model.js";

// Common health parameters with reference ranges
const PARAMETER_DEFINITIONS = {
  // Blood sugar/Diabetes
  'glucose': { min: 70, max: 100, unit: 'mg/dl', category: 'diabetes', critical: { min: 50, max: 400 } },
  'hba1c': { min: 4.0, max: 5.6, unit: '%', category: 'diabetes', critical: { min: 3.0, max: 12.0 } },
  'fasting glucose': { min: 70, max: 100, unit: 'mg/dl', category: 'diabetes', critical: { min: 50, max: 400 } },
  
  // Lipid Profile
  'cholesterol': { min: 0, max: 200, unit: 'mg/dl', category: 'lipid', critical: { min: 0, max: 400 } },
  'ldl': { min: 0, max: 100, unit: 'mg/dl', category: 'lipid', critical: { min: 0, max: 400 } },
  'hdl': { min: 40, max: 200, unit: 'mg/dl', category: 'lipid', critical: { min: 20, max: 200 } },
  'triglycerides': { min: 0, max: 150, unit: 'mg/dl', category: 'lipid', critical: { min: 0, max: 1000 } },
  
  // Blood count
  'hemoglobin': { min: 12.0, max: 16.0, unit: 'g/dl', category: 'blood', critical: { min: 7.0, max: 20.0 } },
  'hematocrit': { min: 36, max: 48, unit: '%', category: 'blood', critical: { min: 20, max: 60 } },
  'wbc': { min: 4000, max: 11000, unit: '/ul', category: 'blood', critical: { min: 1000, max: 50000 } },
  'rbc': { min: 4.2, max: 5.4, unit: 'million/ul', category: 'blood', critical: { min: 2.0, max: 8.0 } },
  'platelets': { min: 150000, max: 450000, unit: '/ul', category: 'blood', critical: { min: 50000, max: 1000000 } },
  
  // Liver function
  'alt': { min: 7, max: 40, unit: 'u/l', category: 'liver', critical: { min: 0, max: 200 } },
  'ast': { min: 10, max: 40, unit: 'u/l', category: 'liver', critical: { min: 0, max: 200 } },
  'bilirubin': { min: 0.2, max: 1.2, unit: 'mg/dl', category: 'liver', critical: { min: 0, max: 20 } },
  
  // Kidney function
  'creatinine': { min: 0.6, max: 1.2, unit: 'mg/dl', category: 'kidney', critical: { min: 0.2, max: 10 } },
  'urea': { min: 7, max: 20, unit: 'mg/dl', category: 'kidney', critical: { min: 0, max: 100 } },
  'bun': { min: 7, max: 20, unit: 'mg/dl', category: 'kidney', critical: { min: 0, max: 100 } },
  
  // Thyroid
  'tsh': { min: 0.4, max: 4.0, unit: 'miu/l', category: 'thyroid', critical: { min: 0.01, max: 50 } },
  't3': { min: 80, max: 200, unit: 'ng/dl', category: 'thyroid', critical: { min: 50, max: 400 } },
  't4': { min: 5.0, max: 12.0, unit: 'ug/dl', category: 'thyroid', critical: { min: 2.0, max: 20.0 } }
};

export const parseHealthParameters = (text, reportId, userId) => {
  const parameters = [];
  const lines = text.split('\n');
  
  // Enhanced regex patterns for health parameters
  const patterns = [
    // Pattern: Parameter: Value Unit
    /(\w+(?:\s+\w+)*)\s*:?\s*(\d+\.?\d*)\s*(mg\/dl|mmol\/l|g\/dl|%|u\/l|iu\/l|miu\/l|ng\/dl|ug\/dl|\/ul|million\/ul)/gi,
    // Pattern: Parameter Value Unit (Range)
    /(\w+(?:\s+\w+)*)\s+(\d+\.?\d*)\s*(mg\/dl|mmol\/l|g\/dl|%|u\/l|iu\/l|miu\/l|ng\/dl|ug\/dl|\/ul|million\/ul)\s*\([^)]*\)/gi,
    // Pattern: Parameter - Value Unit
    /(\w+(?:\s+\w+)*)\s*-\s*(\d+\.?\d*)\s*(mg\/dl|mmol\/l|g\/dl|%|u\/l|iu\/l|miu\/l|ng\/dl|ug\/dl|\/ul|million\/ul)/gi
  ];

  lines.forEach(line => {
    patterns.forEach(pattern => {
      const matches = [...line.matchAll(pattern)];
      matches.forEach(match => {
        const name = match[1].trim().toLowerCase();
        const value = parseFloat(match[2]);
        const unit = match[3].toLowerCase();
        
        // Check if this parameter is in our definitions
        const paramDef = findParameterDefinition(name);
        if (paramDef && !isNaN(value)) {
          parameters.push({
            name: name,
            value: value,
            unit: unit,
            referenceRange: {
              min: paramDef.min,
              max: paramDef.max
            },
            status: determineStatus(value, paramDef),
            category: paramDef.category,
            reportId: reportId,
            userId: userId,
            extractedFrom: line.trim()
          });
        }
      });
    });
  });

  return parameters;
};

const findParameterDefinition = (name) => {
  // Direct match
  if (PARAMETER_DEFINITIONS[name]) {
    return PARAMETER_DEFINITIONS[name];
  }
  
  // Partial match for similar parameters
  for (const [key, value] of Object.entries(PARAMETER_DEFINITIONS)) {
    if (name.includes(key) || key.includes(name)) {
      return value;
    }
  }
  
  return null;
};

const determineStatus = (value, paramDef) => {
  if (!paramDef.critical) return 'normal';
  
  // Critical ranges
  if (value <= paramDef.critical.min || value >= paramDef.critical.max) {
    return value <= paramDef.critical.min ? 'critical_low' : 'critical_high';
  }
  
  // Normal ranges
  if (value < paramDef.min) return 'low';
  if (value > paramDef.max) return 'high';
  
  return 'normal';
};

export const generateAIRecommendations = (parameters, extractedText) => {
  const recommendations = {
    critical: [],
    attention: [],
    normal: [],
    tips: [],
    summary: ""
  };

  // Group parameters by status
  const criticalParams = parameters.filter(p => p.status.includes('critical'));
  const abnormalParams = parameters.filter(p => ['high', 'low'].includes(p.status));
  const normalParams = parameters.filter(p => p.status === 'normal');

  // Critical recommendations
  criticalParams.forEach(param => {
    recommendations.critical.push({
      parameter: param.name,
      value: param.value,
      unit: param.unit,
      status: param.status,
      message: getCriticalMessage(param),
      urgency: 'immediate'
    });
  });

  // Attention needed recommendations
  abnormalParams.forEach(param => {
    recommendations.attention.push({
      parameter: param.name,
      value: param.value,
      unit: param.unit,
      status: param.status,
      message: getAbnormalMessage(param),
      urgency: 'moderate'
    });
  });

  // Normal parameters
  normalParams.forEach(param => {
    recommendations.normal.push({
      parameter: param.name,
      value: param.value,
      unit: param.unit,
      message: `${param.name} is within normal range`
    });
  });

  // Generate category-specific tips
  recommendations.tips = generateCategoryTips(parameters);

  // Generate summary
  recommendations.summary = generateSummary(parameters, criticalParams, abnormalParams);

  return recommendations;
};

const getCriticalMessage = (param) => {
  const messages = {
    'glucose': 'Extremely abnormal glucose levels require immediate medical attention. Contact your doctor urgently.',
    'cholesterol': 'Very high cholesterol levels increase cardiovascular risk significantly.',
    'hemoglobin': 'Severe anemia or polycythemia detected. Immediate medical evaluation needed.',
    'creatinine': 'Kidney function severely impaired. Urgent nephrology consultation required.',
    'alt': 'Severe liver enzyme elevation detected. Immediate medical evaluation needed.',
    'ast': 'Severe liver enzyme elevation detected. Immediate medical evaluation needed.'
  };
  
  return messages[param.name] || `Critical ${param.name} levels detected. Seek immediate medical attention.`;
};

const getAbnormalMessage = (param) => {
  const highMessages = {
    'glucose': 'Elevated glucose suggests diabetes risk. Monitor diet and exercise regularly.',
    'cholesterol': 'High cholesterol increases heart disease risk. Consider dietary changes.',
    'blood pressure': 'Elevated blood pressure requires monitoring and lifestyle modifications.',
    'triglycerides': 'High triglycerides increase cardiovascular risk. Reduce refined carbs and alcohol.'
  };
  
  const lowMessages = {
    'hemoglobin': 'Low hemoglobin suggests anemia. Consider iron-rich foods and supplements.',
    'hdl': 'Low HDL cholesterol reduces cardiovascular protection. Increase exercise and healthy fats.'
  };
  
  if (param.status === 'high') {
    return highMessages[param.name] || `${param.name} is elevated. Discuss with your healthcare provider.`;
  } else {
    return lowMessages[param.name] || `${param.name} is below normal. Consult your healthcare provider.`;
  }
};

const generateCategoryTips = (parameters) => {
  const tips = [];
  const categories = [...new Set(parameters.map(p => p.category))];
  
  const categoryTips = {
    'diabetes': [
      'Monitor blood sugar regularly',
      'Follow a balanced, low-glycemic diet',
      'Exercise regularly to improve insulin sensitivity',
      'Take medications as prescribed'
    ],
    'lipid': [
      'Adopt a heart-healthy diet low in saturated fats',
      'Increase physical activity',
      'Maintain healthy weight',
      'Consider omega-3 supplements'
    ],
    'blood': [
      'Ensure adequate iron intake',
      'Stay hydrated',
      'Get regular blood work monitoring',
      'Report unusual fatigue or bleeding'
    ],
    'liver': [
      'Limit alcohol consumption',
      'Avoid unnecessary medications',
      'Maintain healthy weight',
      'Get hepatitis vaccinations'
    ],
    'kidney': [
      'Stay well hydrated',
      'Monitor blood pressure',
      'Limit protein if advised',
      'Avoid nephrotoxic medications'
    ]
  };
  
  categories.forEach(category => {
    if (categoryTips[category]) {
      tips.push({
        category: category,
        tips: categoryTips[category]
      });
    }
  });
  
  return tips;
};

const generateSummary = (parameters, criticalParams, abnormalParams) => {
  const total = parameters.length;
  const critical = criticalParams.length;
  const abnormal = abnormalParams.length;
  const normal = total - critical - abnormal;
  
  let summary = `Lab Report Analysis: ${total} parameters analyzed. `;
  
  if (critical > 0) {
    summary += `${critical} CRITICAL values requiring immediate attention. `;
  }
  
  if (abnormal > 0) {
    summary += `${abnormal} values outside normal range. `;
  }
  
  summary += `${normal} values within normal limits. `;
  
  if (critical > 0) {
    summary += 'Please contact your healthcare provider immediately for critical values.';
  } else if (abnormal > 0) {
    summary += 'Discuss abnormal values with your healthcare provider at your next appointment.';
  } else {
    summary += 'Overall results appear normal. Continue healthy lifestyle practices.';
  }
  
  return summary;
};