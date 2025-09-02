import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Notification from '../Notification';

describe('Notification', () => {
  const mockNotification = {
    id: 'test-1',
    type: 'success' as const,
    title: 'Success',
    message: 'Operation completed successfully',
    timestamp: new Date().toISOString(),
  };

  it('should render notification with correct type', () => {
    render(<Notification notification={mockNotification} onClose={jest.fn()} />);
    
    expect(screen.getByText('Success')).toBeInTheDocument();
    expect(screen.getByText('Operation completed successfully')).toBeInTheDocument();
  });

  it('should render success notification with correct icon color', () => {
    render(
      <Notification 
        notification={{ ...mockNotification, type: 'success' }} 
        onClose={jest.fn()} 
      />
    );
    
    const icon = screen.getByTestId('notification-icon');
    expect(icon).toHaveClass('text-green-400');
  });

  it('should render error notification with correct icon color', () => {
    render(
      <Notification 
        notification={{ ...mockNotification, type: 'error' }} 
        onClose={jest.fn()} 
      />
    );
    
    const icon = screen.getByTestId('notification-icon');
    expect(icon).toHaveClass('text-red-400');
  });

  it('should render warning notification with correct icon color', () => {
    render(
      <Notification 
        notification={{ ...mockNotification, type: 'warning' }} 
        onClose={jest.fn()} 
      />
    );
    
    const icon = screen.getByTestId('notification-icon');
    expect(icon).toHaveClass('text-yellow-400');
  });

  it('should render info notification with correct icon color', () => {
    render(
      <Notification 
        notification={{ ...mockNotification, type: 'info' }} 
        onClose={jest.fn()} 
      />
    );
    
    const icon = screen.getByTestId('notification-icon');
    expect(icon).toHaveClass('text-blue-400');
  });

  it('should call onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    
    render(<Notification notification={mockNotification} onClose={onClose} />);
    
    const closeButton = screen.getByRole('button', { name: /close/i });
    await user.click(closeButton);
    
    expect(onClose).toHaveBeenCalledWith('test-1');
  });

  it('should auto-close after timeout when autoClose is true', async () => {
    jest.useFakeTimers();
    const onClose = jest.fn();
    
    render(
      <Notification 
        notification={{ ...mockNotification, autoClose: true }} 
        onClose={onClose} 
      />
    );
    
    // Fast-forward time
    jest.advanceTimersByTime(5000);
    
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledWith('test-1');
    });
    
    jest.useRealTimers();
  });

  it('should not auto-close when autoClose is false', () => {
    jest.useFakeTimers();
    const onClose = jest.fn();
    
    render(
      <Notification 
        notification={{ ...mockNotification, autoClose: false }} 
        onClose={onClose} 
      />
    );
    
    // Fast-forward time
    jest.advanceTimersByTime(10000);
    
    expect(onClose).not.toHaveBeenCalled();
    
    jest.useRealTimers();
  });

  it('should have fade-in animation', () => {
    render(<Notification notification={mockNotification} onClose={jest.fn()} />);
    
    const notification = screen.getByRole('alert');
    expect(notification).toHaveClass('transition-all');
  });
});