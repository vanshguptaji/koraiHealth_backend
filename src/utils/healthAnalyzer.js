import { HealthParameter } from "../models/healthParameter.model.js";

// Comprehensive health parameter patterns and definitions
export const parseHealthParameters = (text, reportId, userId) => {
  console.log("Starting comprehensive health parameter parsing...");
  const parameters = [];
  
  // Clean and normalize text
  const cleanText = text
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s.,()/-:]/g, ' ')
    .toLowerCase();
  
  console.log("Cleaned text sample:", cleanText.substring(0, 500));
  
  // Comprehensive parameter definitions with multiple search patterns
  const healthParameters = [
    // Blood Count Parameters
    {
      names: ["hemoglobin", "haemoglobin", "hgb", "hb"],
      patterns: [
        /(?:hemoglobin|haemoglobin|hgb|hb)[:\s]*(\d+\.?\d*)[^\d]*(?:g\/dl|gm\/dl|g%)/gi,
        /hb[:\s]*(\d+\.?\d*)[^\d]*(?:g\/dl|gm\/dl)/gi,
        /(?:hemoglobin|haemoglobin)[:\s]*(\d+\.?\d*)/gi
      ],
      extractPattern: /(\d+\.?\d+)/g,
      unit: "g/dl",
      category: "hematology",
      normalRange: { min: 12, max: 15.5, text: "12.0-15.5" }
    },
    {
      names: ["hematocrit", "haematocrit", "hct", "pcv"],
      patterns: [
        /(?:hematocrit|haematocrit|hct|pcv)[:\s]*(\d+\.?\d*)[^\d]*%/gi,
        /(?:hematocrit|haematocrit|hct|pcv)[:\s]*(\d+\.?\d*)/gi
      ],
      extractPattern: /(\d+\.?\d+)/g,
      unit: "%",
      category: "hematology",
      normalRange: { min: 36, max: 46, text: "36-46" }
    },
    {
      names: ["rbc", "red blood cell", "erythrocyte"],
      patterns: [
        /(?:rbc|red blood cell|erythrocyte)[:\s]*(\d+\.?\d*)[^\d]*(?:million\/ul|10\^6\/ul)/gi,
        /(?:rbc|red blood cell|erythrocyte)[:\s]*(\d+\.?\d*)/gi
      ],
      extractPattern: /(\d+\.?\d+)/g,
      unit: "million/uL",
      category: "hematology",
      normalRange: { min: 4.2, max: 5.4, text: "4.2-5.4" }
    },
    {
      names: ["wbc", "white blood cell", "leukocyte"],
      patterns: [
        /(?:wbc|white blood cell|leukocyte)[:\s]*(\d+\.?\d*)[^\d]*(?:\/ul|cells\/ul|10\^3\/ul)/gi,
        /(?:wbc|white blood cell|leukocyte)[:\s]*(\d+\.?\d*)/gi
      ],
      extractPattern: /(\d+)/g,
      unit: "/uL",
      category: "hematology",
      normalRange: { min: 4000, max: 11000, text: "4000-11000" }
    },
    {
      names: ["platelet", "plt"],
      patterns: [
        /(?:platelet|plt)[:\s]*(\d+\.?\d*)[^\d]*(?:\/ul|10\^3\/ul)/gi,
        /(?:platelet|plt)[:\s]*(\d+\.?\d*)/gi
      ],
      extractPattern: /(\d+)/g,
      unit: "/uL",
      category: "hematology",
      normalRange: { min: 150000, max: 450000, text: "150000-450000" }
    },
    
    // Diabetes Parameters
    {
      names: ["glucose", "blood sugar", "fasting glucose", "random glucose"],
      patterns: [
        /(?:glucose|blood sugar|fasting glucose|random glucose)[:\s]*(\d+\.?\d*)[^\d]*mg\/dl/gi,
        /(?:fbs|rbs)[:\s]*(\d+\.?\d*)[^\d]*mg\/dl/gi,
        /(?:glucose|blood sugar|fasting glucose|random glucose)[:\s]*(\d+\.?\d*)/gi
      ],
      extractPattern: /(\d+)/g,
      unit: "mg/dl",
      category: "diabetes",
      normalRange: { min: 70, max: 100, text: "70-100" }
    },
    {
      names: ["hba1c", "hemoglobin a1c", "glycated hemoglobin"],
      patterns: [
        /(?:hba1c|hemoglobin a1c|glycated hemoglobin)[:\s]*(\d+\.?\d*)[^\d]*%/gi,
        /hba1c[:\s]*(\d+\.?\d*)/gi
      ],
      extractPattern: /(\d+\.?\d+)/g,
      unit: "%",
      category: "diabetes",
      normalRange: { min: 4, max: 5.6, text: "< 5.7" }
    },
    
    // Lipid Profile
    {
      names: ["total cholesterol", "cholesterol"],
      patterns: [
        /(?:total cholesterol|cholesterol)[:\s]*(\d+\.?\d*)[^\d]*mg\/dl/gi,
        /(?:total cholesterol|cholesterol)[:\s]*(\d+\.?\d*)/gi
      ],
      extractPattern: /(\d+)/g,
      unit: "mg/dl",
      category: "lipid",
      normalRange: { min: 0, max: 200, text: "< 200" }
    },
    {
      names: ["hdl cholesterol", "hdl"],
      patterns: [
        /(?:hdl cholesterol|hdl)[:\s]*(\d+\.?\d*)[^\d]*mg\/dl/gi,
        /(?:hdl cholesterol|hdl)[:\s]*(\d+\.?\d*)/gi
      ],
      extractPattern: /(\d+)/g,
      unit: "mg/dl",
      category: "lipid",
      normalRange: { min: 40, max: 200, text: "> 40" }
    },
    {
      names: ["ldl cholesterol", "ldl"],
      patterns: [
        /(?:ldl cholesterol|ldl)[:\s]*(\d+\.?\d*)[^\d]*mg\/dl/gi,
        /(?:ldl cholesterol|ldl)[:\s]*(\d+\.?\d*)/gi
      ],
      extractPattern: /(\d+)/g,
      unit: "mg/dl",
      category: "lipid",
      normalRange: { min: 0, max: 130, text: "< 130" }
    },
    {
      names: ["triglycerides", "tg"],
      patterns: [
        /(?:triglycerides|tg)[:\s]*(\d+\.?\d*)[^\d]*mg\/dl/gi,
        /(?:triglycerides|tg)[:\s]*(\d+\.?\d*)/gi
      ],
      extractPattern: /(\d+)/g,
      unit: "mg/dl",
      category: "lipid",
      normalRange: { min: 0, max: 150, text: "< 150" }
    },
    
    // Thyroid Function
    {
      names: ["tsh", "thyroid stimulating hormone"],
      patterns: [
        /(?:tsh|thyroid stimulating hormone)[:\s]*(\d+\.?\d*)[^\d]*(?:iu\/ml|miu\/l)/gi,
        /(?:tsh|thyroid stimulating hormone)[:\s]*(\d+\.?\d*)/gi
      ],
      extractPattern: /(\d+\.?\d+)/g,
      unit: "IU/mL",
      category: "thyroid",
      normalRange: { min: 0.4, max: 4.0, text: "0.4-4.0" }
    },
    {
      names: ["free t3", "ft3", "triiodothyronine"],
      patterns: [
        /(?:free t3|ft3|triiodothyronine)[:\s]*(\d+\.?\d*)[^\d]*(?:pg\/ml|pmol\/l)/gi,
        /(?:free t3|ft3|triiodothyronine)[:\s]*(\d+\.?\d*)/gi
      ],
      extractPattern: /(\d+\.?\d+)/g,
      unit: "pg/mL",
      category: "thyroid",
      normalRange: { min: 2.3, max: 4.2, text: "2.3-4.2" }
    },
    {
      names: ["free t4", "ft4", "thyroxine"],
      patterns: [
        /(?:free t4|ft4|thyroxine)[:\s]*(\d+\.?\d*)[^\d]*(?:ng\/dl|pmol\/l)/gi,
        /(?:free t4|ft4|thyroxine)[:\s]*(\d+\.?\d*)/gi
      ],
      extractPattern: /(\d+\.?\d+)/g,
      unit: "ng/dl",
      category: "thyroid",
      normalRange: { min: 0.8, max: 1.8, text: "0.8-1.8" }
    },
    
    // Liver Function
    {
      names: ["alt", "alanine aminotransferase", "sgpt"],
      patterns: [
        /(?:alt|alanine aminotransferase|sgpt)[:\s]*(\d+\.?\d*)[^\d]*(?:u\/l|iu\/l)/gi,
        /(?:alt|alanine aminotransferase|sgpt)[:\s]*(\d+\.?\d*)/gi
      ],
      extractPattern: /(\d+)/g,
      unit: "U/L",
      category: "liver",
      normalRange: { min: 0, max: 40, text: "< 40" }
    },
    {
      names: ["ast", "aspartate aminotransferase", "sgot"],
      patterns: [
        /(?:ast|aspartate aminotransferase|sgot)[:\s]*(\d+\.?\d*)[^\d]*(?:u\/l|iu\/l)/gi,
        /(?:ast|aspartate aminotransferase|sgot)[:\s]*(\d+\.?\d*)/gi
      ],
      extractPattern: /(\d+)/g,
      unit: "U/L",
      category: "liver",
      normalRange: { min: 0, max: 40, text: "< 40" }
    },
    {
      names: ["bilirubin", "total bilirubin"],
      patterns: [
        /(?:bilirubin|total bilirubin)[:\s]*(\d+\.?\d*)[^\d]*mg\/dl/gi,
        /(?:bilirubin|total bilirubin)[:\s]*(\d+\.?\d*)/gi
      ],
      extractPattern: /(\d+\.?\d+)/g,
      unit: "mg/dl",
      category: "liver",
      normalRange: { min: 0.2, max: 1.2, text: "0.2-1.2" }
    },
    
    // Kidney Function
    {
      names: ["creatinine", "serum creatinine"],
      patterns: [
        /(?:creatinine|serum creatinine)[:\s]*(\d+\.?\d*)[^\d]*mg\/dl/gi,
        /(?:creatinine|serum creatinine)[:\s]*(\d+\.?\d*)/gi
      ],
      extractPattern: /(\d+\.?\d+)/g,
      unit: "mg/dl",
      category: "kidney",
      normalRange: { min: 0.6, max: 1.2, text: "0.6-1.2" }
    },
    {
      names: ["urea", "blood urea", "bun"],
      patterns: [
        /(?:urea|blood urea|bun)[:\s]*(\d+\.?\d*)[^\d]*mg\/dl/gi,
        /(?:urea|blood urea|bun)[:\s]*(\d+\.?\d*)/gi
      ],
      extractPattern: /(\d+)/g,
      unit: "mg/dl",
      category: "kidney",
      normalRange: { min: 7, max: 20, text: "7-20" }
    },
    
    // Electrolytes
    {
      names: ["sodium", "na"],
      patterns: [
        /(?:sodium|na)[:\s]*(\d+\.?\d*)[^\d]*(?:meq\/l|mmol\/l)/gi,
        /(?:sodium|na)[:\s]*(\d+\.?\d*)/gi
      ],
      extractPattern: /(\d+)/g,
      unit: "mEq/L",
      category: "electrolyte",
      normalRange: { min: 136, max: 145, text: "136-145" }
    },
    {
      names: ["potassium", "k"],
      patterns: [
        /(?:potassium|k)[:\s]*(\d+\.?\d*)[^\d]*(?:meq\/l|mmol\/l)/gi,
        /(?:potassium|k)[:\s]*(\d+\.?\d*)/gi
      ],
      extractPattern: /(\d+\.?\d+)/g,
      unit: "mEq/L",
      category: "electrolyte",
      normalRange: { min: 3.5, max: 5.0, text: "3.5-5.0" }
    },
    {
      names: ["chloride", "cl"],
      patterns: [
        /(?:chloride|cl)[:\s]*(\d+\.?\d*)[^\d]*(?:meq\/l|mmol\/l)/gi,
        /(?:chloride|cl)[:\s]*(\d+\.?\d*)/gi
      ],
      extractPattern: /(\d+)/g,
      unit: "mEq/L",
      category: "electrolyte",
      normalRange: { min: 98, max: 107, text: "98-107" }
    }
  ];
  
  // Try advanced parsing first - look for patterns with values
  healthParameters.forEach(param => {
    let found = false;
    
    // Try each pattern for this parameter
    for (const pattern of param.patterns) {
      pattern.lastIndex = 0; // Reset regex
      const match = pattern.exec(cleanText);
      
      if (match && !found) {
        const value = parseFloat(match[1]);
        
        if (!isNaN(value) && value > 0) {
          parameters.push({
            name: param.names[0],
            value: value,
            unit: param.unit,
            referenceRange: param.normalRange,
            status: determineParameterStatus(value, param.normalRange),
            category: param.category,
            reportId: reportId,
            userId: userId,
            extractedFrom: match[0].trim()
          });
          
          console.log(`✓ Found: ${param.names[0]} = ${value} ${param.unit}`);
          found = true;
        }
      }
    }
    
    // If pattern matching failed, try proximity-based extraction
    if (!found) {
      for (const name of param.names) {
        const index = cleanText.indexOf(name.toLowerCase());
        if (index !== -1) {
          const surrounding = cleanText.substring(index, index + 100);
          const numbers = surrounding.match(/(\d+\.?\d*)/g);
          
          if (numbers && numbers.length > 0) {
            const value = parseFloat(numbers[0]);
            if (!isNaN(value) && value > 0 && value < 1000) { // Basic sanity check
              parameters.push({
                name: param.names[0],
                value: value,
                unit: param.unit,
                referenceRange: param.normalRange,
                status: determineParameterStatus(value, param.normalRange),
                category: param.category,
                reportId: reportId,
                userId: userId,
                extractedFrom: `Proximity extraction: ${surrounding.substring(0, 50)}`
              });
              
              console.log(`✓ Proximity found: ${param.names[0]} = ${value} ${param.unit}`);
              found = true;
              break;
            }
          }
        }
      }
    }
  });
  
  console.log(`Advanced parsing extracted ${parameters.length} parameters`);
  return parameters;
};

const determineParameterStatus = (value, referenceRange) => {
  if (!referenceRange || typeof value !== 'number') return 'normal';
  
  const { min, max, text } = referenceRange;
  
  if (text && text.includes('<')) {
    const limit = parseFloat(text.match(/[\d.]+/)?.[0]);
    return value <= limit ? 'normal' : 'high';
  }
  
  if (text && text.includes('>')) {
    const limit = parseFloat(text.match(/[\d.]+/)?.[0]);
    return value >= limit ? 'normal' : 'low';
  }
  
  if (min !== undefined && max !== undefined) {
    if (value < min) return 'low';
    if (value > max) return 'high';
    return 'normal';
  }
  
  return 'normal';
};

// Keep your existing functions for validation and AI recommendations
export const validateHealthParameters = (parameters) => {
  const validatedParams = [];
  const seen = new Set();
  
  parameters.forEach(param => {
    const key = `${param.name}_${param.value}_${param.unit}`;
    
    if (!seen.has(key)) {
      if (param.value > 0 && param.name.length > 1 && param.category) {
        validatedParams.push(param);
        seen.add(key);
      }
    }
  });
  
  return validatedParams;
};

export const generateAIRecommendations = (parameters, extractedText) => {
  // Keep your existing implementation
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

  // Your existing recommendation logic here...
  return recommendations;
};