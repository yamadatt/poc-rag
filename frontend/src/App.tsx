import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { 
  HomeIcon,
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import Dashboard from './pages/Dashboard';
import DocumentManager from './pages/DocumentManager';
import ChatInterface from './pages/ChatInterface';
import ErrorBoundary from './components/ErrorBoundary';




// Navigation Component
const Navigation = () => {
  const navItems = [
    { name: 'ダッシュボード', href: '/', icon: HomeIcon },
    { name: 'チャット', href: '/chat', icon: ChatBubbleLeftRightIcon },
    { name: 'ドキュメント', href: '/documents', icon: DocumentTextIcon },
  ];

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <h1 className="text-xl font-bold text-gray-900">RAG System</h1>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {navItems.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.href}
                  className={({ isActive }) =>
                    `inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors duration-200 ${
                      isActive
                        ? 'border-blue-500 text-gray-900'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    }`
                  }
                >
                  <item.icon className="mr-2 h-5 w-5" />
                  {item.name}
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="sm:hidden">
        <div className="pt-2 pb-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                `block pl-3 pr-4 py-2 border-l-4 text-base font-medium transition-colors duration-200 ${
                  isActive
                    ? 'bg-blue-50 border-blue-500 text-blue-700'
                    : 'border-transparent text-gray-600 hover:text-gray-800 hover:bg-gray-50 hover:border-gray-300'
                }`
              }
            >
              <div className="flex items-center">
                <item.icon className="mr-3 h-6 w-6" />
                {item.name}
              </div>
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
};

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/chat" element={<ChatInterface />} />
              <Route path="/documents" element={<DocumentManager />} />
            </Routes>
          </ErrorBoundary>
        </main>
      </div>
    </Router>
  );
}

export default App;
