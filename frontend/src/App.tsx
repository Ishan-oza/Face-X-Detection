import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AnalysisProvider } from './context/AnalysisContext';
import { BackendProvider } from './context/BackendContext';
import { AboutPage } from './pages/AboutPage';
import { DetectPage } from './pages/DetectPage';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { ResultsPage } from './pages/ResultsPage';
import { TermsPage } from './pages/TermsPage';

// A data router is required for React Router's `viewTransition` support.
const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'detect', element: <DetectPage /> },
      { path: 'results', element: <ResultsPage /> },
      { path: 'about', element: <AboutPage /> },
      { path: 'privacy', element: <PrivacyPage /> },
      { path: 'terms', element: <TermsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

export default function App() {
  return (
    <BackendProvider>
      <AnalysisProvider>
        <RouterProvider router={router} />
      </AnalysisProvider>
    </BackendProvider>
  );
}
