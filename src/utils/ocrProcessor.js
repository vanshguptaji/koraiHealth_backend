import Tesseract from 'tesseract.js';
import fs from 'fs';
import path from 'path';

export const extractTextFromFile = async (filePath, mimeType) => {
  try {
    console.log(`Starting text extraction for file type: ${mimeType}`);
    
    if (mimeType === 'application/pdf') {
      return await extractTextFromPDF(filePath);
    } else if (mimeType.startsWith('image/')) {
      return await extractTextFromImage(filePath);
    } else {
      throw new Error(`Unsupported file type for text extraction: ${mimeType}`);
    }
  } catch (error) {
    console.error('Text extraction error:', error);
    throw error;
  }
};

const extractTextFromPDF = async (filePath) => {
  try {
    // First try to extract text directly from PDF
    const pdf = await import('pdf-parse');
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdf.default(dataBuffer);
    
    if (pdfData.text && pdfData.text.trim().length > 50) {
      console.log('PDF has selectable text');
      return cleanExtractedText(pdfData.text);
    } else {
      console.log('PDF appears to be image-based, using OCR');
      return await extractTextFromPDFImages(filePath);
    }
  } catch (error) {
    console.error('PDF text extraction error:', error);
    // Fallback to OCR
    return await extractTextFromPDFImages(filePath);
  }
};

const extractTextFromPDFImages = async (filePath) => {
  try {
    const { fromPath } = await import('pdf2pic');
    
    const convert = fromPath(filePath, {
      density: 300,
      saveFilename: "page",
      savePath: "./public/temp/",
      format: "png",
      width: 2000,
      height: 2000
    });

    // Convert first 3 pages maximum to avoid long processing times
    const pageLimit = 3;
    let extractedText = '';

    for (let i = 1; i <= pageLimit; i++) {
      try {
        const result = await convert(i);
        if (result && result.path) {
          const pageText = await extractTextFromImage(result.path);
          extractedText += `\n--- Page ${i} ---\n${pageText}\n`;
          
          // Clean up temporary image
          if (fs.existsSync(result.path)) {
            fs.unlinkSync(result.path);
          }
        }
      } catch (pageError) {
        console.error(`Error processing page ${i}:`, pageError);
        break;
      }
    }

    return cleanExtractedText(extractedText);
  } catch (error) {
    console.error('PDF to image conversion error:', error);
    throw new Error('Failed to extract text from PDF');
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
    
    return cleanExtractedText(text);
  } catch (error) {
    console.error('Image OCR error:', error);
    throw new Error('Failed to extract text from image');
  }
};

// Helper function to clean up extracted text
export const cleanExtractedText = (text) => {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, '\n')
    .replace(/[^\w\s\n.,;:()[\]{}-]/g, '')
    .trim();
};

// Helper function to detect if file might contain health data
export const detectHealthContent = (text) => {
  const healthKeywords = [
    'glucose', 'cholesterol', 'hemoglobin', 'blood', 'urine', 'test', 'result',
    'normal', 'abnormal', 'mg/dl', 'mmol/l', 'g/dl', 'lab', 'laboratory',
    'patient', 'doctor', 'hospital', 'clinic', 'medical', 'report'
  ];
  
  const textLower = text.toLowerCase();
  const foundKeywords = healthKeywords.filter(keyword => 
    textLower.includes(keyword)
  );
  
  return {
    isHealthRelated: foundKeywords.length >= 2,
    confidence: (foundKeywords.length / healthKeywords.length) * 100,
    foundKeywords
  };
};