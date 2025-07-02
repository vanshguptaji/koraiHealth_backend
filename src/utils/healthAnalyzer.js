import { HealthParameter } from "../models/healthParameter.model.js";

// Common health parameters with reference ranges
const PARAMETER_DEFINITIONS = {
  // Blood sugar/Diabetes
  'glucose': { min: 70, max: 100, unit: 'mg/dl', category: 'diabetes', critical: { min: 50, max: 400 } },
  'blood glucose': { min: 70, max: 100, unit: 'mg/dl', category: 'diabetes', critical: { min: 50, max: 400 } },
  'fasting glucose': { min: 70, max: 100, unit: 'mg/dl', category: 'diabetes', critical: { min: 50, max: 400 } },
  'hba1c': { min: 4.0, max: 5.6, unit: '%', category: 'diabetes', critical: { min: 3.0, max: 12.0 } },
  'hemoglobin a1c': { min: 4.0, max: 5.6, unit: '%', category: 'diabetes', critical: { min: 3.0, max: 12.0 } },
  
  // Lipid Profile
  'cholesterol': { min: 0, max: 200, unit: 'mg/dl', category: 'lipid', critical: { min: 0, max: 400 } },
  'total cholesterol': { min: 0, max: 200, unit: 'mg/dl', category: 'lipid', critical: { min: 0, max: 400 } },
  'ldl': { min: 0, max: 100, unit: 'mg/dl', category: 'lipid', critical: { min: 0, max: 400 } },
  'ldl cholesterol': { min: 0, max: 100, unit: 'mg/dl', category: 'lipid', critical: { min: 0, max: 400 } },
  'hdl': { min: 40, max: 200, unit: 'mg/dl', category: 'lipid', critical: { min: 20, max: 200 } },
  'hdl cholesterol': { min: 40, max: 200, unit: 'mg/dl', category: 'lipid', critical: { min: 20, max: 200 } },
  'triglycerides': { min: 0, max: 150, unit: 'mg/dl', category: 'lipid', critical: { min: 0, max: 1000 } },
  
  // Blood count
  'hemoglobin': { min: 12.0, max: 16.0, unit: 'g/dl', category: 'blood', critical: { min: 7.0, max: 20.0 } },
  'hb': { min: 12.0, max: 16.0, unit: 'g/dl', category: 'blood', critical: { min: 7.0, max: 20.0 } },
  'hematocrit': { min: 36, max: 48, unit: '%', category: 'blood', critical: { min: 20, max: 60 } },
  'hct': { min: 36, max: 48, unit: '%', category: 'blood', critical: { min: 20, max: 60 } },
  'wbc': { min: 4000, max: 11000, unit: '/ul', category: 'blood', critical: { min: 1000, max: 50000 } },
  'white blood cells': { min: 4000, max: 11000, unit: '/ul', category: 'blood', critical: { min: 1000, max: 50000 } },
  'rbc': { min: 4.2, max: 5.4, unit: 'million/ul', category: 'blood', critical: { min: 2.0, max: 8.0 } },
  'red blood cells': { min: 4.2, max: 5.4, unit: 'million/ul', category: 'blood', critical: { min: 2.0, max: 8.0 } },
  'platelets': { min: 150000, max: 450000, unit: '/ul', category: 'blood', critical: { min: 50000, max: 1000000 } },
  'platelet count': { min: 150000, max: 450000, unit: '/ul', category: 'blood', critical: { min: 50000, max: 1000000 } },
  
  // Liver function
  'alt': { min: 7, max: 40, unit: 'u/l', category: 'liver', critical: { min: 0, max: 200 } },
  'sgpt': { min: 7, max: 40, unit: 'u/l', category: 'liver', critical: { min: 0, max: 200 } },
  'ast': { min: 10, max: 40, unit: 'u/l', category: 'liver', critical: { min: 0, max: 200 } },
  'sgot': { min: 10, max: 40, unit: 'u/l', category: 'liver', critical: { min: 0, max: 200 } },
  'bilirubin': { min: 0.2, max: 1.2, unit: 'mg/dl', category: 'liver', critical: { min: 0, max: 20 } },
  'total bilirubin': { min: 0.2, max: 1.2, unit: 'mg/dl', category: 'liver', critical: { min: 0, max: 20 } },
  
  // Kidney function
  'creatinine': { min: 0.6, max: 1.2, unit: 'mg/dl', category: 'kidney', critical: { min: 0.2, max: 10 } },
  'serum creatinine': { min: 0.6, max: 1.2, unit: 'mg/dl', category: 'kidney', critical: { min: 0.2, max: 10 } },
  'urea': { min: 7, max: 20, unit: 'mg/dl', category: 'kidney', critical: { min: 0, max: 100 } },
  'blood urea': { min: 7, max: 20, unit: 'mg/dl', category: 'kidney', critical: { min: 0, max: 100 } },
  'bun': { min: 7, max: 20, unit: 'mg/dl', category: 'kidney', critical: { min: 0, max: 100 } },
  
  // Thyroid
  'tsh': { min: 0.4, max: 4.0, unit: 'miu/l', category: 'thyroid', critical: { min: 0.01, max: 50 } },
  't3': { min: 80, max: 200, unit: 'ng/dl', category: 'thyroid', critical: { min: 50, max: 400 } },
  't4': { min: 5.0, max: 12.0, unit: 'ug/dl', category: 'thyroid', critical: { min: 2.0, max: 20.0 } },
  'free t3': { min: 2.3, max: 4.2, unit: 'pg/ml', category: 'thyroid', critical: { min: 1.0, max: 10.0 } },
  'free t4': { min: 0.8, max: 1.8, unit: 'ng/dl', category: 'thyroid', critical: { min: 0.1, max: 5.0 } }
};

export const parseHealthParameters = (text, reportId, userId) => {
  const parameters = [];
  const lines = text.split('\n');
  
  console.log(`Parsing health parameters from ${lines.length} lines of text`);
  
  // Enhanced regex patterns for health parameters
  const patterns = [
    // Pattern: Parameter: Value Unit
    /(\w+(?:\s+\w+)*)\s*:?\s*(\d+\.?\d*)\s*(mg\/dl|mmol\/l|g\/dl|%|u\/l|iu\/l|miu\/l|ng\/dl|ug\/dl|pg\/ml|\/ul|million\/ul|cells\/ul)/gi,
    // Pattern: Parameter Value Unit (Range)
    /(\w+(?:\s+\w+)*)\s+(\d+\.?\d*)\s*(mg\/dl|mmol\/l|g\/dl|%|u\/l|iu\/l|miu\/l|ng\/dl|ug\/dl|pg\/ml|\/ul|million\/ul|cells\/ul)\s*\([^)]*\)/gi,
    // Pattern: Parameter - Value Unit
    /(\w+(?:\s+\w+)*)\s*-\s*(\d+\.?\d*)\s*(mg\/dl|mmol\/l|g\/dl|%|u\/l|iu\/l|miu\/l|ng\/dl|ug\/dl|pg\/ml|\/ul|million\/ul|cells\/ul)/gi,
    // Pattern: Parameter Value (without explicit unit, common in some formats)
    /(\w+(?:\s+\w+)*)\s*:?\s*(\d+\.?\d*)\s*(?:Normal|High|Low|Abnormal)?/gi
  ];

  lines.forEach((line, lineIndex) => {
    patterns.forEach((pattern, patternIndex) => {
      const matches = [...line.matchAll(pattern)];
      matches.forEach(match => {
        const name = match[1].trim().toLowerCase();
        const value = parseFloat(match[2]);
        const unit = match[3] ? match[3].toLowerCase() : '';
        
        console.log(`Found potential parameter: ${name} = ${value} ${unit} (Line: ${lineIndex + 1})`);
        
        // Check if this parameter is in our definitions
        const paramDef = findParameterDefinition(name);
        if (paramDef && !isNaN(value)) {
          const parameter = {
            name: name,
            value: value,
            unit: unit || paramDef.unit,
            referenceRange: {
              min: paramDef.min,
              max: paramDef.max
            },
            status: determineStatus(value, paramDef),
            category: paramDef.category,
            reportId: reportId,
            userId: userId,
            extractedFrom: line.trim()
          };
          
          parameters.push(parameter);
          console.log(`Added parameter: ${name} (${parameter.status})`);
        } else {
          console.log(`Parameter not recognized or invalid value: ${name}`);
        }
      });
    });
  });

  console.log(`Total parameters extracted: ${parameters.length}`);
  return parameters;
};

const findParameterDefinition = (name) => {
  const cleanName = name.toLowerCase().trim();
  
  // Direct match
  if (PARAMETER_DEFINITIONS[cleanName]) {
    return PARAMETER_DEFINITIONS[cleanName];
  }
  
  // Partial match for similar parameters
  for (const [key, value] of Object.entries(PARAMETER_DEFINITIONS)) {
    if (cleanName.includes(key) || key.includes(cleanName)) {
      return value;
    }
  }
  
  // Try with common abbreviations
  const abbreviations = {
    'hb': 'hemoglobin',
    'hct': 'hematocrit',
    'sgpt': 'alt',
    'sgot': 'ast',
    'tc': 'total cholesterol',
    'tg': 'triglycerides'
  };
  
  if (abbreviations[cleanName] && PARAMETER_DEFINITIONS[abbreviations[cleanName]]) {
    return PARAMETER_DEFINITIONS[abbreviations[cleanName]];
  }
  
  return null;
};

const determineStatus = (value, paramDef) => {
  if (!paramDef.critical || !paramDef.min || !paramDef.max) return 'normal';
  
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
  console.log(`Generating recommendations for ${parameters.length} parameters`);
  
  const recommendations = {
    critical: [],
    attention: [],
    normal: [],
    tips: [],
    summary: "",
    overallRisk: "low"
  };

  if (!parameters || parameters.length === 0) {
    recommendations.summary = "No health parameters were found in this report. Please ensure the document contains lab test results with numerical values.";
    return recommendations;
  }

  // Group parameters by status
  const criticalParams = parameters.filter(p => p.status && p.status.includes('critical'));
  const abnormalParams = parameters.filter(p => p.status && ['high', 'low'].includes(p.status));
  const normalParams = parameters.filter(p => p.status === 'normal');

  // Critical recommendations
  criticalParams.forEach(param => {
    recommendations.critical.push({
      parameter: param.name,
      value: param.value,
      unit: param.unit,
      status: param.status,
      message: getCriticalMessage(param),
      urgency: 'immediate',
      category: param.category
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
      urgency: 'moderate',
      category: param.category
    });
  });

  // Normal parameters
  normalParams.forEach(param => {
    recommendations.normal.push({
      parameter: param.name,
      value: param.value,
      unit: param.unit,
      message: `${param.name.charAt(0).toUpperCase() + param.name.slice(1)} is within normal range`,
      category: param.category
    });
  });

  // Generate category-specific tips
  recommendations.tips = generateCategoryTips(parameters);

  // Generate summary and overall risk
  const riskAssessment = calculateOverallRisk(criticalParams, abnormalParams, normalParams);
  recommendations.overallRisk = riskAssessment.risk;
  recommendations.summary = generateSummary(parameters, criticalParams, abnormalParams, riskAssessment);

  console.log(`Generated recommendations: ${recommendations.critical.length} critical, ${recommendations.attention.length} attention, ${recommendations.normal.length} normal`);
  
  return recommendations;
};

const getCriticalMessage = (param) => {
  const messages = {
    'glucose': 'Extremely abnormal glucose levels require immediate medical attention. Contact your doctor urgently.',
    'cholesterol': 'Very high cholesterol levels increase cardiovascular risk significantly. Immediate medical consultation needed.',
    'hemoglobin': 'Severe anemia or polycythemia detected. Immediate medical evaluation required.',
    'hb': 'Severe anemia or polycythemia detected. Immediate medical evaluation required.',
    'creatinine': 'Kidney function severely impaired. Urgent nephrology consultation required.',
    'alt': 'Severe liver enzyme elevation detected. Immediate medical evaluation needed.',
    'ast': 'Severe liver enzyme elevation detected. Immediate medical evaluation needed.',
    'bilirubin': 'Severe liver dysfunction indicated. Immediate medical attention required.',
    'wbc': 'Abnormal white blood cell count may indicate serious infection or blood disorder.',
    'platelets': 'Dangerous platelet levels detected. Risk of bleeding or clotting issues.'
  };
  
  const key = param.name.toLowerCase();
  return messages[key] || `Critical ${param.name} levels detected. Seek immediate medical attention.`;
};

const getAbnormalMessage = (param) => {
  const highMessages = {
    'glucose': 'Elevated glucose suggests diabetes risk. Monitor diet, exercise regularly, and follow up with healthcare provider.',
    'cholesterol': 'High cholesterol increases heart disease risk. Consider dietary changes and regular exercise.',
    'triglycerides': 'High triglycerides increase cardiovascular risk. Reduce refined carbs and alcohol intake.',
    'alt': 'Elevated liver enzymes may indicate liver stress. Consider lifestyle modifications and follow-up testing.',
    'ast': 'Elevated liver enzymes may indicate liver stress. Consider lifestyle modifications and follow-up testing.',
    'creatinine': 'Elevated creatinine suggests kidney function decline. Monitor hydration and avoid nephrotoxic substances.',
    'bilirubin': 'Elevated bilirubin may indicate liver or blood issues. Follow up with healthcare provider.'
  };
  
  const lowMessages = {
    'hemoglobin': 'Low hemoglobin suggests anemia. Consider iron-rich foods, supplements, and identify underlying cause.',
    'hb': 'Low hemoglobin suggests anemia. Consider iron-rich foods, supplements, and identify underlying cause.',
    'hdl': 'Low HDL cholesterol reduces cardiovascular protection. Increase exercise and consume healthy fats.',
    'platelets': 'Low platelet count may increase bleeding risk. Avoid activities with injury risk and seek medical advice.'
  };
  
  const key = param.name.toLowerCase();
  
  if (param.status === 'high') {
    return highMessages[key] || `${param.name.charAt(0).toUpperCase() + param.name.slice(1)} is elevated. Discuss with your healthcare provider for proper management.`;
  } else {
    return lowMessages[key] || `${param.name.charAt(0).toUpperCase() + param.name.slice(1)} is below normal. Consult your healthcare provider for evaluation and treatment options.`;
  }
};

const generateCategoryTips = (parameters) => {
  const tips = [];
  const categories = [...new Set(parameters.map(p => p.category))];
  
  const categoryTips = {
    'diabetes': [
      'Monitor blood sugar levels regularly as advised by your doctor',
      'Follow a balanced diet with controlled carbohydrate intake',
      'Exercise regularly to improve insulin sensitivity',
      'Take medications as prescribed and at the same time daily',
      'Stay hydrated and maintain a healthy weight'
    ],
    'lipid': [
      'Adopt a heart-healthy diet low in saturated and trans fats',
      'Increase physical activity to at least 150 minutes per week',
      'Maintain a healthy weight and waist circumference',
      'Consider omega-3 rich foods like fish and nuts',
      'Limit processed foods and added sugars'
    ],
    'blood': [
      'Ensure adequate iron intake through diet or supplements if recommended',
      'Stay well hydrated throughout the day',
      'Get regular blood work monitoring as advised',
      'Report unusual fatigue, weakness, or unexplained bleeding',
      'Avoid unnecessary medications that may affect blood counts'
    ],
    'liver': [
      'Limit or avoid alcohol consumption',
      'Avoid unnecessary medications and supplements',
      'Maintain a healthy weight to prevent fatty liver',
      'Get hepatitis vaccinations if recommended',
      'Eat a balanced diet rich in fruits and vegetables'
    ],
    'kidney': [
      'Stay well hydrated with adequate water intake',
      'Monitor and control blood pressure',
      'Limit protein intake if advised by your doctor',
      'Avoid nephrotoxic medications when possible',
      'Control diabetes and blood pressure to protect kidney function'
    ],
    'thyroid': [
      'Take thyroid medications consistently at the same time',
      'Avoid taking thyroid medication with certain foods or supplements',
      'Monitor for symptoms of hypo or hyperthyroidism',
      'Get regular follow-up testing as recommended',
      'Inform all healthcare providers about your thyroid condition'
    ]
  };
  
  categories.forEach(category => {
    if (categoryTips[category]) {
      tips.push({
        category: category.charAt(0).toUpperCase() + category.slice(1),
        tips: categoryTips[category]
      });
    }
  });
  
  return tips;
};

const calculateOverallRisk = (criticalParams, abnormalParams, normalParams) => {
  const total = criticalParams.length + abnormalParams.length + normalParams.length;
  const criticalRatio = criticalParams.length / total;
  const abnormalRatio = abnormalParams.length / total;
  
  let risk = 'low';
  let riskScore = 0;
  
  if (criticalRatio > 0.3 || criticalParams.length >= 3) {
    risk = 'high';
    riskScore = 8;
  } else if (criticalRatio > 0.1 || criticalParams.length >= 1) {
    risk = 'moderate';
    riskScore = 6;
  } else if (abnormalRatio > 0.5 || abnormalParams.length >= 4) {
    risk = 'moderate';
    riskScore = 5;
  } else if (abnormalRatio > 0.2 || abnormalParams.length >= 2) {
    risk = 'low-moderate';
    riskScore = 3;
  }
  
  return { risk, riskScore, criticalRatio, abnormalRatio };
};

const generateSummary = (parameters, criticalParams, abnormalParams, riskAssessment) => {
  const total = parameters.length;
  const critical = criticalParams.length;
  const abnormal = abnormalParams.length;
  const normal = total - critical - abnormal;
  
  let summary = `Lab Report Analysis: ${total} parameters analyzed. `;
  
  if (critical > 0) {
    summary += `🚨 ${critical} CRITICAL values requiring immediate medical attention. `;
  }
  
  if (abnormal > 0) {
    summary += `⚠️ ${abnormal} values outside normal range need attention. `;
  }
  
  summary += `✅ ${normal} values within normal limits. `;
  
  // Risk-based recommendations
  if (riskAssessment.risk === 'high') {
    summary += '\n\n🚨 HIGH RISK: Multiple critical abnormalities detected. Seek immediate medical care and follow up regularly.';
  } else if (riskAssessment.risk === 'moderate') {
    summary += '\n\n⚠️ MODERATE RISK: Some concerning values found. Schedule an appointment with your healthcare provider soon.';
  } else if (riskAssessment.risk === 'low-moderate') {
    summary += '\n\n📋 MILD CONCERN: A few values need attention. Discuss with your healthcare provider at your next visit.';
  } else {
    summary += '\n\n✅ LOW RISK: Most values are normal. Continue healthy lifestyle practices and regular monitoring.';
  }
  
  // Final advice
  if (critical > 0) {
    summary += '\n\n⚡ URGENT: Contact your healthcare provider immediately for critical values.';
  } else if (abnormal > 0) {
    summary += '\n\n📞 Follow up with your healthcare provider to discuss abnormal values and create a management plan.';
  }
  
  return summary;
};