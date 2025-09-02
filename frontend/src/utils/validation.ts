import type { ValidationResult } from '../types';

const SUPPORTED_FILE_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
];

const SUPPORTED_EXTENSIONS = ['.pdf', '.docx', '.pptx', '.txt'];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const validateFile = (file: File, allowedTypes?: string[], maxSize?: number): ValidationResult => {
  const maxFileSize = maxSize || MAX_FILE_SIZE;
  const supportedTypes = allowedTypes || SUPPORTED_FILE_TYPES;
  
  // Check file size
  if (file.size > maxFileSize) {
    return {
      valid: false,
      error: `ファイルサイズが大きすぎます（最大${Math.round(maxFileSize / (1024 * 1024))}MB）`,
    };
  }

  // Check file type
  if (!supportedTypes.includes(file.type)) {
    // Also check by extension as fallback
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    const supportedExtensions = allowedTypes ? 
      allowedTypes.map(type => {
        if (type.includes('pdf')) return '.pdf';
        if (type.includes('word') || type.includes('docx')) return '.docx';
        if (type.includes('presentation') || type.includes('pptx')) return '.pptx';
        if (type.includes('text')) return '.txt';
        return '';
      }).filter(Boolean) : 
      SUPPORTED_EXTENSIONS;
      
    if (!supportedExtensions.includes(extension)) {
      return {
        valid: false,
        error: 'サポートされていないファイル形式です（PDF、DOCX、PPTX、TXTのみ）',
      };
    }
  }

  return { valid: true };
};

export const validateFiles = (files: File[], allowedTypes?: string[], maxSize?: number): ValidationResult => {
  for (const file of files) {
    const result = validateFile(file, allowedTypes, maxSize);
    if (!result.valid) {
      return result;
    }
  }
  return { valid: true };
};

export const sanitizeQuery = (query: string): string => {
  return query.trim().replace(/[<>]/g, '');
};

export const validateQuery = (query: string): ValidationResult => {
  const sanitized = sanitizeQuery(query);
  
  if (!sanitized) {
    return {
      valid: false,
      error: '質問を入力してください',
    };
  }

  if (sanitized.length < 3) {
    return {
      valid: false,
      error: '質問は3文字以上入力してください',
    };
  }

  if (sanitized.length > 500) {
    return {
      valid: false,
      error: '質問は500文字以内で入力してください',
    };
  }

  return { valid: true };
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const getFileExtension = (fileName: string): string => {
  return '.' + fileName.split('.').pop()?.toLowerCase() || '';
};

export const getFileTypeIcon = (fileType: string): string => {
  if (fileType.includes('pdf')) return '📄';
  if (fileType.includes('word') || fileType.includes('docx')) return '📝';
  if (fileType.includes('presentation') || fileType.includes('pptx')) return '📊';
  if (fileType.includes('text')) return '📃';
  return '📎';
};