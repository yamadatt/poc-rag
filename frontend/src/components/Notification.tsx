import React, { useEffect } from 'react';
import { Transition } from '@headlessui/react';
import {
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import type { Notification as NotificationType } from '../types';

interface NotificationProps {
  notification: NotificationType;
  onClose: (id: string) => void;
}

const Notification: React.FC<NotificationProps> = ({ notification, onClose }) => {
  const { id, type, title, message, autoClose = true } = notification;

  // Auto-close notification after 5 seconds
  useEffect(() => {
    if (autoClose) {
      const timer = setTimeout(() => {
        onClose(id);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [id, onClose, autoClose]);

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircleIcon className="h-6 w-6 text-green-400" data-testid="notification-icon" />;
      case 'error':
        return <XCircleIcon className="h-6 w-6 text-red-400" data-testid="notification-icon" />;
      case 'warning':
        return <ExclamationTriangleIcon className="h-6 w-6 text-yellow-400" data-testid="notification-icon" />;
      case 'info':
        return <InformationCircleIcon className="h-6 w-6 text-blue-400" data-testid="notification-icon" />;
      default:
        return <InformationCircleIcon className="h-6 w-6 text-blue-400" data-testid="notification-icon" />;
    }
  };

  const getBorderColor = () => {
    switch (type) {
      case 'success':
        return 'border-green-200';
      case 'error':
        return 'border-red-200';
      case 'warning':
        return 'border-yellow-200';
      case 'info':
        return 'border-blue-200';
      default:
        return 'border-gray-200';
    }
  };

  return (
    <Transition
      appear
      show={true}
      enter="transition-all duration-300"
      enterFrom="opacity-0 transform scale-95 translate-x-full"
      enterTo="opacity-100 transform scale-100 translate-x-0"
      leave="transition-all duration-300"
      leaveFrom="opacity-100 transform scale-100 translate-x-0"
      leaveTo="opacity-0 transform scale-95 translate-x-full"
    >
      <div
        role="alert"
        className={`max-w-sm w-full bg-white shadow-lg rounded-lg pointer-events-auto border ${getBorderColor()} transition-all`}
      >
        <div className="p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              {getIcon()}
            </div>
            <div className="ml-3 w-0 flex-1">
              <p className="text-sm font-medium text-gray-900">{title}</p>
              <p className="mt-1 text-sm text-gray-500">{message}</p>
            </div>
            <div className="ml-4 flex-shrink-0 flex">
              <button
                type="button"
                className="bg-white rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                onClick={() => onClose(id)}
                aria-label="Close"
              >
                <span className="sr-only">Close</span>
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  );
};

export default Notification;