import Tesseract from 'tesseract.js';
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Enhanced main extraction function with multiple fallback methods
export const extractTextFromFileSimple = async (filePath, mimeType) => {
  try {
    console.log(`Starting enhanced text extraction for file type: ${mimeType}`);
    console.log(`File path: ${filePath}`);
    
    // Verify file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Get file stats
    const stats = fs.statSync(filePath);
    console.log(`File size: ${stats.size} bytes`);

    if (mimeType === 'application/pdf') {
      return await extractTextFromPDFEnhanced(filePath);
    } else if (mimeType.startsWith('image/')) {
      return await extractTextFromImageEnhanced(filePath);
    } else {
      return `File type ${mimeType} does not support text extraction.`;
    }
  } catch (error) {
    console.error('Enhanced text extraction error:', error);
    return `Text extraction failed: ${error.message}`;
  }
};

// Enhanced PDF extraction with multiple methods
const extractTextFromPDFEnhanced = async (filePath) => {
  console.log("Starting enhanced PDF extraction...");
  
  // Method 1: Try standard PDF parsing first
  let extractedText = await extractTextFromPDF(filePath);
  
  // Method 2: If standard parsing fails or returns minimal text, use OCR
  if (!extractedText || extractedText.length < 50 || 
      extractedText.includes("image-based") || 
      extractedText.includes("no extractable text")) {
    
    console.log("Standard PDF parsing insufficient, switching to OCR method...");
    extractedText = await extractTextFromPDFWithOCR(filePath);
  }
  
  // Method 3: Try pdf-parse as additional fallback
  if (!extractedText || extractedText.length < 50) {
    console.log("OCR also insufficient, trying pdf-parse fallback...");
    extractedText = await extractTextFromPDFParse(filePath);
  }
  
  return extractedText;
};

// Original PDF extraction method
const extractTextFromPDF = async (filePath) => {
  try {
    const PDFParser = require('pdf2json');

    return new Promise((resolve, reject) => {
      const pdfParser = new PDFParser();
      
      pdfParser.on('pdfParser_dataError', errData => {
        console.error('PDF parsing error:', errData.parserError);
        resolve(""); // Don't reject, just return empty to try next method
      });
      
      pdfParser.on('pdfParser_dataReady', pdfData => {
        try {
          let text = '';
          
          if (pdfData.Pages) {
            pdfData.Pages.forEach(page => {
              if (page.Texts) {
                page.Texts.forEach(textObj => {
                  if (textObj.R) {
                    textObj.R.forEach(textRun => {
                      if (textRun.T) {
                        text += decodeURIComponent(textRun.T) + ' ';
                      }
                    });
                  }
                });
              }
            });
          }
          
          if (text.trim().length > 5) {
            const cleanText = cleanExtractedText(text);
            console.log(`Standard PDF extraction: ${cleanText.length} characters`);
            resolve(cleanText);
          } else {
            resolve("");
          }
        } catch (error) {
          resolve("");
        }
      });
      
      pdfParser.loadPDF(filePath);
    });
  } catch (error) {
    console.error('Standard PDF extraction error:', error);
    return "";
  }
};

// OCR-based PDF extraction for scanned/image PDFs
const extractTextFromPDFWithOCR = async (filePath) => {
  try {
    console.log("Starting OCR-based PDF extraction...");
    
    // Use Tesseract directly on PDF with enhanced config for health documents
    const { data: { text } } = await Tesseract.recognize(filePath, 'eng', {
      logger: m => {
        if (m.status === 'recognizing text') {
          console.log(`PDF OCR Progress: ${Math.round(m.progress * 100)}%`);
        }
      },
      tessedit_pageseg_mode: Tesseract.PSM.AUTO,
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,()/-: %<>',
      tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY
    });
    
    console.log(`PDF OCR completed. Raw text length: ${text.length}`);
    
    if (text && text.trim().length > 10) {
      const cleanText = cleanExtractedText(text);
      console.log(`OCR PDF extraction: ${cleanText.length} characters`);
      return cleanText;
    } else {
      return "";
    }
  } catch (error) {
    console.error('OCR PDF extraction error:', error);
    return "";
  }
};

// Fallback using pdf-parse library
const extractTextFromPDFParse = async (filePath) => {
  try {
    const pdfParse = require('pdf-parse');
    const dataBuffer = fs.readFileSync(filePath);
    
    const data = await pdfParse(dataBuffer, {
      normalizeWhitespace: true,
      disableCombineTextItems: false
    });
    
    if (data.text && data.text.length > 10) {
      const cleanText = cleanExtractedText(data.text);
      console.log(`pdf-parse extraction: ${cleanText.length} characters`);
      return cleanText;
    } else {
      return "";
    }
  } catch (error) {
    console.error('pdf-parse extraction error:', error);
    return "";
  }
};

// Enhanced image extraction with preprocessing
const extractTextFromImageEnhanced = async (imagePath) => {
  try {
    console.log(`Starting enhanced image OCR: ${imagePath}`);
    
    // Try multiple OCR configurations for better results
    const ocrConfigs = [
      // Config 1: Standard configuration for health documents
      {
        tessedit_pageseg_mode: Tesseract.PSM.AUTO,
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,()/-: %<>',
        tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY
      },
      // Config 2: For structured documents
      {
        tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,()/-: %<>'
      },
      // Config 3: For tables and forms
      {
        tessedit_pageseg_mode: Tesseract.PSM.SINGLE_COLUMN,
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,()/-: %<>'
      }
    ];
    
    let bestResult = "";
    let maxLength = 0;
    
    for (const config of ocrConfigs) {
      try {
        console.log(`Trying OCR config: ${config.tessedit_pageseg_mode}`);
        
        const { data: { text } } = await Tesseract.recognize(imagePath, 'eng', {
          logger: m => {
            if (m.status === 'recognizing text') {
              console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
            }
          },
          ...config
        });
        
        if (text && text.length > maxLength) {
          maxLength = text.length;
          bestResult = text;
          console.log(`Better result found with length: ${text.length}`);
        }
      } catch (configError) {
        console.error(`OCR config failed:`, configError.message);
        continue;
      }
    }
    
    console.log(`Best OCR result length: ${maxLength}`);
    
    if (bestResult && bestResult.trim().length > 0) {
      const cleanText = cleanExtractedText(bestResult);
      console.log(`Successfully extracted ${cleanText.length} characters from image`);
      return cleanText;
    } else {
      return "No text could be detected in this image.";
    }
  } catch (error) {
    console.error('Enhanced image OCR error:', error);
    return `Image text extraction failed: ${error.message}`;
  }
};

// Original image extraction as fallback
const extractTextFromImage = async (imagePath) => {
  try {
    console.log(`Processing image with standard OCR: ${imagePath}`);
    
    const { data: { text } } = await Tesseract.recognize(imagePath, 'eng', {
      logger: m => {
        if (m.status === 'recognizing text') {
          console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
        }
      }
    });
    
    console.log(`OCR completed. Raw text length: ${text.length}`);
    
    if (text && text.trim().length > 0) {
      const cleanText = cleanExtractedText(text);
      console.log(`Successfully extracted ${cleanText.length} characters from image`);
      return cleanText;
    } else {
      return "No text could be detected in this image.";
    }
  } catch (error) {
    console.error('Image OCR error:', error);
    return `Image text extraction failed: ${error.message}`;
  }
};

// Enhanced text cleaning with better health data preservation
export const cleanExtractedText = (text) => {
  if (!text) return "";
  
  return text
    // Normalize whitespace but preserve structure
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    // Preserve important medical characters and units
    .replace(/[^\w\s\n.,;:()\[\]{}\-\/=<>%µμ]/g, '')
    // Fix common OCR errors in medical terms
    .replace(/\bl\b/g, '1') // Common OCR mistake: l instead of 1
    .replace(/\bO\b/g, '0') // Common OCR mistake: O instead of 0
    .replace(/\bmg\/dl\b/gi, 'mg/dl')
    .replace(/\biu\/ml\b/gi, 'IU/mL')
    .replace(/\bpg\/ml\b/gi, 'pg/mL')
    .replace(/\bng\/dl\b/gi, 'ng/dL')
    .replace(/\bmeq\/l\b/gi, 'mEq/L')
    .replace(/\bmmol\/l\b/gi, 'mmol/L')
    .replace(/\bu\/l\b/gi, 'U/L')
    .replace(/\bg\/dl\b/gi, 'g/dL')
    .trim();
};

// Enhanced health content detection with more comprehensive keywords
export const detectHealthContent = (text) => {
  const healthKeywords = [
    // Blood tests
    'glucose', 'cholesterol', 'hemoglobin', 'haemoglobin', 'hematocrit', 'haematocrit',
    'blood', 'urine', 'test', 'result', 'normal', 'abnormal', 'high', 'low',
    
    // Units
    'mg/dl', 'mmol/l', 'g/dl', 'iu/ml', 'pg/ml', 'ng/dl', 'meq/l', 'u/l',
    
    // Medical terms
    'lab', 'laboratory', 'patient', 'doctor', 'hospital', 'clinic', 'medical',
    'report', 'serum', 'plasma', 'analysis', 'reference', 'range', 'within', 'limits',
    
    // Specific tests
    'hba1c', 'tsh', 'thyroid', 'liver', 'kidney', 'creatinine', 'urea', 'bilirubin',
    'alt', 'ast', 'hdl', 'ldl', 'triglycerides', 'sodium', 'potassium', 'chloride',
    'rbc', 'wbc', 'platelet', 'mcv', 'mch', 'mchc', 'esr', 'crp',
    
    // Health conditions
    'diabetes', 'hypertension', 'anemia', 'anaemia', 'infection', 'inflammation',
    
    // Lab report structure
    'name', 'age', 'gender', 'date', 'specimen', 'collected', 'received'
  ];
  
  if (!text || text.length === 0) {
    return {
      isHealthRelated: false,
      confidence: 0,
      foundKeywords: [],
      textLength: 0
    };
  }
  
  const textLower = text.toLowerCase();
  const foundKeywords = healthKeywords.filter(keyword => 
    textLower.includes(keyword.toLowerCase())
  );
  
  // Enhanced confidence calculation
  const keywordDensity = foundKeywords.length / healthKeywords.length;
  const textLengthFactor = Math.min(1, text.length / 100); // Longer text gets slight boost
  const unitPresence = ['mg/dl', 'iu/ml', 'g/dl', 'mmol/l'].some(unit => 
    textLower.includes(unit.toLowerCase())
  ) ? 1.2 : 1; // Boost if medical units present
  
  const confidence = Math.min(100, keywordDensity * 100 * textLengthFactor * unitPresence);
  
  return {
    isHealthRelated: foundKeywords.length >= 3 || confidence > 15,
    confidence: Math.round(confidence * 100) / 100,
    foundKeywords,
    textLength: text.length,
    hasUnits: unitPresence > 1,
    keywordDensity: Math.round(keywordDensity * 10000) / 100 // Percentage with 2 decimals
  };
};

// Export for backward compatibility
export const extractTextFromFile = extractTextFromFileSimple;