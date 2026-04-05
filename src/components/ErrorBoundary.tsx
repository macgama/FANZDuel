import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './Layout';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center p-8 text-center bg-gray-900 rounded-xl border border-red-500/30 m-4 h-full min-h-[300px]">
          <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
          <h2 className="text-xl font-black text-white mb-2 uppercase italic">Une erreur est survenue</h2>
          <p className="text-gray-400 text-sm mb-6 max-w-md">
            {this.state.error?.message || "Un problème inattendu s'est produit dans ce composant."}
          </p>
          <Button 
            onClick={() => {
              this.setState({ hasError: false, error: null });
              if (this.props.onReset) this.props.onReset();
            }}
            variant="outline"
            className="border-red-500/50 text-red-500 hover:bg-red-500/10"
          >
            Réessayer
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
