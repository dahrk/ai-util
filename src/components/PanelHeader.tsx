import { Sparkles, Settings as Cog } from "lucide-react";
import type { ReactNode } from "react";
import "./PanelHeader.css";

import { ProviderIndicator, type ProviderStatus } from "./ProviderIndicator";
import type { Provider } from "../lib/types";

interface Props {
  /** Optional icon override (e.g. back-arrow on streaming/result states). */
  leftIcon?: ReactNode;
  title: string;
  provider?: Provider;
  providerStatus?: ProviderStatus;
  showProvider?: boolean;
  onSettings?: () => void;
}

/**
 * Top strip of the floating panel. Mirrors `design-reference/project/panel.jsx`
 * header: left-side icon + label, right-side provider pill + cog.
 */
export function PanelHeader({
  leftIcon,
  title,
  provider = "fireworks",
  providerStatus,
  showProvider = true,
  onSettings,
}: Props) {
  return (
    <header className="panel-header">
      <div className="panel-header__left">
        <span className="panel-header__icon" aria-hidden="true">
          {leftIcon ?? <Sparkles size={12} />}
        </span>
        <span className="panel-header__title">{title}</span>
      </div>
      <div className="panel-header__right">
        {showProvider && <ProviderIndicator provider={provider} status={providerStatus} />}
        {onSettings && (
          <button
            type="button"
            className="panel-header__cog"
            onClick={onSettings}
            aria-label="Settings"
          >
            <Cog size={12} />
          </button>
        )}
      </div>
    </header>
  );
}
