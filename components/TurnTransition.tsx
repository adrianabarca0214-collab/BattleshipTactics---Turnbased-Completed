import React from 'react';

interface TurnTransitionProps {
  nextPlayerName: string;
  onContinue: () => void;
  isSetupTransition: boolean;
  message: string;
}

const TurnTransition: React.FC<TurnTransitionProps> = ({ nextPlayerName, onContinue, isSetupTransition, message }) => {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 text-center fade-in command-background">
      <div className="command-background-dots"></div>
      <div className="transition-alert-bg"></div>
      <div className="w-full max-w-lg command-panel transition-panel p-8 space-y-6 relative z-10">
        <h1 className="text-3xl font-bold transition-title text-red-400 tracking-widest">
            SECURE HANDOFF
        </h1>
        <div className="text-lg text-slate-300 bg-slate-900/50 p-3 command-panel-header">
            <p className="text-sm text-slate-400">> System Log: {message}</p>
            <p className="mt-1">
                Awaiting command from: <strong className="text-yellow-300 text-xl tracking-wider">{nextPlayerName}</strong>
            </p>
        </div>
        <p className="text-slate-400">
          Ensure opponent cannot view the screen before proceeding.
        </p>
        <button
          onClick={onContinue}
          className="w-full btn-angular btn-start btn-accept-command text-white font-bold py-4 px-8 text-2xl transition-transform"
        >
          {isSetupTransition ? 'COMMENCE SETUP' : 'ACCEPT COMMAND'}
        </button>
      </div>
    </div>
  );
};

export default TurnTransition;