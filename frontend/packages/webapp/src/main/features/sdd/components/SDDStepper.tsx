import React from 'react';
import { FileText, ClipboardList, Layers, CheckCircle } from 'lucide-react';
import type { SDDPanelState } from '../types/sdd-types';

interface SDDStepperProps {
  activePhase: SDDPanelState['activePhase'];
  productCreated: boolean;
  requirementsCreated: boolean;
  designCreated: boolean;
  onChangePhase: (phase: SDDPanelState['activePhase']) => void;
}

export const SDDStepper: React.FC<SDDStepperProps> = ({
  activePhase,
  productCreated,
  requirementsCreated,
  designCreated,
  onChangePhase,
}) => {
  const steps = [
    {
      id: 'product' as const,
      label: 'Product Brief',
      description: 'El qué y para quién',
      icon: FileText,
      isCompleted: productCreated,
      isClickable: true, // Always clickable to review
    },
    {
      id: 'requirements' as const,
      label: 'Requisitos (EARS)',
      description: 'Criterios de aceptación',
      icon: ClipboardList,
      isCompleted: requirementsCreated,
      isClickable: productCreated, // Clickable once product is created
    },
    {
      id: 'design' as const,
      label: 'Diseño (Diagrama)',
      description: 'Modelo de clases UML',
      icon: Layers,
      isCompleted: designCreated,
      isClickable: requirementsCreated, // Clickable once requirements exist
    },
  ];

  return (
    <div className="w-full py-3 border-b border-border/40 bg-card/30 backdrop-blur-md px-6 select-none animate-fade-in">
      <div className="max-w-4xl mx-auto flex items-center justify-between relative">
        {/* Connection Line */}
        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-border/40 -translate-y-1/2 z-0" />
        
        {steps.map((step, idx) => {
          const Icon = step.icon;
          const isActive = activePhase === step.id;
          
          return (
            <div
              key={step.id}
              onClick={() => step.isClickable && onChangePhase(step.id)}
              className={`flex items-center gap-3 relative z-10 p-3.5 rounded-2xl border transition-all duration-300 ${
                isActive
                  ? 'border-brand/40 bg-brand/[0.04] shadow-md shadow-brand/5 scale-105'
                  : step.isCompleted
                  ? 'border-emerald-500/20 bg-emerald-500/[0.02] hover:border-emerald-500/30'
                  : step.isClickable
                  ? 'border-border/60 bg-card hover:border-brand/20 hover:bg-accent/40'
                  : 'border-border/20 bg-muted/20 opacity-50 cursor-not-allowed'
              } ${step.isClickable && 'cursor-pointer'}`}
            >
              <div
                className={`flex items-center justify-center size-10 rounded-xl transition-all duration-300 ${
                  isActive
                    ? 'bg-brand text-brand-foreground shadow-lg shadow-brand/20'
                    : step.isCompleted
                    ? 'bg-emerald-500 text-white'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {step.isCompleted && !isActive ? (
                  <CheckCircle className="size-5" />
                ) : (
                  <Icon className="size-5" />
                )}
              </div>
              
              <div className="flex flex-col text-left">
                <span
                  className={`text-sm font-semibold transition-colors duration-200 ${
                    isActive
                      ? 'text-brand'
                      : step.isCompleted
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-foreground'
                  }`}
                >
                  {step.label}
                </span>
                <span className="text-[11px] text-muted-foreground line-clamp-1">{step.description}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
export default SDDStepper;
