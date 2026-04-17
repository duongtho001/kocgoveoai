
import * as React from 'react';
import { theme } from '../constants/colors';

export interface ErrorBoundaryProps {
  // Made children optional to resolve "Property 'children' is missing in type '{}'" errors in App.tsx
  children?: React.ReactNode;
  fallback?: React.ReactNode;
}

export interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Canonical React Error Boundary implementation with strict TypeScript typing.
 * Fixed "Property 'state/props' does not exist" by ensuring correct inheritance 
 * and explicit declaration of class members.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  // Explicitly declare props to satisfy TypeScript checks when inheritance properties are not automatically detected
  public props: ErrorBoundaryProps;

  // Fixed: Explicitly declaring state as a class property to satisfy TypeScript checks
  public state: ErrorBoundaryState = {
    hasError: false
  };

  constructor(props: ErrorBoundaryProps) {
    super(props);
    // Explicitly assign props to ensure availability within class methods
    this.props = props;
  }

  /**
   * Updates state so the next render will show the fallback UI.
   */
  public static getDerivedStateFromError(_error: Error): ErrorBoundaryState {
    return { hasError: true };
  }

  /**
   * Log error information to an error reporting service.
   */
  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error("ErrorBoundary caught an uncaught error:", error, errorInfo);
  }

  /**
   * Utility to clear local state and reload the app, useful for recovery.
   */
  private handleReset = (): void => {
    try {
      localStorage.clear();
      window.location.reload();
    } catch (e) {
      window.location.reload();
    }
  };

  public render(): React.ReactNode {
    // Fixed: Correctly using this.state and this.props which are inherited from React.Component
    if (this.state.hasError) {
      // If a custom fallback is provided via props, use it.
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default production-ready error UI.
      return (
        <div className={`min-h-screen flex items-center justify-center ${theme.colors.background} p-4`}>
          <div className={`${theme.colors.cardBackground} p-8 rounded-2xl shadow-xl max-w-md w-full text-center border ${theme.colors.border}`}>
            <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className={`text-xl font-black ${theme.colors.textPrimary} mb-2 notranslate`} translate="no">
              <span>Đã xảy ra lỗi hệ thống</span>
            </h2>
            <p className={`${theme.colors.textSecondary} mb-6 text-sm notranslate`} translate="no">
              <span>Ứng dụng gặp sự cố không mong muốn. Dữ liệu của bạn đã được lưu tự động.</span>
            </p>
            <button 
              onClick={this.handleReset} 
              className={`w-full py-3 ${theme.colors.buttonPrimary} text-white font-bold rounded-xl transition-all shadow-lg active:scale-95 notranslate`}
              translate="no"
            >
              <span>Tải lại & Làm mới ứng dụng</span>
            </button>
          </div>
        </div>
      );
    }

    // Explicitly return children as defined in ErrorBoundaryProps.
    return this.props.children;
  }
}

export default ErrorBoundary;
