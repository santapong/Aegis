"use client";

import { useEffect, useRef } from "react";
import { useAppStore } from "@/stores/app-store";

interface TradingViewWidgetProps {
  symbol: string;
  height?: number;
}

/**
 * Embeds TradingView's free Symbol Overview widget. The script tag must be
 * a direct child of an empty container, and the widget config is encoded
 * inside it as JSON — that's how TradingView's loader discovers it.
 *
 * Re-mounts when `symbol` or theme changes, since the widget reads its
 * config once on script execution.
 */
export function TradingViewWidget({ symbol, height = 220 }: TradingViewWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // All cosmic themes share a dark surface, so the TradingView widget always
  // mounts in dark mode regardless of which Aegis theme is active.
  const theme = useAppStore((s) => s.theme);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = "";

    const script = document.createElement("script");
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbols: [[symbol, symbol]],
      chartOnly: false,
      width: "100%",
      height,
      locale: "en",
      colorTheme: "dark",
      isTransparent: true,
      showVolume: false,
      showMA: false,
      hideDateRanges: false,
      hideMarketStatus: false,
      hideSymbolLogo: false,
      scalePosition: "right",
      scaleMode: "Normal",
      fontFamily: "system-ui, sans-serif",
      fontSize: "10",
      noTimeScale: false,
      valuesTracking: "1",
      changeMode: "price-and-percent",
      lineWidth: 2,
      lineType: 0,
      dateRanges: ["1m|30", "3m|60", "12m|1D", "60m|1W", "all|1M"],
    });

    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
  }, [symbol, theme, height]);

  return (
    <div
      ref={containerRef}
      className="tradingview-widget-container"
      style={{ height, width: "100%" }}
    />
  );
}
