import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    message: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error.message || 'Ocurrió un error inesperado.',
    };
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#FAFAFC] p-6">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 border border-zinc-200/80 shadow-sm text-center">
            <h2 className="font-display text-lg font-bold text-[#141118]">
              Algo no salió como esperábamos
            </h2>
            <p className="mt-2 text-sm text-zinc-500 leading-relaxed">
              Puedes recargar la vista para continuar explorando el marketplace.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 w-full h-12 rounded-full bg-[#362B3D] text-white text-sm font-semibold active:scale-[0.98] transition-transform"
            >
              Recargar Quemarket
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
