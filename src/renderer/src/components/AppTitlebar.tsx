import { RefObject, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { ClipboardCheck, Database, Minus, Moon, PanelLeftClose, PanelLeftOpen, RefreshCw, Search, Square, Sun, X } from 'lucide-react';
import type { PicFlowWindowApi } from '../types';

type AppTitlebarProps = {
  currentViewTitle: string;
  search: string;
  sidePanelsCollapsed: boolean;
  darkMode: boolean;
  smartClipboardEnabled: boolean;
  libraryRefreshing: boolean;
  libraryButtonRef: RefObject<HTMLButtonElement>;
  windowApi: PicFlowWindowApi;
  onSearchChange: (value: string) => void;
  onSearchKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
  onToggleSidePanels: () => void;
  onToggleLibraryMenu: () => void;
  onRefreshLibrary: () => void;
  onToggleDarkMode: () => void;
  onToggleSmartClipboard: () => void;
};

export function AppTitlebar({
  currentViewTitle,
  search,
  sidePanelsCollapsed,
  darkMode,
  smartClipboardEnabled,
  libraryRefreshing,
  libraryButtonRef,
  windowApi,
  onSearchChange,
  onSearchKeyDown,
  onToggleSidePanels,
  onToggleLibraryMenu,
  onRefreshLibrary,
  onToggleDarkMode,
  onToggleSmartClipboard
}: AppTitlebarProps): JSX.Element {
  return (
    <header className="app-titlebar">
      <div className="titlebar-brand">
        <span className="titlebar-brand-name">{'\u56fe\u8ff9'}</span>
        <span className="titlebar-separator">/</span>
        <span className="titlebar-current-view">{currentViewTitle}</span>
      </div>

      <label className="titlebar-search">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400 dark:text-neutral-500" />
        <input
          className="smart-search-input"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          onKeyDown={onSearchKeyDown}
          placeholder={'\u641c\u7d22\u4f5c\u54c1 / \u7c98\u8d34\u56fe\u7247\u94fe\u63a5'}
        />
      </label>

      <div className="titlebar-actions">
        <button
          className="toolbar-icon-button"
          onClick={onToggleSidePanels}
          aria-label={sidePanelsCollapsed ? '\u663e\u793a\u4fa7\u680f' : '\u9690\u85cf\u4fa7\u680f'}
          title={sidePanelsCollapsed ? '\u663e\u793a\u4fa7\u680f' : '\u9690\u85cf\u4fa7\u680f'}
        >
          {sidePanelsCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>

        <div data-library-menu="true">
          <button
            ref={libraryButtonRef}
            className="toolbar-icon-button"
            onClick={onToggleLibraryMenu}
            aria-label={'\u8d44\u6e90\u5e93'}
            title={'\u8d44\u6e90\u5e93'}
          >
            <Database className="h-4 w-4" />
          </button>
        </div>

        <button
          className="toolbar-icon-button"
          onClick={onRefreshLibrary}
          disabled={libraryRefreshing}
          aria-label={'\u5237\u65b0\u5f53\u524d\u8d44\u6e90\u5e93'}
          title={'\u5237\u65b0\u5f53\u524d\u8d44\u6e90\u5e93'}
        >
          <RefreshCw className={`h-4 w-4 ${libraryRefreshing ? 'animate-spin' : ''}`} />
        </button>

        <button className="toolbar-icon-button" onClick={onToggleDarkMode} aria-label={'\u5207\u6362\u6d45\u8272\u6df1\u8272\u6a21\u5f0f'} title={'\u5207\u6362\u6d45\u8272 / \u6df1\u8272\u6a21\u5f0f'}>
          {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <button
          className={`toolbar-icon-button ${smartClipboardEnabled ? 'is-active' : ''}`}
          onClick={onToggleSmartClipboard}
          aria-pressed={smartClipboardEnabled}
          aria-label={'\u667a\u80fd\u526a\u8d34\u677f'}
          title={'\u667a\u80fd\u526a\u8d34\u677f\uff1a\u68c0\u6d4b\u526a\u8d34\u677f\u6587\u672c\uff0c\u5e76\u5728\u786e\u8ba4\u540e\u586b\u5165\u5f53\u524d\u4f5c\u54c1 Prompt'}
        >
          <ClipboardCheck className="h-4 w-4" />
        </button>
      </div>

      <WindowControls windowApi={windowApi} />
    </header>
  );
}

function WindowControls({ windowApi }: { windowApi: PicFlowWindowApi }): JSX.Element {
  return (
    <div className="window-controls" aria-label={'\u7a97\u53e3\u63a7\u5236'}>
      <button className="window-control-button" onClick={() => void windowApi.minimize()} aria-label={'\u6700\u5c0f\u5316'} title={'\u6700\u5c0f\u5316'}>
        <Minus className="h-4 w-4" />
      </button>
      <button className="window-control-button" onClick={() => void windowApi.toggleMaximize()} aria-label={'\u6700\u5927\u5316\u6216\u8fd8\u539f'} title={'\u6700\u5927\u5316 / \u8fd8\u539f'}>
        <Square className="h-3.5 w-3.5" />
      </button>
      <button className="window-control-button is-close" onClick={() => void windowApi.close()} aria-label={'\u5173\u95ed'} title={'\u5173\u95ed'}>
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
