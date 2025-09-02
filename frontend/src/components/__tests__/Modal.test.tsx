import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Modal from '../Modal';

describe('Modal', () => {
  it('should not render when isOpen is false', () => {
    render(
      <Modal isOpen={false} onClose={jest.fn()} title="Test Modal">
        <div>Modal content</div>
      </Modal>
    );
    expect(screen.queryByText('Test Modal')).not.toBeInTheDocument();
  });

  it('should render when isOpen is true', () => {
    render(
      <Modal isOpen={true} onClose={jest.fn()} title="Test Modal">
        <div>Modal content</div>
      </Modal>
    );
    expect(screen.getByText('Test Modal')).toBeInTheDocument();
    expect(screen.getByText('Modal content')).toBeInTheDocument();
  });

  it('should call onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    
    render(
      <Modal isOpen={true} onClose={onClose} title="Test Modal">
        <div>Modal content</div>
      </Modal>
    );
    
    const closeButton = screen.getByRole('button', { name: /close/i });
    await user.click(closeButton);
    
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should call onClose when backdrop is clicked', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    
    render(
      <Modal isOpen={true} onClose={onClose} title="Test Modal">
        <div>Modal content</div>
      </Modal>
    );
    
    const backdrop = screen.getByTestId('modal-backdrop');
    await user.click(backdrop);
    
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should not close when modal content is clicked', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    
    render(
      <Modal isOpen={true} onClose={onClose} title="Test Modal">
        <div>Modal content</div>
      </Modal>
    );
    
    const content = screen.getByText('Modal content');
    await user.click(content);
    
    expect(onClose).not.toHaveBeenCalled();
  });

  it('should render with different sizes', () => {
    const { rerender } = render(
      <Modal isOpen={true} onClose={jest.fn()} title="Test" size="small">
        <div>Content</div>
      </Modal>
    );
    
    let modalPanel = screen.getByRole('dialog');
    expect(modalPanel).toHaveClass('max-w-md');
    
    rerender(
      <Modal isOpen={true} onClose={jest.fn()} title="Test" size="large">
        <div>Content</div>
      </Modal>
    );
    
    modalPanel = screen.getByRole('dialog');
    expect(modalPanel).toHaveClass('max-w-4xl');
  });

  it('should render footer when provided', () => {
    render(
      <Modal 
        isOpen={true} 
        onClose={jest.fn()} 
        title="Test Modal"
        footer={
          <div>
            <button>Cancel</button>
            <button>Confirm</button>
          </div>
        }
      >
        <div>Modal content</div>
      </Modal>
    );
    
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
  });

  it('should close on Escape key press', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    
    render(
      <Modal isOpen={true} onClose={onClose} title="Test Modal">
        <div>Modal content</div>
      </Modal>
    );
    
    await user.keyboard('{Escape}');
    
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});