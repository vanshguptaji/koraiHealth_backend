import Tesseract from 'tesseract.js';
import fs from 'fs';

export const extractTextFromFileSimple = async (filePath, mimeType) => {
  try {
    console.log(`Starting text extraction for file type: ${mimeType}`);
    console.log(`File path: ${filePath}`);
    
    // Verify file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Get file stats
    const stats = fs.statSync(filePath);
    console.log(`File size: ${stats.size} bytes`);

    if (mimeType === 'application/pdf') {
      return await extractTextFromPDF(filePath);
    } else if (mimeType.startsWith('image/')) {
      return await extractTextFromImage(filePath);
    } else {
      return `File type ${mimeType} does not support text extraction.`;
    }
  } catch (error) {
    console.error('Text extraction error:', error);
    return `Text extraction failed: ${error.message}`;
  }
};

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const extractTextFromPDF = async (filePath) => {
  try {
    // Alternative using pdf2json
    const PDFParser = require('pdf2json');

    return new Promise((resolve, reject) => {
      const pdfParser = new PDFParser();
      
      pdfParser.on('pdfParser_dataError', errData => {
        console.error('PDF parsing error:', errData.parserError);
        reject(new Error('Failed to parse PDF'));
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
            console.log(`Successfully extracted ${cleanText.length} characters from PDF`);
            resolve(cleanText);
          } else {
            resolve("This PDF appears to be image-based or contains no extractable text.");
          }
        } catch (error) {
          reject(error);
        }
      });
      
      pdfParser.loadPDF(filePath);
    });
  } catch (error) {
    console.error('PDF extraction error:', error);
    return `PDF processing failed: ${error.message}`;
  }
};

const extractTextFromImage = async (imagePath) => {
  try {
    console.log(`Processing image with OCR: ${imagePath}`);
    
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

// Helper function to clean up extracted text
export const cleanExtractedText = (text) => {
  if (!text) return "";
  
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .replace(/[^\w\s\n.,;:()\[\]{}\-\/=<>]/g, '')
    .trim();
};

// Helper function to detect if text contains health/lab data
export const detectHealthContent = (text) => {
  const healthKeywords = [
    'glucose', 'cholesterol', 'hemoglobin', 'blood', 'urine', 'test', 'result',
    'normal', 'abnormal', 'mg/dl', 'mmol/l', 'g/dl', 'lab', 'laboratory',
    'patient', 'doctor', 'hospital', 'clinic', 'medical', 'report', 'serum',
    'plasma', 'analysis', 'reference', 'range', 'high', 'low', 'within', 'limits'
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
  
  return {
    isHealthRelated: foundKeywords.length >= 2,
    confidence: Math.min(100, (foundKeywords.length / healthKeywords.length) * 100),
    foundKeywords,
    textLength: text.length
  };
};

// Simple fallback version
export const extractTextFromFile = extractTextFromFileSimple;