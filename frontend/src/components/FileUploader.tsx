import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  CloudArrowUpIcon, 
  XMarkIcon,
  ExclamationCircleIcon 
} from '@heroicons/react/24/outline';
import { validateFiles, formatFileSize, getFileTypeIcon } from '../utils/validation';

interface FileUploaderProps {
  onFilesSelected: (files: File[]) => void;
  acceptedTypes: string[];
  maxFileSize: number;
  multiple?: boolean;
  disabled?: boolean;
}

interface SelectedFile extends File {
  id: string;
}

const FileUploader: React.FC<FileUploaderProps> = ({
  onFilesSelected,
  acceptedTypes,
  maxFileSize,
  multiple = false,
  disabled = false,
}) => {
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFiles = useCallback((files: File[]) => {
    if (disabled) return;

    setError(null);
    const validation = validateFiles(files, acceptedTypes, maxFileSize);
    
    if (!validation.valid) {
      setError(validation.error!);
      return;
    }

    const filesWithId = files.map(file => ({
      ...file,
      id: Math.random().toString(36).substring(7),
    })) as SelectedFile[];

    if (multiple) {
      setSelectedFiles(prev => [...prev, ...filesWithId]);
    } else {
      setSelectedFiles(filesWithId);
    }

    onFilesSelected(files);
  }, [disabled, multiple, onFilesSelected, acceptedTypes, maxFileSize]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    handleFiles(acceptedFiles);
  }, [handleFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptedTypes.reduce((acc, type) => {
      acc[type] = [];
      return acc;
    }, {} as Record<string, string[]>),
    maxSize: maxFileSize,
    multiple,
    disabled,
    onDragEnter: () => setDragActive(true),
    onDragLeave: () => setDragActive(false),
  });

  const removeFile = (fileId: string) => {
    setSelectedFiles(prev => prev.filter(file => file.id !== fileId));
  };

  const getAcceptedTypesDisplay = () => {
    const typeNames = acceptedTypes.map(type => {
      if (type.includes('pdf')) return 'PDF';
      if (type.includes('word') || type.includes('docx')) return 'DOCX';
      if (type.includes('presentation') || type.includes('pptx')) return 'PPTX';
      if (type.includes('text')) return 'TXT';
      return type.split('/')[1].toUpperCase();
    });
    return typeNames.join('、');
  };

  return (
    <div className="w-full">
      {/* Drop Zone */}
      <div
        {...getRootProps()}
        data-testid="drop-zone"
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
          ${dragActive || isDragActive 
            ? 'border-primary-500 bg-primary-50' 
            : 'border-gray-300 hover:border-gray-400'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          ${error ? 'border-red-300 bg-red-50' : ''}
        `}
      >
        <input {...getInputProps()} data-testid="file-input" />
        
        <div className="flex flex-col items-center space-y-4">
          <CloudArrowUpIcon className="h-12 w-12 text-gray-400" />
          
          <div className="space-y-2">
            <p className="text-lg font-medium text-gray-900">
              ファイルをドラッグ&ドロップ
            </p>
            <button
              type="button"
              className="text-primary-600 hover:text-primary-500 font-medium"
              disabled={disabled}
            >
              クリックしてファイルを選択
            </button>
          </div>
          
          <div className="text-sm text-gray-500 space-y-1">
            <p>対応形式: {getAcceptedTypesDisplay()}</p>
            <p>最大{Math.round(maxFileSize / (1024 * 1024))}MB</p>
            {multiple && <p>複数ファイル選択可</p>}
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-4 flex items-center space-x-2 text-red-600 text-sm">
          <ExclamationCircleIcon className="h-5 w-5" />
          <span>{error}</span>
        </div>
      )}

      {/* Selected Files Preview */}
      {selectedFiles.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-gray-900 mb-3">
            選択されたファイル ({selectedFiles.length})
          </h4>
          <div className="space-y-2">
            {selectedFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">
                    {getFileTypeIcon(file.type)}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => removeFile(file.id)}
                  className="p-1 hover:bg-gray-200 rounded-full transition-colors"
                  aria-label="削除"
                >
                  <XMarkIcon className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUploader;