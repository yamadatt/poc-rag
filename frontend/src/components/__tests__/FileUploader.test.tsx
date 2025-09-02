
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FileUploader from '../FileUploader';

describe('FileUploader', () => {
  const mockOnFilesSelected = jest.fn();
  const acceptedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  const maxFileSize = 10 * 1024 * 1024; // 10MB

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render drop zone with correct text', () => {
    render(
      <FileUploader
        onFilesSelected={mockOnFilesSelected}
        acceptedTypes={acceptedTypes}
        maxFileSize={maxFileSize}
      />
    );

    expect(screen.getByText(/ファイルをドラッグ&ドロップ/)).toBeInTheDocument();
    expect(screen.getByText(/クリックしてファイルを選択/)).toBeInTheDocument();
  });

  it('should show accepted file types', () => {
    render(
      <FileUploader
        onFilesSelected={mockOnFilesSelected}
        acceptedTypes={acceptedTypes}
        maxFileSize={maxFileSize}
      />
    );

    expect(screen.getByText(/PDF、DOCX/)).toBeInTheDocument();
    expect(screen.getByText(/最大10MB/)).toBeInTheDocument();
  });

  it('should handle file selection through input', async () => {
    const user = userEvent.setup();
    render(
      <FileUploader
        onFilesSelected={mockOnFilesSelected}
        acceptedTypes={acceptedTypes}
        maxFileSize={maxFileSize}
      />
    );

    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf', size: 1024 });
    screen.getByRole('button', { name: /クリックしてファイルを選択/ });

    // Find the actual file input (hidden)
    const fileInput = screen.getByTestId('file-input');
    await user.upload(fileInput, file);

    expect(mockOnFilesSelected).toHaveBeenCalledWith([file]);
  });

  it('should handle multiple file selection when enabled', async () => {
    const user = userEvent.setup();
    render(
      <FileUploader
        onFilesSelected={mockOnFilesSelected}
        acceptedTypes={acceptedTypes}
        maxFileSize={maxFileSize}
        multiple={true}
      />
    );

    const files = [
      new File(['content1'], 'test1.pdf', { type: 'application/pdf', size: 1024 }),
      new File(['content2'], 'test2.pdf', { type: 'application/pdf', size: 2048 }),
    ];

    const fileInput = screen.getByTestId('file-input');
    await user.upload(fileInput, files);

    expect(mockOnFilesSelected).toHaveBeenCalledWith(files);
  });

  it('should validate file types', async () => {
    const user = userEvent.setup();
    render(
      <FileUploader
        onFilesSelected={mockOnFilesSelected}
        acceptedTypes={acceptedTypes}
        maxFileSize={maxFileSize}
      />
    );

    const invalidFile = new File(['content'], 'test.txt', { type: 'text/plain', size: 1024 });
    const fileInput = screen.getByTestId('file-input');

    await user.upload(fileInput, invalidFile);

    expect(mockOnFilesSelected).not.toHaveBeenCalled();
    expect(screen.getByText(/サポートされていないファイル形式/)).toBeInTheDocument();
  });

  it('should validate file size', async () => {
    const user = userEvent.setup();
    render(
      <FileUploader
        onFilesSelected={mockOnFilesSelected}
        acceptedTypes={acceptedTypes}
        maxFileSize={maxFileSize}
      />
    );

    const largeFile = new File(['x'.repeat(15 * 1024 * 1024)], 'large.pdf', { 
      type: 'application/pdf', 
      size: 15 * 1024 * 1024 
    });
    const fileInput = screen.getByTestId('file-input');

    await user.upload(fileInput, largeFile);

    expect(mockOnFilesSelected).not.toHaveBeenCalled();
    expect(screen.getByText(/ファイルサイズが大きすぎます/)).toBeInTheDocument();
  });

  it('should handle drag and drop', async () => {
    render(
      <FileUploader
        onFilesSelected={mockOnFilesSelected}
        acceptedTypes={acceptedTypes}
        maxFileSize={maxFileSize}
      />
    );

    const file = new File(['content'], 'test.pdf', { type: 'application/pdf', size: 1024 });
    const dropZone = screen.getByTestId('drop-zone');

    // Simulate drag enter
    const dragEnterEvent = new Event('dragenter', { bubbles: true });
    Object.defineProperty(dragEnterEvent, 'dataTransfer', {
      value: { files: [file] }
    });
    dropZone.dispatchEvent(dragEnterEvent);

    // Should show drag-over state
    await waitFor(() => {
      expect(dropZone).toHaveClass('border-primary-500');
    });

    // Simulate drop
    const dropEvent = new Event('drop', { bubbles: true });
    Object.defineProperty(dropEvent, 'dataTransfer', {
      value: { files: [file] }
    });
    dropZone.dispatchEvent(dropEvent);

    expect(mockOnFilesSelected).toHaveBeenCalledWith([file]);
  });

  it('should show file preview after selection', async () => {
    const user = userEvent.setup();
    render(
      <FileUploader
        onFilesSelected={mockOnFilesSelected}
        acceptedTypes={acceptedTypes}
        maxFileSize={maxFileSize}
      />
    );

    const file = new File(['content'], 'test.pdf', { type: 'application/pdf', size: 1024 });
    const fileInput = screen.getByTestId('file-input');

    await user.upload(fileInput, file);

    expect(screen.getByText('test.pdf')).toBeInTheDocument();
    expect(screen.getByText(/1.02 KB/)).toBeInTheDocument();
  });

  it('should allow removing selected files', async () => {
    const user = userEvent.setup();
    render(
      <FileUploader
        onFilesSelected={mockOnFilesSelected}
        acceptedTypes={acceptedTypes}
        maxFileSize={maxFileSize}
      />
    );

    const file = new File(['content'], 'test.pdf', { type: 'application/pdf', size: 1024 });
    const fileInput = screen.getByTestId('file-input');

    await user.upload(fileInput, file);

    expect(screen.getByText('test.pdf')).toBeInTheDocument();

    const removeButton = screen.getByRole('button', { name: /削除/ });
    await user.click(removeButton);

    expect(screen.queryByText('test.pdf')).not.toBeInTheDocument();
  });

  it('should be disabled when disabled prop is true', () => {
    render(
      <FileUploader
        onFilesSelected={mockOnFilesSelected}
        acceptedTypes={acceptedTypes}
        maxFileSize={maxFileSize}
        disabled={true}
      />
    );

    const dropZone = screen.getByTestId('drop-zone');
    expect(dropZone).toHaveClass('opacity-50', 'cursor-not-allowed');

    const fileInput = screen.getByTestId('file-input');
    expect(fileInput).toBeDisabled();
  });

  it('should clear error message after successful file selection', async () => {
    const user = userEvent.setup();
    render(
      <FileUploader
        onFilesSelected={mockOnFilesSelected}
        acceptedTypes={acceptedTypes}
        maxFileSize={maxFileSize}
      />
    );

    // First, try invalid file
    const invalidFile = new File(['content'], 'test.txt', { type: 'text/plain', size: 1024 });
    const fileInput = screen.getByTestId('file-input');

    await user.upload(fileInput, invalidFile);
    expect(screen.getByText(/サポートされていないファイル形式/)).toBeInTheDocument();

    // Then, try valid file
    const validFile = new File(['content'], 'test.pdf', { type: 'application/pdf', size: 1024 });
    await user.upload(fileInput, validFile);

    expect(screen.queryByText(/サポートされていないファイル形式/)).not.toBeInTheDocument();
    expect(mockOnFilesSelected).toHaveBeenCalledWith([validFile]);
  });
});