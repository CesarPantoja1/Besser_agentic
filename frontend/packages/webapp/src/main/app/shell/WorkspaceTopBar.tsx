import React from 'react';
import { FolderKanban, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CommunityMenu } from './menus/CommunityMenu';
import { DeployMenu } from './menus/DeployMenu';
import { FileMenu } from './menus/FileMenu';
import { GenerateMenu } from './menus/GenerateMenu';
import { HelpMenu } from './menus/HelpMenu';
import { MobileNavigation } from './menus/MobileNavigation';
import { TopBarUtilities } from './menus/TopBarUtilities';
import type { WorkspaceTopBarProps } from './topbar-types';

const WorkspaceTopBarInner: React.FC<WorkspaceTopBarProps> = ({
  isDarkTheme,
  headerBackgroundClass,
  outlineButtonClass,
  primaryGenerateClass,
  showQualityCheck,
  generatorMode,
  isGenerating,
  locationPath,
  activeUmlType,
  isAuthenticated,
  username,
  githubLoading,
  hasProject,
  isDeploymentAvailable,
  onOpenProjectHub,
  onOpenTemplateDialog,
  onExportProject,
  onImportSingleDiagram,
  onOpenAssistantImportImage,
  onOpenAssistantImportKg,
  onOpenProjectPreview,
  onGenerate,
  onQualityCheck,
  qualityCheckState,
  showAgentVariantSelector,
  agentVariantOptions,
  activeAgentVariantId,
  onAgentVariantChange,
  onToggleTheme,
  onGitHubLogin,
  onGitHubLogout,
  onOpenGitHubSidebar,
  hasStarred,
  starLoading,
  onToggleStar,
  onOpenDeployDialog,
  onOpenHelpDialog,
  onOpenAboutDialog,
  onOpenFeedback,
  onOpenKeyboardShortcuts,
  onShowWelcomeGuide,
  onOpenSDD,
  activeDiagramType,
  perspectives,
  onSwitchUml,
  onSwitchDiagramType,
  onNavigate,
  projectNameDraft,
  onProjectNameDraftChange,
  onProjectRename,
}) => {
  return (
    <header className={`relative z-20 animate-slide-in-down px-4 py-2 sm:px-6 ${headerBackgroundClass}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={onOpenProjectHub}
            aria-label="Open project hub"
            className="group flex shrink-0 items-center p-0 text-left transition-opacity hover:opacity-85"
          >
            <img
              src="/images/logo.png"
              alt="BESSER"
              className={`h-10 w-auto ${isDarkTheme ? 'brightness-0 invert' : 'brightness-0'}`}
            />
          </button>
          <div className="hidden items-center gap-1.5 lg:flex">
            <FolderKanban className="size-4 shrink-0 text-muted-foreground" />
            <Input
              value={projectNameDraft}
              onChange={(event) => onProjectNameDraftChange(event.target.value)}
              onBlur={onProjectRename}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.currentTarget.blur();
                }
              }}
              className="h-7 w-36 border-none bg-transparent px-1 py-0 text-sm font-medium shadow-none focus-visible:ring-0"
              placeholder="Project name"
            />
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-1 xl:gap-2">
          <FileMenu
            outlineButtonClass={outlineButtonClass}
            hasProject={hasProject}
            onOpenProjectHub={onOpenProjectHub}
            onOpenTemplateDialog={onOpenTemplateDialog}
            onExportProject={onExportProject}
            onImportSingleDiagram={onImportSingleDiagram}
            onOpenAssistantImportImage={onOpenAssistantImportImage}
            onOpenAssistantImportKg={onOpenAssistantImportKg}
            onOpenProjectPreview={onOpenProjectPreview}
          />
          <GenerateMenu
            mode={generatorMode}
            isGenerating={isGenerating}
            primaryGenerateClass={primaryGenerateClass}
            onGenerate={onGenerate}
            onSwitchDiagramType={onSwitchDiagramType}
          />
          <DeployMenu
            outlineButtonClass={outlineButtonClass}
            isAuthenticated={isAuthenticated}
            githubLoading={githubLoading}
            isDeploymentAvailable={isDeploymentAvailable}
            onGitHubLogin={onGitHubLogin}
            onOpenDeployDialog={onOpenDeployDialog}
          />
          <CommunityMenu
            outlineButtonClass={outlineButtonClass}
            onOpenFeedback={onOpenFeedback}
          />
          <HelpMenu
            outlineButtonClass={outlineButtonClass}
            onOpenHelpDialog={onOpenHelpDialog}
            onOpenAboutDialog={onOpenAboutDialog}
            onOpenKeyboardShortcuts={onOpenKeyboardShortcuts}
            onShowWelcomeGuide={onShowWelcomeGuide}
          />
          <Button
            variant="outline"
            className={`gap-2 ${outlineButtonClass} border-brand/35 bg-brand/[0.03] text-brand relative overflow-hidden group hover:bg-brand/[0.08] transition-all duration-300 hover:scale-[1.02] active:scale-95`}
            onClick={onOpenSDD}
            title="Software Design Document Framework"
          >
            <Sparkles className="size-4 animate-pulse text-brand" />
            <span className="hidden xl:inline font-bold">Framework SDD</span>
            <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out" />
          </Button>
          <TopBarUtilities
            showQualityCheck={showQualityCheck}
            outlineButtonClass={outlineButtonClass}
            isDarkTheme={isDarkTheme}
            isAuthenticated={isAuthenticated}
            username={username}
            githubLoading={githubLoading}
            hasStarred={hasStarred}
            starLoading={starLoading}
            qualityCheckState={qualityCheckState}
            onQualityCheck={onQualityCheck}
            showAgentVariantSelector={showAgentVariantSelector}
            agentVariantOptions={agentVariantOptions}
            activeAgentVariantId={activeAgentVariantId}
            onAgentVariantChange={onAgentVariantChange}
            onToggleTheme={onToggleTheme}
            onGitHubLogin={onGitHubLogin}
            onGitHubLogout={onGitHubLogout}
            onOpenGitHubSidebar={onOpenGitHubSidebar}
            onToggleStar={onToggleStar}
          />
        </div>
      </div>
      <MobileNavigation
        locationPath={locationPath}
        activeUmlType={activeUmlType}
        activeDiagramType={activeDiagramType}
        isDarkTheme={isDarkTheme}
        perspectives={perspectives}
        onSwitchUml={onSwitchUml}
        onSwitchDiagramType={onSwitchDiagramType}
        onNavigate={onNavigate}
      />
    </header>
  );
};

export const WorkspaceTopBar = React.memo(WorkspaceTopBarInner);
